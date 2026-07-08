# Booking-service worker split — design

- **Date:** 2026-06-16
- **Status:** Approved
- **Scope:** `workers/api` (gateway) + `workers/booking-service` (new) + `workers/lpg-service` (walk-in commerce + search additions) + `packages/api-client` (no path changes) + `packages/core` (reused repos/schema)

## Problem

Today `workers/api` owns all domain modules not yet extracted to `auth-service` or `lpg-service`. The **booking vertical** (salons, parlours, spas, and other appointment-based wellness businesses — `businesses.vertical = "booking"`) still deploys with the gateway:

- `services` — branch-scoped bookable catalog
- `bookings` — slot reservation, status machine, staff assignment
- `team`, `staff-availability` — staff roster and per-member availability
- `coupons`, `reviews`, `rewards` — promotions, social proof, loyalty
- `analytics`, `campaigns`, `customers` — owner insights, marketing, CRM
- `search` booking strategy (`booking-strategy.ts`)
- `walk-in` booking path (plus commerce path still in api today)

These modules form a tight bounded context (slot uniqueness, duration overlap, branch hours, staff assignment) but deploy with shared platform routes. We want to **separate booking into an independently deployable Worker**, `workers/booking-service`, while keeping commerce in `lpg-service` and shared shell routes in `workers/api` — mirroring the [auth-service split](2026-06-16-auth-service-split-design.md) and [lpg-service split](2026-06-16-lpg-service-split-design.md).

## Goals

- Move **booking-vertical API modules** to `workers/booking-service` deployed independently.
- Enable **independent deploy and scale** of booking vs commerce vs auth.
- Keep **frontends unchanged** — they keep calling the same `/api/v1/...` base URL on the gateway.
- Preserve current booking semantics (slot invariants, overlap checks, branch hours, response envelopes).
- Reuse proven auth patterns (local JWT verify + internal authorise).
- Split **walk-in** and **search** by vertical across `booking-service` and `lpg-service`.

## Non-goals (v1)

- Moving `businesses`, `branches`, `notifications`, `favourites`, or `demo-requests`.
- Separate D1 database for booking (shared `TALASH_DB` remains).
- Changing `@repo/api-client` public paths.
- Cross-service caching of authz decisions.
- Extracting `AuthorizationService` into `@repo/core` (defer until duplication hurts).

## Decisions log

| Decision | Choice |
| --- | --- |
| Motivation | Independent deploy/scale booking separately from commerce and auth |
| Scope (v1) | All booking-vertical modules: `services`, `bookings`, `team`, `staff-availability`, `coupons`, `reviews`, `rewards`, `analytics`, `campaigns`, `customers`, booking search strategy, booking walk-in path |
| Surface for frontends | **Frontends keep calling `workers/api`**; gateway proxies booking routes |
| Worker name | `workers/booking-service` — binding `BOOKING_SERVICE`, worker name `talash-booking-service` |
| Worker-to-worker auth | **Cloudflare Service Bindings** (`workers/api` → `workers/booking-service`; `workers/booking-service` → `workers/auth-service`) |
| JWT verification | `workers/booking-service` **verifies JWT locally**; delegates role/branch scope to `auth-service` |
| Internal authorisation contract | Reuse `POST /internal/authorise` on auth-service (returns `{ user, scopedBranchIds }`) |
| Database | **Shared D1** (`TALASH_DB`) via `@repo/core` |
| Search | Gateway thin dispatcher; each vertical worker implements `GET /api/v1/search` for its strategy |
| Walk-in | Split by vertical; gateway resolves `branchId` → vertical and fans out/in where needed |
| Caching | **Per-request only** for authz; KV cache `branch:<id>:vertical` (5 min TTL) for walk-in dispatch |

## Architecture

### Public routing

`workers/api` remains the single public edge API for frontends. It proxies:

| Proxied prefix | Owner |
| --- | --- |
| `/api/v1/services` | `workers/booking-service` |
| `/api/v1/bookings` | `workers/booking-service` |
| `/api/v1/team` | `workers/booking-service` (includes staff availability sub-routes) |
| `/api/v1/coupons` | `workers/booking-service` |
| `/api/v1/reviews` | `workers/booking-service` |
| `/api/v1/rewards` | `workers/booking-service` |
| `/api/v1/analytics` | `workers/booking-service` |
| `/api/v1/campaigns` | `workers/booking-service` |
| `/api/v1/customers` | `workers/booking-service` |

Existing proxies unchanged:

| Proxied prefix | Owner |
| --- | --- |
| `/api/v1/auth/*`, `/api/v1/users/*` | `workers/auth-service` |
| `/api/v1/products`, `/orders`, `/customer-addresses`, `/payments`, `/khata` | `workers/lpg-service` |

**Gateway keeps (implemented locally):**

- `/api/v1/businesses`, `/api/v1/branches` — shared tenant root
- `/api/v1/notifications`, `/api/v1/favourites`, `/api/v1/demo-requests`
- `/api/v1/search` — thin vertical dispatcher (see Contracts)
- `/api/v1/walk-in` — thin vertical dispatcher (see Contracts)

### Request flow

```
Client → workers/api (gateway)
       → [booking prefix]  → workers/booking-service
                                  → SessionTokens.verify (local)
                                  → POST /internal/authorise (auth-service, when needed)
                                  → Service → Repository → D1
       → [commerce prefix] → workers/lpg-service
       → [auth/users]      → workers/auth-service
       → [shared shell]    → workers/api (direct)
```

### Internal auth (reused)

`workers/booking-service` does not expose new public auth endpoints. It:

1. Verifies JWT locally via `SessionTokens.verify(token, JWT_SECRET)` (ported copy, same pattern as `lpg-service`).
2. Calls `workers/auth-service` `POST /internal/authorise` when routes need `requiredRoles` or `{ branchScope: true }`.

`JWT_SECRET` must match across `workers/api`, `workers/auth-service`, `workers/lpg-service`, and `workers/booking-service` in local dev.

## Contracts

### 1) Gateway proxy — booking routes

`workers/api` must proxy responses with:

- identical HTTP status codes
- identical JSON bodies (or pass-through for `204`/empty)
- identical content-type headers where relevant
- forwarded `Authorization`, `X-Device-ID`, `X-Device-Name` headers

The gateway should avoid re-wrapping errors; the goal is contract parity for all clients.

**Known envelope exceptions (must be preserved):** document per-route envelope rules in `workers/booking-service/CLAUDE.md` and `docs/guides/api-endpoints.md` — match existing api worker behaviour (e.g. `calendar` returns raw `CalendarBooking[]`; `export` is CSV; `rewards.balance` / `rewards.redeem` are unenveloped).

### 2) Search — vertical dispatcher

Gateway handler (replaces current `searchApp` logic):

```
GET /api/v1/search?vertical=booking|commerce&...
  vertical=commerce  → LPG_SERVICE.fetch(same URL + headers)
  vertical=booking (default) → BOOKING_SERVICE.fetch(same URL + headers)
```

Each worker implements `GET /api/v1/search` with the full OpenAPI query schema; each strategy ignores params it does not use. Response shape unchanged: `{ data: SearchResultRow[], aiRanked: boolean }`.

| Worker | Strategy | Bindings |
| --- | --- | --- |
| `booking-service` | `booking-strategy.ts` (D1 LIKE + optional `TALASH_AI` re-rank) | `TALASH_DB`, `TALASH_AI` |
| `lpg-service` | `commerce-strategy.ts` (area / Haversine) | `TALASH_DB` |

### 3) Walk-in — vertical dispatcher

Gateway resolves vertical once per request:

```
branchId → D1: branches.businessId → businesses.vertical
Cache: KV branch:<id>:vertical, TTL 5 min
```

| Endpoint | Dispatch |
| --- | --- |
| `GET /context?branchId=` | Route to worker matching branch vertical |
| `POST /submit` | Assert `body.vertical` matches branch vertical (422 on mismatch); route to matching worker |
| `POST /sync` | Fan-out: split `entries[]` by `entry.vertical`; call both workers if needed; merge `{ synced: { ...a, ...b } }` |
| `POST /branch-qr` | Route by `body.branchId` vertical |
| `POST /sessions` | Route by `body.branchId` vertical |
| `GET /receipts` | Fan-in: call both workers; merge `{ bookings: [...], orders: [...] }` |

**Per-worker walk-in scope:**

| Concern | `booking-service` | `lpg-service` |
| --- | --- | --- |
| Context catalog | `services[]` snapshot | `products[]` snapshot |
| Submit | Creates walk-in booking (Confirmed) | Creates walk-in order via `createCounterWalkIn` |
| Idempotency | `findByWalkInLocalId` on bookings | `findByWalkInLocalId` on orders |
| Sync | `vertical=booking` entries only | `vertical=commerce` entries only |
| KV sessions | `walk-in:session:*` (shared KV namespace) | Same |
| QR signing | `qr-sign.ts` + `JWT_SECRET` | Same |

Shared protocol types remain in `@repo/walk-in-sync`. No client changes.

### 4) Reused internal endpoint — `POST /internal/authorise`

Defined and owned by `workers/auth-service`. `workers/booking-service` is a consumer only. See [auth-service split design](2026-06-16-auth-service-split-design.md) for the full contract.

## Code ownership after split

### `workers/booking-service` owns

- `/api/v1/services/*` routes and `ServicesService`
- `/api/v1/bookings/*` routes and `BookingsService`
- `/api/v1/team/*` routes, `TeamService`, `StaffAvailabilityService`
- `/api/v1/coupons/*`, `/api/v1/reviews/*`, `/api/v1/rewards/*`
- `/api/v1/analytics/*`, `/api/v1/campaigns/*`, `/api/v1/customers/*`
- `booking-strategy.ts` and booking `GET /api/v1/search`
- Booking walk-in: context, submit, sync (booking entries), branch-qr, sessions, receipts (bookings leg)
- Booking-scoped `AuthorizationService` with methods:
  - `assertBusinessOwner`, `assertBranchAccess`, `assertBranchOwner`
  - `assertServiceAccess`, `assertBookingAccess`, `assertCustomerOwnsBooking`
  - `assertCouponOwner`, `assertReviewOwner`, `assertTeamMemberOwner`, `assertTeamMemberAccess`
- Hono app, middleware (cors, exceptions, auth, auth-guard, query-parser, timeout, services injection)
- Ported tests under `src/__tests__/modules/`

### `workers/lpg-service` gains

- `commerce-strategy.ts` and commerce `GET /api/v1/search`
- Commerce walk-in: context (products), submit order, sync (commerce entries), branch-qr, sessions, receipts (orders leg)
- `OrdersService.createCounterWalkIn` moves with commerce walk-in

### `workers/api` owns

- `businesses`, `branches`, `notifications`, `favourites`, `demo-requests` modules
- Gateway proxy routing for all booking and commerce prefixes
- Vertical dispatch handlers for `/search` and `/walk-in`
- Trimmed `AuthorizationService` — `assertBusinessOwner`, `assertBranchAccess`, `assertBranchOwner` only
- Local JWT verification for shared-shell routes (unchanged)

### `packages/core` owns (unchanged)

- DB schema, repositories, queue types, notifications

### `packages/api-client` owns (unchanged)

- Endpoint paths and types — no breaking changes

## Deployment & configuration

### `workers/booking-service` bindings

| Binding | Type | Used for |
| --- | --- | --- |
| `TALASH_DB` | `D1Database` | Services, bookings, team, coupons, reviews, rewards, analytics, campaigns, customers |
| `TALASH_STORAGE` | `R2Bucket` | Service photo uploads |
| `TALASH_QUEUE` | `Queue` | `notification.booking_*`, `rewards.credit` |
| `TALASH_KV` | `KVNamespace` | Walk-in session tokens |
| `TALASH_AI` | `Ai` | Booking search AI re-rank |
| `AUTH_SERVICE` | Service | `POST /internal/authorise` |

**Env/secrets (at minimum):** `JWT_SECRET`, `PUBLIC_R2_URL`

Worker name: `talash-booking-service` (binding `BOOKING_SERVICE` in gateway).

### `workers/api` additions

- **Service Binding:** `BOOKING_SERVICE` pointing at `workers/booking-service`
- Keeps existing bindings and `AUTH_SERVICE`, `LPG_SERVICE` as today.
- **KV** used for `branch:<id>:vertical` dispatch cache (existing `TALASH_KV`).

## Alternatives considered

| Approach | Why not chosen |
| --- | --- |
| Gateway terminates auth, forwards trusted headers to booking-service | Weak trust boundary; diverges from auth/lpg pattern |
| Package extract only (`@repo/booking-api` in api worker) | Does not achieve independent deploy (user goal) |
| Core booking only in v1 (defer coupons, analytics, etc.) | User chose full booking-vertical scope |
| Keep walk-in entirely in gateway | Walk-in deploys with gateway; blocks independent booking deploy |
| Move all walk-in to booking-service | Commerce walk-in would stay coupled to booking worker |
| `salon-service` naming | Diverges from `vertical = "booking"` schema enum |

## Migration plan (phased, reversible)

### Phase 0 — Scaffold

- Create `workers/booking-service` (Cloudflare Worker scaffold).
- Wire wrangler bindings (D1, R2, Queue, KV, AI, AUTH_SERVICE).
- Add workspace package + dev script.
- `GET /health` with D1 probe.
- Gateway: add `BOOKING_SERVICE` binding (no routes proxied yet).

### Phase 1 — Core booking move

- Port `services`, `bookings`, `team`, `staff-availability` modules + tests.
- Gateway proxy `/api/v1/services/*`, `/bookings/*`, `/team/*`.
- Remove ported modules from `workers/api` routes/installers.

### Phase 2 — Owner + customer booking features

- Port `coupons`, `reviews`, `rewards`, `analytics`, `campaigns`, `customers` modules + tests.
- Gateway proxy all six prefixes.
- Trim unused booking methods from `workers/api` `AuthorizationService`.

### Phase 3 — Search split

- Move `booking-strategy.ts` → `booking-service`; add `GET /search` there.
- Move `commerce-strategy.ts` → `lpg-service`; add `GET /search` there.
- Gateway replaces `searchApp` with vertical dispatcher.
- Port `commerce-strategy.integration.test.ts` to `lpg-service`.

### Phase 4 — Walk-in split

- Extract booking walk-in logic → `booking-service`.
- Extract commerce walk-in logic → `lpg-service` (including `createCounterWalkIn` path).
- Gateway walk-in dispatcher (vertical resolve + fan-out/fan-in for sync/receipts).
- Port walk-in tests to both workers; gateway dispatch integration tests.

### Phase 5 — Cleanup & ops

- Add `booking-service` to `dev:all` / root scripts.
- Staging + production wrangler envs for `talash-booking-service`.
- Gateway proxy parity tests per booking prefix.
- Documentation updates (see below).

Each phase is independently deployable and reversible.

## Testing

- **booking-service**
  - Service unit tests (ported from api worker).
  - Route integration tests via `app.request()`.
  - Auth-guard tests with mocked `AUTH_SERVICE`.
  - Repository integration tests for booking overlap / slot conflict SQL.
  - Walk-in booking path tests (slot conflict, idempotency, guest vs signed-in).

- **lpg-service (additions)**
  - Commerce search integration test (ported).
  - Walk-in commerce path tests (stock conflict, idempotency).

- **Gateway (`workers/api`)**
  - Proxy parity tests per booking prefix (status + body match).
  - Search dispatch tests (`vertical=booking` → booking-service, `vertical=commerce` → lpg-service).
  - Walk-in dispatch tests (vertical resolve, sync fan-out, receipts fan-in).
  - Regression: `businesses`/`branches`/`notifications` unaffected.

- **Clients**
  - `packages/api-client` tests continue to pass without path changes.

## Local dev

Full stack requires four workers:

```sh
bun run api:dev                                    # gateway (8787)
bun run --filter @repo/auth-service dev            # authorise
bun run --filter @repo/lpg-service dev             # commerce + commerce search/walk-in
bun run --filter @repo/booking-service dev         # booking vertical
```

`JWT_SECRET` must align across all four workers in `env.local`.

## Documentation updates (during implementation)

- `docs/architecture.md` — add booking-service to worker diagram and request path.
- `docs/guides/api-endpoints.md` — clarify booking routes are served by booking-service behind the gateway.
- `workers/api/CLAUDE.md` — describe gateway proxy for booking prefixes + vertical dispatch.
- New `workers/booking-service/CLAUDE.md` — document booking-service responsibilities and layering.
- `workers/lpg-service/CLAUDE.md` — note commerce search + walk-in additions.

## Deferred (v2+)

- Extract shared `AuthorizationService` into `@repo/core`.
- Cross-service authz caching.
- Vertical-specific notification routing worker.
