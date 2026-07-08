# Order Cancel Atomicity + Notification Fixes — Design

**Date:** 2026-06-13
**Status:** Approved (design); pending implementation plan
**Origin:** Feature review of *Order Notifications + Owner-Cancel* (`docs/superpowers/plans/2026-06-10-order-notifications-owner-cancel.md`). This spec addresses all findings from that review: one HIGH data-integrity bug and four LOW issues.

## Goal

Make order cancellation and status transitions **atomic and idempotent** so concurrent or duplicate writes can no longer double-restore stock or strand an active order with no stock, and clean up four lower-severity issues in the same feature (undeliverable notification jobs, a stale response snapshot, a missing customer-feed icon mapping, and stale migration references in docs).

## Background — the bug being fixed

`OrdersService.doCancel` checks the order's status from a snapshot loaded **outside** the write batch (`assertOrderAccess` / `assertCustomerOwnsOrder`), then calls `OrdersRepository.cancelAndRestore`, whose `db.batch()` restores stock (`stock + qty`) and flips status to `Cancelled` **unconditionally** (`WHERE id = …`, no status predicate). The forward path (`repo.updateStatus`) is likewise an unconditional flip.

Root cause: **non-transactional read + unconditional batch writes.** SQLite/D1 serializes the two write transactions, but the second writer's statements re-apply because nothing inside the batch re-asserts the order's current state. Consequences:

- **Double / concurrent cancel** (owner + customer, or a client double-tap): both snapshots read `Confirmed`, both batches run → **stock restored twice** (silent inventory inflation — the exact invariant the placement path protects via `CHECK(stock >= 0)`).
- **Cancel racing a forward transition:** last writer wins on status. If the forward write lands last, the order ends up `OutForDelivery` with **stock already returned** — an active, shipping order holding no stock (effective oversell). If cancel lands last, the customer still gets the "Out for delivery" push enqueued for a now-`Cancelled` order.

The existing unit tests mock the repositories, so this concurrency class is structurally uncatchable by them — not a coverage gap to fault, just why it slipped.

## Decisions

1. **Mechanism:** status-predicated conditional writes inside the existing single `db.batch()` (Approach A). No schema change, no new column, no Durable Object — the status predicate *is* the optimistic-concurrency check.
2. **Race-loser / duplicate semantics:** **idempotent cancel** — a duplicate or concurrent cancel on an already-`Cancelled` order returns success. A cancel on a no-longer-cancellable order, or a forward transition on an order that changed underneath, returns **422** (`ValidationError`, matching the existing order/booking error style). Forward transitions are **not** idempotent; only cancel is.
3. **Scope:** the HIGH guard plus four LOW fixes (below). The two INFORMATIONAL items from the review are explicitly **out of scope** (see end).

## Architecture

Change surface, by layer:

| Layer | File | Change |
| --- | --- | --- |
| Repository | `packages/core/src/database/repositories/orders.repository.ts` | `cancelAndRestore` → conditional + idempotent, returns `boolean`; `updateStatus` → compare-and-swap on expected status |
| Service | `workers/api/src/modules/orders/orders.service.ts` | `doCancel` race resolution + win-only enqueue + guest skip; `updateStatus` cancel branch refetches; forward path CAS + accurate 422 |
| Mobile (customer) | `apps/mobile-app/src/data.ts`, `src/context.tsx`, `src/components/screens/NotificationsScreen.tsx` | add `order` notification type + icon |
| Docs | `workers/api/CLAUDE.md` | correct migration references; document new behavior |
| Tests | `workers/api/src/__tests__/...` + `apps/mobile-app/src/__tests__/...` | real-DB integration test + service unit tests + adapter test |

No route, request, or response **contract** changes. No DB schema/migration change.

### Repository — `cancelAndRestore` (atomic + idempotent)

Returns whether **this** call performed the cancel. **Statement order is load-bearing:** the stock-restore UPDATEs run first, each guarded by the order's still-cancellable status via a correlated subquery; the status flip runs last with `RETURNING`, and its returned-row count is the compare-and-swap result.

```ts
/**
 * Atomic, idempotent cancel. Restores each line's stock and flips the order to
 * Cancelled ONLY while it is still Pending/Confirmed. Returns true if THIS call
 * performed the cancel, false if the order was already in a non-cancellable
 * state (a concurrent or duplicate cancel). Statement order matters: restores
 * run first so their subquery still sees a cancellable status; a serialized
 * second call sees status='Cancelled' and every statement no-ops.
 */
async cancelAndRestore(
  orderId: string,
  items: OrderItemSelect[],
  updatedAt: string,
): Promise<boolean> {
  const results = await this.db.batch([
    ...items.map((it) =>
      this.db.update(productsSchema)
        .set({ stock: sql`${productsSchema.stock} + ${it.quantity}` })
        .where(and(
          eq(productsSchema.id, it.productId),
          sql`(SELECT status FROM orders WHERE id = ${orderId}) IN ('Pending','Confirmed')`,
        )),
    ),
    this.db.update(ordersSchema)
      .set({ status: "Cancelled", updatedAt })
      .where(and(
        eq(ordersSchema.id, orderId),
        inArray(ordersSchema.status, ["Pending", "Confirmed"]),
      ))
      .returning({ id: ordersSchema.id }),
  ]);
  const flipped = results[results.length - 1] as { id: string }[];
  return flipped.length === 1;
}
```

`RETURNING` is used for win-detection (not `meta.changes`) — cleaner through drizzle's batch typing, and pinned by the integration test.

### Repository — `updateStatus` (compare-and-swap)

A new `expectedCurrent` argument; the flip lands only if the DB status still matches what the service loaded. Returns the updated row, or `null` if the status moved underneath.

```ts
// UPDATE orders SET status=:next, ...extra
//   WHERE id=:id AND status=:expectedCurrent RETURNING *
// -> row on success; null when the CAS misses (status changed under us).
async updateStatus(
  id: string,
  status: OrderSelect["status"],
  expectedCurrent: OrderSelect["status"],
  extra: Partial<OrderInsert> = {},
): Promise<ApiResponse<OrderSelect | null>>;
```

### Service — `doCancel` (race resolution)

```ts
private async doCancel(order: OrderSelect): Promise<void> {
  // Idempotent: an order already Cancelled is in the desired state (sequential
  // double-tap whose second request loads Cancelled) — return success, not 422.
  if (order.status === "Cancelled") return;
  // Fast 422 for a terminally non-cancellable order. Status only ever moves
  // forward or to Cancelled, so a loaded OutForDelivery/Delivered is authoritative.
  if (order.status !== "Pending" && order.status !== "Confirmed") {
    throw new ValidationError(`Cannot cancel an order in ${order.status} state`);
  }
  const items = await this.repo.findItems(order.id);
  const didCancel = await this.repo.cancelAndRestore(order.id, items, new Date().toISOString());
  if (!didCancel) {
    // Lost the race / duplicate — re-read to decide the outcome.
    const fresh = await this.repo.findOne(order.id);
    if (fresh.data?.status === "Cancelled") return; // idempotent success
    throw new ValidationError(`Cannot cancel an order in ${fresh.data?.status} state`);
  }
  // We won. Notify only when there is a customer account to notify (LOW-1).
  if (order.userId) {
    await this.queue.send({
      type: "notification.order_status_changed",
      orderId: order.id,
      status: "Cancelled",
    });
  }
}
```

`doCancel` now takes the loaded `OrderSelect` (it needs `userId`), so both callers pass the order they already authorized:

```ts
async cancel(userId: string, orderId: string): Promise<void> {
  const order = await this.authz.assertCustomerOwnsOrder(userId, orderId);
  await this.doCancel(order);
}
```

### Service — `updateStatus`

```ts
async updateStatus(actorId, orderId, next, scopedBranchIds): Promise<OrderSelect> {
  const order = await this.authz.assertOrderAccess(actorId, orderId, scopedBranchIds);

  if (next === "Cancelled") {
    await this.doCancel(order);
    return (await this.repo.findOne(orderId)).data!; // LOW-2: return persisted row, not a synthesized snapshot
  }

  const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
  const counterDelivered =
    order.fulfillment === "counter" && order.status === "Confirmed" && next === "Delivered";
  if (!allowed.includes(next) && !counterDelivered) {
    throw new ValidationError(`Cannot move order from ${order.status} to ${next}`);
  }
  const extra = next === "Delivered" ? { deliveredAt: new Date().toISOString() } : {};
  const result = await this.repo.updateStatus(orderId, next, order.status, extra); // CAS on loaded status
  if (!result.data) {
    const fresh = await this.repo.findOne(orderId); // race-loser: accurate 422
    throw new ValidationError(`Cannot move order from ${fresh.data?.status} to ${next}`);
  }
  if (order.userId) {
    await this.queue.send({ type: "notification.order_status_changed", orderId, status: next });
  }
  return result.data;
}
```

## Data flow — race outcomes

- **Double cancel (or owner + customer):** SQLite serializes the two batches. First: restores fire (status still cancellable), flip returns 1 row → notify once. Second: restore subqueries see `Cancelled` → no-op; flip returns 0 rows → re-read → idempotent success. **No double restore, no second notification.** A *sequential* duplicate whose second request loads an already-`Cancelled` snapshot short-circuits to idempotent success before the batch.
- **Cancel racing a forward transition:** whichever commits first wins. Cancel wins → the forward's CAS matches 0 rows → 422 (never ships an unstocked order). Forward wins → cancel's batch no-ops → re-read shows the advanced status → 422.
- **Duplicate forward** (two identical `Confirmed → OutForDelivery`): first wins; second's CAS misses → 422. Forward transitions are not idempotent (only cancel is) — consistent with "a forward transition on an order that changed underneath returns 422".

Notifications enqueue **only on the winning write**, eliminating the duplicate-notification path for free.

## The four LOW fixes

- **LOW-1 · Undeliverable notification jobs (guest/walk-in):** enqueue only when `order.userId` is set (above). Counter/walk-in orders (`userId: null`) skip the enqueue. The queue handler's existing null-guard stays as defense-in-depth.
- **LOW-2 · Stale owner-cancel snapshot:** the `updateStatus` `Cancelled` branch refetches and returns the persisted row (correct `updatedAt`) instead of `{ ...order, status: "Cancelled" }`. The forward path already returns the `RETURNING *` row.
- **LOW-3 · Customer-feed icon for `order`** (mobile-app only; owners receive no order notifications):
  - `src/data.ts` — add `"order"` to the `Notification["type"]` union.
  - `src/context.tsx` `NOTIF_TYPE_MAP` — add `order: "order"` (currently falls back to `system`).
  - `NotificationsScreen.tsx` `NOTIF_STYLE` — add an `order` entry (icon `Package`, primary tone). Cancelled orders keep the API `cancel` type and its existing tone (left as-is to stay minimal).
- **LOW-4 · Stale migration references:** `workers/api/CLAUDE.md` — replace `migration 0015` / `migration 0016 (0016_payments.sql)` references (Orders, Payments, Khata sections) with the squashed `0000_initial_migration`; document the new atomic/idempotent cancel, the CAS on transitions, and that guest/walk-in orders don't enqueue notifications. The dated plan doc stays as historical record.

## Error handling

- `422` (`ValidationError`) for a non-cancellable cancel and for a raced/duplicate forward transition — existing error shape, no new error type.
- Idempotent cancel → `204` (customer route) / `200` with the cancelled row (owner route).
- Single `db.batch()` is one transaction — a partial restore (stock returned but status not flipped, or vice versa) is impossible.

## Testing

The concurrency class is invisible to mocked-repo unit tests, so the regression coverage lives in a **real-DB integration test**.

- **`orders.repository.integration.test.ts`** (new; in-memory SQLite, mirrors `khata.repository.integration.test.ts`):
  1. First `cancelAndRestore` restores each line's stock exactly once and returns `true`; order status is `Cancelled`.
  2. **Second `cancelAndRestore` on the now-`Cancelled` order returns `false` and leaves stock unchanged** — the HIGH regression test.
  3. `cancelAndRestore` on an `OutForDelivery` order returns `false`, no restore.
  4. `updateStatus` flips and returns the row when `expectedCurrent` matches; returns `null` and makes no change when `expectedCurrent` is stale.
- **Service unit tests** (existing `orders.service.test.ts`): enqueue exactly once on a winning cancel; **no** enqueue on the idempotent no-op; **no** enqueue for a `userId: null` order; the cancel branch returns the refetched persisted row; a forward CAS miss throws `ValidationError` (422).
- **Mobile adapter test** (`apps/mobile-app/src/__tests__/`): an `order` notification maps to the order icon/type (pure mapping, matches the existing test style).

## Out of scope

The two INFORMATIONAL items from the review, flagged so they are not silently dropped:

- **Queue-handler retry duplicate-notification window** — if `pushAndCleanup` throws after `recordInAppNotification` succeeds, the retried message writes a duplicate in-app row. Pre-existing pattern shared with the booking/review handlers; not introduced by this feature.
- **Deep-link to a specific order** — `orderId` is carried on the notification payload but `tapNotif` routes to the My Orders list via `go`. Documented limitation in the mobile guide.

## Verification gate

Per repo policy, before completion: `bun run lint`, `bun run api:test`, `bun run --filter @repo/queue test`, mobile-app tests, and `bun run build` — gating on touched files with zero new failures vs the pre-existing baseline. Docs updated in the same PR.
