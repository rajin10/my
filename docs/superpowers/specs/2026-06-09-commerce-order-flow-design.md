# Commerce order flow — design (Phase 1, slice 2)

**Date:** 2026-06-09
**Scope:** The order-flow slice of Phase 1 commerce — `customer_addresses`, `orders`, `order_items`, end-to-end across customer (mobile-app) and owner (owner-app), thin on each surface.
**Out of scope (next slice):** `payments` table, khata due-ledger derivation, owner "customer dues" view.

## Context & source of truth

- Phase 0 (`venue → business` rename + `vertical`) and the `products` slice of Phase 1 (issue
  [#71](https://github.com/hasib-devs/Talash/issues/71)) are **done and merged to `develop`**.
- Schemas, the khata model, the atomic-stock invariant, the module plan, and migration
  verification steps are already specified in
  [docs/plan/multi-vertical-schema-design.md](../../plan/multi-vertical-schema-design.md)
  ("Phase 1 — commerce (LPG) tables", line ~128). This spec does **not** re-derive them;
  it scopes the order-flow subset and records the implementation decisions.
- Decisions: [ADR-0004](../../adr/0004-multi-vertical-platform-extension.md).
- Reference implementation to mirror in every layer: the merged `products` slice.

## Decisions (resolved in brainstorming)

1. **Scope** = order flow only (`customer_addresses` + `orders` + `order_items`). Khata/payments
   is a separate later slice.
2. **UI surface** = both actors, thin. Customer places/lists/cancels; owner views incoming orders
   and advances status.
3. **Module organization** = per-resource modules (`modules/orders/`, `modules/customer-addresses/`),
   matching the standalone `products` module #71 shipped — not the doc's earlier "commerce module"
   wording. `order_items` has no standalone routes; it is managed inside the orders service/repo.
4. **Migration** = hand-author `0014_commerce_orders.sql` (mirroring how `0012`/`0013` were done),
   register in `_journal.json`. Repairing the missing `meta/` snapshots (`0007`/`0012`/`0013`) is a
   **separate follow-up**, deliberately off this slice's critical path (it would re-propose the
   data-preserving `0012` rename).

## 1. Data layer

Three new schema files in `packages/core/src/database/schema/`, **verbatim from the design doc**,
re-exported from `schema/index.ts`:

- `orders.schema.ts` — doc line ~180. `business_id` denormalised onto the row (khata aggregation);
  `OrderStatus` enum; delivery address **snapshot** columns; `deliveredAt`; indexes incl.
  `orders_business_user_idx`.
- `order_items.schema.ts` — doc line ~228. `unit_price` snapshot; `CHECK(quantity > 0)`
  (`order_items_qty_positive`); `onDelete: cascade` from order.
- `customer-addresses.schema.ts` — doc line ~287. Self-scoped, `isDefault` flag.

Repositories in `packages/core/src/database/repositories/`:

- `orders.repository.ts` — constructor `(db: DbClient)`, delegates to `BaseRepository`. Defines a
  `private static readonly queryAllowlist: QueryAllowlist` (filterable: `status`; sortable:
  `createdAt`, `total`; selectable: the public columns). **Also owns `order_items` access** (insert
  batch, fetch items by order) since items are never queried independently.
- `customer-addresses.repository.ts` — self-scoped address book.

Migration: hand-authored `workers/api/src/database/migrations/0014_commerce_orders.sql`
(`CREATE TABLE orders`, `order_items`, `customer_addresses` — additive, zero risk to bookings),
registered in `_journal.json`. **Verify** the generated SQL contains the `order_items_qty_positive`
CHECK (drizzle-kit has dropped CHECK clauses before — doc line ~413). Add CLI seeders for orders +
addresses per [docs/guides/cli.md](../../guides/cli.md).

## 2. API surface

Two per-resource modules, each `src/modules/<name>/` with `index.ts` (routes + `*App` +
`install*Service` exports) and `<name>.service.ts`, mounted in `modules/routes.ts`.

### `modules/orders/` → `ordersApp` at `/v1/orders`

| Route | Actor / guard | Behavior |
| --- | --- | --- |
| `POST /` | customer (`authenticate`) | Place order: `{ branchId, items: [{ productId, quantity }], addressId }`. Atomic batch — §3. |
| `GET /` | customer (self) | Caller's own orders, paginated envelope. |
| `GET /:id` | customer-owner **or** branch-staff | Order detail + items. Authorize via `assertCustomerOwnsOrder` OR `assertOrderAccess`. |
| `GET /branch?branchId=&businessId=&status=` | owner/manager, `{ branchScope: true }` | Fulfillment queue. Mirrors `bookings/branch` (accepts `branchId` or `businessId`). |
| `PATCH /:id/status` | owner/manager (branch-scoped) | Advance status machine — §4. |
| `PATCH /:id/cancel` | customer (Pending/Confirmed) **or** owner | Cancel + restore stock atomically — §3. |

### `modules/customer-addresses/` → at `/v1/customer-addresses`

Fully self-scoped behind `authenticate`: `GET /` (caller's addresses), `POST /`, `PATCH /:id`,
`DELETE /:id`. All assert `assertCustomerOwnsAddress` (except create/list). Setting `isDefault: true`
unsets the previous default in the same `db.batch()`.

### Authorization — extend `AuthorizationService` (`src/core/authorization.ts`)

- `assertOrderAccess(actorId, orderId, scopedBranchIds)` → branch-staff view; chains
  order → branch → business owner. Mirrors `assertBookingAccess`.
- `assertCustomerOwnsOrder(userId, orderId)` → mirrors `assertCustomerOwnsBooking`.
- `assertCustomerOwnsAddress(userId, addressId)`.

Missing resource → 404; found-but-unauthorized → 403 (house convention).

## 3. Atomic order placement & cancellation (the commerce invariant)

Per doc §333 ("commerce invariant in code", D1-native). D1 has no interactive transactions; use
`db.batch()` (atomic — any statement failing aborts the whole sequence).

`OrdersService.create`:
1. Resolve `branch` → derive `businessId`; assert it equals `branch.businessId` (the denormalisation
   guard; never changes after creation).
2. Resolve the chosen `customer_address` (must belong to caller) → **snapshot** into `delivery_line`,
   `delivery_area`, `delivery_city`, `delivery_lat`, `delivery_lng`.
3. Snapshot each `product.price` into `order_items.unit_price`; compute `total = Σ(qty × unit_price)`.
4. Optional pre-read of stock for a friendly "out of stock" message.
5. One `db.batch([...])`:
   - per line: unconditional `stock = stock - qty` (the `CHECK(stock >= 0)` aborts the batch on
     oversell — a `WHERE stock >= qty` conditional is the **trap**, doc line ~342),
   - insert `orders` row (status `Pending`),
   - insert `order_items` rows.
6. **Catch the SQLite CHECK-constraint error from `batch()` and map to `ConflictError` (409)**
   "out of stock" — otherwise a normal stock race surfaces as a 500 (doc line ~361).

**Cancellation** (`PATCH /:id/cancel`, allowed from `Pending`/`Confirmed` only): one `db.batch()`
of per-line `stock = stock + qty` updates plus the `status = 'Cancelled'` update — same
all-or-nothing shape.

## 4. Order status machine

`OrdersService.updateStatus` enforces valid transitions (same pattern as business-status / bookings):

```
Pending → Confirmed → OutForDelivery → Delivered
Pending → Cancelled
Confirmed → Cancelled
```

Any other transition → `ValidationError` (422). Setting `Delivered` stamps `deliveredAt` (the moment
the order becomes a khata debit — khata derivation itself is the next slice; `deliveredAt` is the
seam it will read).

## 5. api-client (`packages/api-client/src/endpoints/`)

- `orders.ts` — `create`, `listMine`, `get`, `listByBranch`, `updateStatus`, `cancel`; types
  `Order`, `OrderItem`, `OrderStatus`, `OrderWithItems`.
- `customer-addresses.ts` — `list`, `create`, `update`, `remove`; type `CustomerAddress`.
- Both registered on the api-client index, mirroring `products.ts`.

## 6. UI — both actors, thin

Both Expo apps: new wiring in `src/hooks/` (not `context.tsx`); API→UI mapping in `src/lib/adapters.ts`.
After mutations use `invalidateQueries` (not `refetch`).

**Customer (mobile-app):**
- `CommerceBusinessScreen` gains quantity steppers + a lightweight **local-state cart** and a
  **Checkout** action → pick or add a delivery address → `orders.create`. On 409 show "out of stock".
- A **My Orders** list + detail (status + items), reachable from the account/bookings area.
- Hooks: `useCreateOrder`, `useMyOrders`, `useOrder`, `useCancelOrder`, `useAddresses`, `useSaveAddress`.

**Owner (owner-app):** registry-driven per ADR-0004, surfaced only when `business.vertical === 'commerce'`:
- **Incoming Orders** list (`orders.listByBranch`) with status filter + detail view with
  status-advance buttons (Confirm → Out for delivery → Delivered) and cancel.
- Hooks in `src/hooks/`, adapters in `src/lib/adapters.ts`.

Kept thin (YAGNI): local-state cart (no persisted cart table), reuse existing list/card components,
no order search/export this slice.

## 7. Testing (mirror the `products` two-layer strategy)

- **Service unit tests** `__tests__/modules/orders/orders.service.test.ts`: stock-decrement happy
  path; **oversell → batch aborts, no order row, mapped to 409**; price + address snapshotting;
  `businessId`-consistency guard; status-machine valid + invalid transitions; cancel restores stock;
  ownership (customer vs branch-staff).
- **Route tests** `orders.routes.test.ts`, `customer-addresses.routes.test.ts`: auth guards,
  self-scoping, 422 on bad transition, response shapes via `app.request()`.
- Addresses service tests: self-scope + single-default invariant.

## 8. Documentation (required, same PR)

- `workers/api/CLAUDE.md` — add Orders + Customer Addresses sections.
- `docs/guides/api-endpoints.md` — new routes.
- `docs/guides/api-query-repository-pattern.md` — orders query allowlist.
- `docs/guides/ui-backend-sync.md` — new hooks.
- `docs/plan/multi-vertical-schema-design.md` — mark the order-flow portion of Phase 1 done; note
  payments/khata remain.

## 9. Gates before "done" (AGENTS.md policy)

`bun run lint`, `bun run test` (api: `bun run api:test`), `bun run build` — all green. After
migration generation: grep `0014` SQL for the qty CHECK; `bun run cli db fresh` to confirm seeders
run. Verify completion against the codebase before reporting done.

## 10. Suggested commit shape (mirror #71's 4 commits)

1. `feat(core): orders + order_items + customer_addresses schema + repositories + migration 0014`
2. `feat(api): orders + customer-addresses modules + assertOrderAccess/Owns guards`
3. `feat(api-client): orders + customer-addresses endpoints + types`
4. `feat(mobile-app): commerce order placement + my-orders`
5. `feat(owner-app): incoming orders + status machine UI`

(Steps 4–5 may merge into one owner+customer UI commit if small; each references the issue.)
