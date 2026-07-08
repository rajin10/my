# LPG Service — agent guide

`workers/lpg-service` is a separately deployed Cloudflare Worker that owns **commerce (LPG) API modules** for Talash.

## Responsibilities

- **Public endpoints (via gateway):**
  - `/api/v1/products/*` — branch-scoped catalog + stock
  - `/api/v1/orders/*` — placement, fulfilment, status machine
  - `/api/v1/customer-addresses/*` — delivery address book
  - `/api/v1/payments/*` — owner-recorded cash receipts (khata)
  - `/api/v1/khata/*` — derived due ledger
  - `GET /api/v1/search` — commerce vertical only (`commerce-strategy.ts`)
  - `/api/v1/walk-in/*` — commerce walk-in paths (context, submit, sync entries, branch QR, sessions, order receipts)

Frontends keep calling `workers/api`; the gateway proxies commerce prefixes via the **`LPG_SERVICE` Service Binding`. `/api/v1/search` and `/api/v1/walk-in` are dispatched by the gateway (search by `?vertical=commerce`, walk-in by branch vertical).

## Auth

- Local JWT verify via `SessionTokens.verify` (same pattern as auth-service).
- Role + branch scope: `POST /internal/authorise` on `auth-service` when `requireAuth({ branchScope: true })`.

## Module layout

Same pattern as `workers/api`:

```
src/modules/products/
src/modules/orders/
src/modules/customer-addresses/
src/modules/payments/
src/modules/khata/
src/modules/search/          # commerce-strategy only
src/modules/walk-in/         # commerce walk-in only
src/core/authorization.ts   # commerce-scoped ownership checks
```

Repositories and schema live in `@repo/core`.

## Cloudflare bindings

| Binding | Type | Used for |
| --- | --- | --- |
| `TALASH_DB` | `D1Database` | Commerce tables |
| `TALASH_KV` | `KVNamespace` | Walk-in sessions, branch QR state |
| `TALASH_STORAGE` | `R2Bucket` | Product photos |
| `TALASH_QUEUE` | `Queue` | Order status notifications |
| `AUTH_SERVICE` | Service | `POST /internal/authorise` |

Required secrets: `JWT_SECRET`, `PUBLIC_R2_URL`.

## Local dev

Commerce routes require **four workers** (gateway + auth + lpg; add booking for booking search/walk-in):

```sh
bun run api:dev
bun run auth-service:dev
bun run lpg-service:dev
# optional for booking vertical search/walk-in:
bun run booking-service:dev
```

Or use `bun run dev:all` from the monorepo root.

`JWT_SECRET` must match across all workers in `env.local`.

## Testing

```sh
bun run --filter @repo/lpg-service test
```

## Related docs

- Design: [../../docs/superpowers/specs/2026-06-16-lpg-service-split-design.md](../../docs/superpowers/specs/2026-06-16-lpg-service-split-design.md)
- Gateway proxy + dispatch: [../api/CLAUDE.md](../api/CLAUDE.md)
- Plan (booking split): [../../docs/superpowers/plans/2026-06-16-booking-service-split.md](../../docs/superpowers/plans/2026-06-16-booking-service-split.md)
