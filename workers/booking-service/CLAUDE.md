# Booking Service — agent guide

`workers/booking-service` is a separately deployed Cloudflare Worker that owns **booking-vertical API modules** for Talash.

## Responsibilities

- **Public endpoints (via gateway):**
  - `/api/v1/services/*` — branch-scoped service catalog + photos
  - `/api/v1/bookings/*` — appointment lifecycle, calendar, export
  - `/api/v1/team/*` — team CRUD + staff availability (`/:id/availability`)
  - `/api/v1/coupons/*` — owner coupons + customer validate
  - `/api/v1/reviews/*` — published reviews, moderation, mine
  - `/api/v1/rewards/*` — points balance, history, redeem
  - `/api/v1/analytics/*` — owner-only business analytics
  - `/api/v1/campaigns/*` — owner-only CRM campaigns
  - `/api/v1/customers/*` — owner-only customer visit history
  - `GET /api/v1/search` — booking vertical only (`booking-strategy.ts`)
  - `/api/v1/walk-in/*` — booking walk-in paths (context, submit, sync entries, branch QR, sessions, booking receipts)

Frontends keep calling `workers/api`; the gateway proxies booking prefixes via the **`BOOKING_SERVICE` Service Binding**. `/api/v1/search` and `/api/v1/walk-in` are dispatched by the gateway (search by `?vertical=`, walk-in by branch vertical).

## Auth

- Local JWT verify via `SessionTokens.verify` (same pattern as auth-service and lpg-service).
- Role + branch scope: `POST /internal/authorise` on `auth-service` when `requireAuth({ branchScope: true })`.
- `AuthorizationService` (`src/core/authorization.ts`) owns booking-vertical ownership checks (`assertServiceAccess`, `assertBookingAccess`, `assertCouponOwner`, etc.). Shell checks (`assertBusinessOwner` on businesses/branches) remain in the gateway.

## Module layout

Same pattern as `workers/api` and `workers/lpg-service`:

```
src/modules/services/
src/modules/bookings/
src/modules/team/
src/modules/staff-availability/
src/modules/coupons/
src/modules/reviews/
src/modules/rewards/
src/modules/analytics/
src/modules/campaigns/
src/modules/customers/
src/modules/search/          # booking-strategy only
src/modules/walk-in/         # booking walk-in only
src/core/authorization.ts
```

Repositories and schema live in `@repo/core`.

## Cloudflare bindings

| Binding | Type | Used for |
| --- | --- | --- |
| `TALASH_DB` | `D1Database` | Booking tables |
| `TALASH_KV` | `KVNamespace` | Walk-in sessions, branch QR state |
| `TALASH_STORAGE` | `R2Bucket` | Service photos |
| `TALASH_QUEUE` | `Queue` | Booking notifications (`notification.booking_created`, etc.) |
| `TALASH_AI` | `Ai` | Search re-ranking (`sortBy=recommended`) |
| `AUTH_SERVICE` | Service | `POST /internal/authorise` |

Required secrets: `JWT_SECRET`, `PUBLIC_R2_URL`.

## Local dev

Booking routes require **four workers** (gateway + auth + booking; add lpg for commerce search/walk-in):

```sh
bun run api:dev
bun run auth-service:dev
bun run booking-service:dev
# optional for commerce vertical search/walk-in:
bun run lpg-service:dev
```

Or use `bun run dev:all` from the monorepo root (starts auth, lpg, booking, api, queue, scheduled, and frontends).

`JWT_SECRET` must match across all workers in `env.local`.

## Testing

```sh
bun run --filter @repo/booking-service test
```

## Related docs

- Plan: [../../docs/superpowers/plans/2026-06-16-booking-service-split.md](../../docs/superpowers/plans/2026-06-16-booking-service-split.md)
- Gateway proxy + dispatch: [../api/CLAUDE.md](../api/CLAUDE.md)
- Architecture: [../../docs/architecture.md](../../docs/architecture.md)
