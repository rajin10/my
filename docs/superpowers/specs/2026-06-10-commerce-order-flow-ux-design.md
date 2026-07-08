# Commerce order flow — UX + notifications design (Phase 1, slice 3)

**Date:** 2026-06-10
**Scope:** Complete the commerce order flow on top of the merged backend (PR #77): customer
mobile-app ordering UI, owner-app fulfillment UI, and status-change notifications. Closes the
remaining acceptance criteria of [#72](https://github.com/hasib-devs/Talash/issues/72) and
[#73](https://github.com/hasib-devs/Talash/issues/73).
**Builds on:** the order-flow backend — `orders`/`order_items`/`customer_addresses` tables, the
`/api/v1/orders` + `/api/v1/customer-addresses` modules, and the `@repo/api-client` `orders` /
`customerAddresses` endpoint groups (all on `develop` @ `9308c34`).
**Out of scope:** payments + khata (#74), commerce discovery/search (#75).

## Decisions (resolved in brainstorming)

1. **One connected slice** — customer UI + owner UI + notifications together.
2. **Owner fulfillment** lives in a **vertical-aware activity tab** — extend `ownerExperiences.ts`
   so the booking-vertical Today/Bookings surface renders **Incoming Orders** for commerce-vertical
   owners (same registry mechanism as the existing catalog tab; route name unchanged per ADR-0004).
3. **Customer My-Orders** lives in the **Account area + a detail sheet** (mirror `BookingDetailSheet`),
   not a new tab.
4. **Notifications** — in-app feed **+ Expo push**, on every owner-driven change
   (`Confirmed`/`OutForDelivery`/`Delivered`/`Cancelled`); reuse the booking queue→worker chain.
5. **Owner-cancel** is added (small backend path) — an owner who can't fulfill must be able to cancel
   and restore stock (#73). Cancellation (customer or owner) funnels through the existing
   restore-aware `cancelAndRestore` (Pending/Confirmed only).
6. **Cart** is local in-memory state — no persisted cart table (YAGNI).

## 1. Notifications (backend chain — reuse the booking pattern)

Bookings notify via `OrdersService`-style `queue.send(...)` → the **queue worker**
(`workers/queue/src/handler.ts`) creates the in-app notification + Expo push. Orders mirror this:

- **Job type:** add `notification.order_status_changed` (`{ orderId, status, requestId? }`) to the
  `JobPayload` union in `packages/core/src/queue/jobs.ts`.
- **`OrdersService`** gains a `QueueProducer` dep (already in `SharedDeps`; `installOrdersService`
  passes it). After a successful `updateStatus` **and** after `cancel`, it sends the job. Customer
  *placement* does not notify (only owner-driven changes + cancellation).
- **Queue handler:** handle `notification.order_status_changed` — load the order, create a
  notification row for `order.userId` with a per-status title/body, `go: "orders"`, `orderId`; if the
  user has a `pushToken`, send Expo push (reuse the existing booking push helper).
- **Schema extension — migration `0015`:** `ALTER TABLE notifications ADD COLUMN order_id text`
  (plain nullable text, **no FK** — mirrors the existing `booking_id`/`review_id` columns which are
  unconstrained `text()`; additive, low risk). `notifications.go` is free text (`text()`, not an
  enum), so the new `"orders"` value needs no DDL. Update `notificationsSchema` + re-export.
- **DTO + api-client:** `NotificationDto` and the `@repo/api-client` `Notification` type gain
  `orderId: string | null` and accept `go: "orders"`, so the mobile feed can deep-link to an order.

## 2. Owner-cancel (the #73 gap)

Generalize cancellation to support owners. `OrdersService.cancel(actorId, orderId, opts?: { asOwner?: boolean, scopedBranchIds?: string[] | null })`:
- customer (default): `assertCustomerOwnsOrder`;
- owner (`asOwner: true`): `assertOrderAccess(actorId, orderId, scopedBranchIds)`.
Both then run the existing Pending/Confirmed guard + `cancelAndRestore`, and both fire the
`notification.order_status_changed` job (status `Cancelled`).

**Routing:** the owner cancels via the **existing** `PATCH /api/v1/orders/:id/status` with
`status:"Cancelled"` (the status route widens its enum to accept it), special-cased inside
`updateStatus` to route through the restore-aware path. This avoids a second
`PATCH /:id/cancel` route, which the customer app (mounted first, `authenticate`-only) would shadow
for an owner token. The customer `PATCH /:id/cancel` is unchanged. A shared private `doCancel` helper
backs both the customer `cancel` and the owner `updateStatus('Cancelled')` path.

## 3. Customer mobile-app

Layering: api-client → hooks (`src/hooks/`) → screen/sheet; API↔UI in `src/lib/adapters.ts`; money via
`en-BD` BDT (`src/lib/format.ts`); after mutations `invalidateQueries` (not `refetch`).

**Hooks (new, `src/hooks/`):**
- `useBranchProducts(branchId)` — wraps `client.products.list` (reuse).
- `useAddresses()` / `useSaveAddress()` / (delete) — `client.customerAddresses.*`.
- `useCreateOrder()`, `useMyOrders()`, `useOrder(id)`, `useCancelOrder()` — `client.orders.*`.
- Cart is local component state (a small `useCart` hook or screen-local reducer) — no server cart.

**Screens:**
- **`CommerceBusinessScreen`** (currently a placeholder): product list with qty steppers → local
  cart summary → **Checkout**: choose a saved address or add one inline → `useCreateOrder`. On `409`
  show "out of stock"; on success navigate to the created order / My Orders.
- **My Orders:** an "Orders" entry in `AccountScreen` → orders list (`useMyOrders`).
- **`OrderDetailSheet`** (mirror `BookingDetailSheet`): status, line items, delivery snapshot, total;
  **Cancel** action when status ∈ {Pending, Confirmed} (`useCancelOrder`).
- **Notifications deep-link:** `NotificationsScreen` routes `go: "orders"` (with `orderId`) to the
  order detail.

## 4. Owner-app

- **Vertical-aware activity experience:** extend `src/lib/ownerExperiences.ts` so the activity/Today
  surface is vertical-aware (booking → existing bookings/Today; commerce → **Incoming Orders**),
  mirroring `ownerCatalogExperience`. Route name unchanged; label/icon/screen swap by
  `business.vertical`.
- **Hooks (`src/hooks/`):** `useBranchOrders(branchId|businessId)` (`client.orders.listByBranch`),
  `useUpdateOrderStatus()` (`client.orders.updateStatus`), `useCancelOrder()` (owner cancel route).
  Adapters in `src/lib/adapters.ts`.
- **`IncomingOrdersScreen`:** orders list grouped/filterable by status; order detail with
  advance-status actions (Confirm → Out for delivery → Delivered) + **Cancel** (Pending/Confirmed).
  Each action calls the API then `invalidateQueries`. Status transitions are enforced server-side
  (forward-only); the UI only offers the next valid action(s).

## 5. Testing

- **Backend:** queue-handler unit test for `notification.order_status_changed` (creates a
  notification row, attempts push when `pushToken` present); `OrdersService` tests — `updateStatus`
  and both cancel paths enqueue the job; **owner-cancel restores stock via `assertOrderAccess`** and
  rejects a non-owner/cross-branch actor (403); migration `0015` grep (column present); `NotificationDto`
  carries `orderId`/`go:"orders"`. New owner-cancel route test (200 owner, 403 customer, 422 bad state).
- **Mobile + owner:** hook tests + `src/lib/adapters.test.ts` additions (both apps already have adapter
  tests); a status-action component test mirroring owner `__tests__/TodayScreen.status.test.tsx`.
  Follow each app's existing test conventions.

## 6. Docs (same PRs)

`docs/guides/api-endpoints.md` (owner-cancel route + notification deep-link), `docs/guides/ui-backend-sync.md`
(new hooks for both apps), `workers/api/CLAUDE.md` (owner-cancel + order notifications), app
`AGENTS`/`CLAUDE` notes, and tick the now-complete acceptance items on #72/#73.

## 7. Gates before "done"

`bun run lint`, `bun run api:test` / app test scripts, `bun run build` — interpret as **touched files
clean + zero new errors/failures vs the pre-existing red baselines** (Biome ~48, `tsc -p workers/api` 8,
`api:test` 20 — verify by stash-diff). For the migration: `bun run cli db fresh` clean.

## 8. Suggested decomposition for the plan(s)

This slice has three loosely-coupled surfaces. Likely **three plans** executed in order, each
shippable: (1) **notifications + owner-cancel** (backend: core/queue/api + migration 0015) — unblocks
deep-linking and owner cancel; (2) **customer mobile UI**; (3) **owner-app UI**. (2) and (3) both
depend only on the already-merged api-client + (1)'s owner-cancel route. The writing-plans step will
decide whether to author one combined plan or three.
