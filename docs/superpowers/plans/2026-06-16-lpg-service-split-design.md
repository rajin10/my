# LPG-service worker split — design

- **Date:** 2026-06-16
- **Status:** Approved (2026-06-16)
- **Scope:** `workers/api` (gateway) + `workers/lpg-service` (new) + `packages/api-client` (no path changes) + `packages/core` (reused repos/schema)

## Problem

Today `workers/api` owns all domain modules, including the **commerce vertical** (LPG retail + delivery) introduced in [ADR-0004](../../adr/0004-multi-vertical-platform-extension.md):

- `products` — branch-scoped catalog and stock
- `orders` — placement, fulfilment queue, status machine
- `customer-addresses` — delivery address book
- `payments` — owner-recorded cash receipts
- `khata` — derived due ledger per `(business, customer)`

These modules form a tight bounded context (stock decrement, order snapshots, khata debits) but deploy with the booking platform. We want to **separate commerce into a independently deployable Worker**, `workers/lpg-service`, while keeping booking and shared platform routes in `workers/api` — mirroring the [auth-service split](2026-06-16-auth-service-split-design.md).

## Goals

- Move **commerce API modules** to `workers/lpg-service` deployed independently.
- Enable **independent deploy and scale** of commerce vs booking.
- Keep **frontends unchanged** — they keep calling the same `/api/v1/...` base URL on the gateway.
- Preserve current commerce semantics (stock invariants, order status machine, khata derivation, response envelopes).
- Reuse proven auth patterns from the auth-service split (local JWT verify + internal authorise).

## Non-goals (v1)

- Moving `search` (commerce strategy), `walk-in`, `businesses`, `branches`, `analytics`, `campaigns`, or `customers`.
- Separate D1 database for commerce (shared `TALASH_DB` remains).
- Changing `@repo/api-client` public paths.
- Cross-service caching of authz decisions.
- Extracting `AuthorizationService` into `@repo/core` (defer until duplication hurts).

## Decisions log

| Decision | Choice |
| --- | --- |
| Motivation | Independent deploy/scale commerce separately from booking |
| Scope (v1) | `products`, `orders`, `customer-addresses`, `payments`, `khata` |
| Surface for frontends | **Frontends keep calling `workers/api`**; gateway proxies commerce routes |
| Worker-to-worker auth | **Cloudflare Service Bindings** (`workers/api` → `workers/lpg-service`; `workers/lpg-service` → `workers/auth-service`) |
| JWT verification | `workers/lpg-service` **verifies JWT locally**; delegates role/branch scope to `auth-service` |
| Internal authorisation contract | Reuse `POST /internal/authorise` on auth-service (returns `{ user, scopedBranchIds }`) |
| Database | **Shared D1** (`TALASH_DB`) via `@repo/core` |
| Caching | **Per-request only** (no cross-request authz caching) |

## Architecture (selected approach)

### Public routing

`workers/api` remains the single public edge API for frontends. It proxies:

| Proxied prefix | Owner |
| --- | --- |
| `/api/v1/products` | `workers/lpg-service` |
| `/api/v1/orders` | `workers/lpg-service` |
| `/api/v1/customer-addresses` | `workers/lpg-service` |
| `/api/v1/payments` | `workers/lpg-service` |
| `/api/v1/khata` | `workers/lpg-service` |

All other `/api/v1/*` modules remain implemented in `workers/api` (including `businesses`, `branches`, `bookings`, `search`, etc.).

Proxy behaviour matches auth-service: pass-through status codes, JSON bodies, and relevant headers; no error re-wrapping.

### Internal auth (reused)

`workers/lpg-service` does not expose new public auth endpoints. It:

1. Verifies JWT locally via `SessionTokens.verify(token, JWT_SECRET)` (ported copy, same pattern as auth-service middleware).
2. Calls `workers/auth-service` `POST /internal/authorise` when routes need `requiredRoles` or `{ branchScope: true }`.

`JWT_SECRET` must match across `workers/api`, `workers/auth-service`, and `workers/lpg-service` in local dev.

### Request flow

```
Client → workers/api (gateway)
       → [commerce path] → workers/lpg-service
                              → SessionTokens.verify (local)
                              → POST /internal/authorise (auth-service, when needed)
                              → Service → Repository → D1
       → [other path]    → workers/api (direct)
```

## Contracts

### 1) Gateway proxy — commerce routes

`workers/api` must proxy responses with:

- identical HTTP status codes
- identical JSON bodies (or pass-through for `204`/empty)
- identical content-type headers where relevant
- forwarded `Authorization`, `X-Device-ID`, `X-Device-Name` headers

The gateway should avoid re-wrapping errors; the goal is contract parity for all clients.

**Known envelope exceptions (must be preserved):** `products.list` returns a raw `Product[]` (not `{ data: … }`); all other commerce list/get/create routes follow their existing envelope rules documented in `workers/api/CLAUDE.md` and `docs/guides/api-endpoints.md`.

### 2) Reused internal endpoint — `POST /internal/authorise`

Defined and owned by `workers/auth-service`. `workers/lpg-service` is a consumer only. See [auth-service split design](2026-06-16-auth-service-split-design.md) for the full contract.

## Code ownership after split

### `workers/lpg-service` owns

- `/api/v1/products/*` routes and `ProductsService`
- `/api/v1/orders/*` routes and `OrdersService`
- `/api/v1/customer-addresses/*` routes and `CustomerAddressesService`
- `/api/v1/payments/*` routes and `PaymentsService`
- `/api/v1/khata/*` routes and `KhataService`
- Commerce-scoped `AuthorizationService` with methods:
  - `assertBusinessOwner`, `assertBranchAccess`
  - `assertProductAccess`, `assertOrderAccess`
  - `assertCustomerOwnsOrder`, `assertCustomerOwnsAddress`
- Hono app, middleware (cors, exceptions, auth, auth-guard, query-parser, timeout, services injection)
- Ported tests under `src/__tests__/modules/`

### `workers/api` owns

- All non-commerce domain modules.
- Gateway proxy routing for the five commerce prefixes.
- Existing booking-side `AuthorizationService` (trim commerce-only methods after migration if unused).
- Local JWT verification for booking routes (unchanged).

### `packages/core` owns (unchanged)

- DB schema, repositories, queue types, notifications.

### `packages/api-client` owns (unchanged)

- Endpoint paths and types — no breaking changes.

## Deployment & configuration

### `workers/lpg-service` bindings

| Binding | Type | Used for |
| --- | --- | --- |
| `TALASH_DB` | `D1Database` | Products, orders, payments, khata, addresses |
| `TALASH_STORAGE` | `R2Bucket` | Product photo uploads |
| `TALASH_QUEUE` | `Queue` | Order status notifications |
| `AUTH_SERVICE` | Service | `POST /internal/authorise` |

**Env/secrets (at minimum):** `JWT_SECRET`, `PUBLIC_R2_URL`

Worker name: `talash-lpg-service` (binding `LPG_SERVICE` in gateway).

### `workers/api` additions

- **Service Binding:** `LPG_SERVICE` pointing at `workers/lpg-service`
- Keeps existing domain bindings and `AUTH_SERVICE` as today.

## Alternatives considered

| Approach | Why not chosen |
| --- | --- |
| Gateway terminates auth, forwards trusted headers to lpg-service | Weak trust boundary; diverges from auth-service pattern |
| Package extract only (`@repo/commerce-api` in api worker) | Does not achieve independent deploy (user goal) |
| Move `businesses`/`branches` by vertical | High complexity, duplicated CRUD, little deploy benefit |
| Direct client calls to lpg-service URL | Breaking change to `@repo/api-client` |

## Migration plan (phased, reversible)

### Phase 0 — Scaffold

- Create `workers/lpg-service` (Cloudflare Worker scaffold).
- Wire wrangler bindings (D1, R2, Queue, AUTH_SERVICE).
- Add workspace package + dev script.
- `GET /health` with D1 probe.

### Phase 1 — Products move

- Port `products` module + tests.
- Gateway proxy `/api/v1/products/*`.
- Remove products from `workers/api` routes/installers.

### Phase 2 — Orders + addresses move

- Port `orders`, `customer-addresses` modules + tests.
- Gateway proxy both prefixes.

### Phase 3 — Payments + khata move

- Port `payments`, `khata` modules + tests.
- Gateway proxy both prefixes.
- Run khata repository integration test in lpg-service.

### Phase 4 — Cleanup & ops

- Trim unused commerce methods from `workers/api` `AuthorizationService`.
- Add `lpg-service` to `dev:all` / root scripts.
- Staging + production wrangler envs for `talash-lpg-service`.
- Gateway proxy parity tests.
- Documentation updates (see below).

Each phase is independently deployable and reversible.

## Testing

- **lpg-service**
  - Service unit tests (ported from api worker).
  - Route integration tests via `app.request()`.
  - Auth-guard tests with mocked `AUTH_SERVICE`.
  - Repository integration tests for order placement (`db.batch` + `CHECK(stock >= 0)`) and khata derivation SQL.

- **Gateway (`workers/api`)**
  - Proxy parity tests per commerce prefix (status + body match).
  - Regression: booking routes unaffected.

- **Clients**
  - `packages/api-client` tests continue to pass without path changes.

## Local dev

Commerce routes require three workers:

```sh
bun run api:dev                                    # gateway (8787)
bun run --filter @repo/auth-service dev            # authorise
bun run --filter @repo/lpg-service dev             # commerce modules
```

`JWT_SECRET` must align across all three workers in `env.local`.

## Documentation updates (during implementation)

- `docs/architecture.md` — add lpg-service to worker diagram and request path.
- `docs/guides/api-endpoints.md` — clarify commerce routes are served by lpg-service behind the gateway.
- `workers/api/CLAUDE.md` — describe gateway proxy for commerce prefixes.
- New `workers/lpg-service/CLAUDE.md` — document lpg-service responsibilities and layering.

## Deferred (v2+)

- Move commerce search strategy (`commerce-strategy.ts`) to lpg-service.
- Walk-in commerce path.
- Vertical-specific analytics.
- Extract shared `AuthorizationService` into `@repo/core`.
