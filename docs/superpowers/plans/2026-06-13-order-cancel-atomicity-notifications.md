# Order Cancel Atomicity + Notification Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make order cancellation and status transitions atomic and idempotent so concurrent/duplicate writes can no longer double-restore stock or strand an active order with no stock, and clear the four LOW review findings (guest-order enqueue skip, persisted-row return on owner-cancel, customer-feed `order` icon, stale migration docs).

**Architecture:** Approach A from the spec — status-predicated conditional writes inside the existing single `db.batch()` for cancel (restores-first guarded by a correlated subquery, status flip last with `RETURNING` as the compare-and-swap), and a CAS on forward transitions (`UPDATE … WHERE id=… AND status=:expectedCurrent`). The service reads the affected-row signal to resolve races: idempotent success for a duplicate cancel, `422` for a genuinely-invalid cancel or a forward transition on an order that changed underneath. Notifications enqueue only on the winning write and only when the order has a customer (`userId`).

**Tech Stack:** Drizzle ORM / Cloudflare D1 (SQLite), Hono (`@repo/api`), Cloudflare Queues (`@repo/queue`), Vitest (Node + in-memory `better-sqlite3` for the real-DB test), Expo / React Native (`@repo/mobile-app`).

**Spec:** `docs/superpowers/specs/2026-06-13-order-cancel-atomicity-notifications-design.md`

**Branch:** `feat/order-cancel-atomicity` (off `develop`). Implementation runs in an isolated worktree per the repo git rule.

**Commands:** `cd workers/api && bun run test <path>` (api), `bun run --filter @repo/queue test` (queue), `cd apps/mobile-app && bun run test` (mobile), `bun run lint`, `bun run build`. Baselines are pre-existing RED — gate on **touched files + zero new failures vs baseline**. Lint touched files with `bunx biome check --write <files>`.

---

## File Structure

**Modify:**
- `packages/core/src/database/repositories/orders.repository.ts` — `cancelAndRestore` → atomic/idempotent (`Promise<boolean>`); `updateStatus` → CAS with `expectedCurrent`. Add `inArray` to the drizzle import.
- `workers/api/src/__tests__/helpers/test-db.ts` — add `attachBatch(db)` so the `better-sqlite3` harness can run the repo's `db.batch()` calls.
- `workers/api/src/modules/orders/orders.service.ts` — forward path uses CAS + race-loser 422 + guest-skip; `doCancel(order)` race resolution + win-only enqueue + guest-skip; `cancel` passes the loaded order; owner-cancel branch returns the persisted row.
- `workers/api/src/__tests__/modules/orders/orders.service.test.ts` — update existing cancel/forward tests for the new signatures; add race/idempotency/guest tests.
- `apps/mobile-app/src/data.ts` — add `"order"` to `Notification["type"]`.
- `apps/mobile-app/src/lib/adapters.ts` — add pure `NOTIF_TYPE_MAP` + `mapNotificationType`.
- `apps/mobile-app/src/context.tsx` — import `mapNotificationType`; drop the local `NOTIF_TYPE_MAP`.
- `apps/mobile-app/src/components/screens/NotificationsScreen.tsx` — add an `order` entry to `NOTIF_STYLE`.
- `workers/api/CLAUDE.md` — correct migration references; document the new cancel behavior.

**Create:**
- `workers/api/src/__tests__/modules/orders/orders.repository.integration.test.ts` — real-DB regression test for the conditional cancel + CAS.
- `apps/mobile-app/src/__tests__/notification-adapters.test.ts` — pure mapping test for `mapNotificationType`.

---

## Task 1: Repository — atomic, idempotent `cancelAndRestore` (real-DB TDD)

This is the HIGH fix's core. After this task, the double-restore is impossible at the DB level even though the service still ignores the new return value (changed in Task 3).

**Files:**
- Modify: `workers/api/src/__tests__/helpers/test-db.ts`
- Create: `workers/api/src/__tests__/modules/orders/orders.repository.integration.test.ts`
- Modify: `packages/core/src/database/repositories/orders.repository.ts:114-132` (the `cancelAndRestore` method) and the drizzle import on line 1.

- [ ] **Step 1: Add a `batch` shim to the test harness**

D1 exposes `db.batch()`; the `better-sqlite3` drizzle driver used in tests does not. Shim it by awaiting each prepared statement in order (the test is single-threaded, so sequential execution is effectively the same transaction for assertion purposes). Append to `workers/api/src/__tests__/helpers/test-db.ts`:

```ts
/**
 * D1's `db.batch()` has no equivalent on the better-sqlite3 driver. Attach a
 * shim that awaits each drizzle statement in order so repository methods using
 * `db.batch([...])` (placeOrder, cancelAndRestore) can run in integration tests.
 * Returns the same db for chaining: `const db = attachBatch(createTestDb())`.
 */
export function attachBatch(db: ReturnType<typeof createTestDb>) {
	(db as unknown as { batch: (stmts: unknown[]) => Promise<unknown[]> }).batch =
		async (stmts) => {
			const results: unknown[] = [];
			for (const stmt of stmts) results.push(await stmt);
			return results;
		};
	return db;
}
```

- [ ] **Step 2: Write the failing integration test**

Create `workers/api/src/__tests__/modules/orders/orders.repository.integration.test.ts`:

```ts
/**
 * Real-DB regression test for the atomic, idempotent cancel guard. The
 * concurrency class (double-restore / cancel-races-forward) is invisible to the
 * mocked-repo service tests, so this exercises the actual conditional SQL
 * against an in-memory SQLite engine via the db.batch() shim.
 */
import { OrdersRepository } from "@repo/core/src/database/repositories/orders.repository";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { attachBatch, createTestDb } from "../../helpers/test-db";

const TS = "2026-01-01T00:00:00.000Z";
type Db = ReturnType<typeof createTestDb>;

async function seedProduct(db: Db, id: string, stock: number) {
	const { productsSchema } = await import("@repo/core/src/database/schema");
	// biome-ignore lint/suspicious/noExplicitAny: better-sqlite3 vs D1 drizzle type mismatch in tests
	await (db as any).insert(productsSchema).values({
		id,
		branchId: "branch-1",
		name: "12kg Cylinder",
		price: 100,
		stock,
		createdAt: TS,
	});
}

async function seedOrder(db: Db, id: string, status: string) {
	const { ordersSchema, orderItemsSchema } = await import(
		"@repo/core/src/database/schema"
	);
	// biome-ignore lint/suspicious/noExplicitAny: better-sqlite3 vs D1 drizzle type mismatch in tests
	await (db as any).insert(ordersSchema).values({
		id,
		businessId: "biz-1",
		branchId: "branch-1",
		userId: "user-1",
		status,
		total: 300,
		deliveryLine: "123 Test St",
		deliveredAt: null,
		createdAt: TS,
		updatedAt: TS,
		deletedAt: null,
	});
	// biome-ignore lint/suspicious/noExplicitAny: better-sqlite3 vs D1 drizzle type mismatch in tests
	await (db as any).insert(orderItemsSchema).values({
		id: `${id}-item-1`,
		orderId: id,
		productId: "prod-1",
		quantity: 3,
		unitPrice: 100,
		createdAt: TS,
	});
}

async function readStock(db: Db, id: string): Promise<number> {
	const { productsSchema } = await import("@repo/core/src/database/schema");
	// biome-ignore lint/suspicious/noExplicitAny: better-sqlite3 vs D1 drizzle type mismatch in tests
	const rows = await (db as any)
		.select()
		.from(productsSchema)
		.where(eq(productsSchema.id, id));
	return rows[0].stock as number;
}

async function readStatus(db: Db, id: string): Promise<string> {
	const { ordersSchema } = await import("@repo/core/src/database/schema");
	// biome-ignore lint/suspicious/noExplicitAny: better-sqlite3 vs D1 drizzle type mismatch in tests
	const rows = await (db as any)
		.select()
		.from(ordersSchema)
		.where(eq(ordersSchema.id, id));
	return rows[0].status as string;
}

const ITEMS = [{ productId: "prod-1", quantity: 3 }] as never;

describe("OrdersRepository.cancelAndRestore (real-DB, atomic + idempotent)", () => {
	let db: Db;
	beforeEach(async () => {
		db = attachBatch(createTestDb());
		await seedProduct(db, "prod-1", 10);
	});

	it("first cancel restores stock once, flips to Cancelled, returns true", async () => {
		await seedOrder(db, "order-1", "Confirmed");
		const repo = new OrdersRepository(db as never);

		const didCancel = await repo.cancelAndRestore("order-1", ITEMS, TS);

		expect(didCancel).toBe(true);
		expect(await readStock(db, "prod-1")).toBe(13);
		expect(await readStatus(db, "order-1")).toBe("Cancelled");
	});

	it("second cancel on the now-Cancelled order is a no-op: stock unchanged, returns false", async () => {
		await seedOrder(db, "order-1", "Confirmed");
		const repo = new OrdersRepository(db as never);

		await repo.cancelAndRestore("order-1", ITEMS, TS); // first: true, stock 13
		const second = await repo.cancelAndRestore("order-1", ITEMS, TS);

		expect(second).toBe(false);
		expect(await readStock(db, "prod-1")).toBe(13); // NOT 16 — no double restore
		expect(await readStatus(db, "order-1")).toBe("Cancelled");
	});

	it("cancel on an OutForDelivery order is a no-op: no restore, returns false", async () => {
		await seedOrder(db, "order-2", "OutForDelivery");
		const repo = new OrdersRepository(db as never);

		const didCancel = await repo.cancelAndRestore("order-2", ITEMS, TS);

		expect(didCancel).toBe(false);
		expect(await readStock(db, "prod-1")).toBe(10); // unchanged
		expect(await readStatus(db, "order-2")).toBe("OutForDelivery");
	});
});
```

- [ ] **Step 3: Run the test — verify it fails**

Run: `cd workers/api && bun run test src/__tests__/modules/orders/orders.repository.integration.test.ts`
Expected: FAIL — current `cancelAndRestore` returns `undefined` (not `true`/`false`) and restores stock unconditionally, so the second-cancel test sees stock `16` and `didCancel` is not a boolean.

- [ ] **Step 4: Implement the conditional, idempotent `cancelAndRestore`**

In `packages/core/src/database/repositories/orders.repository.ts`, change line 1 to add `inArray`:

```ts
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
```

Replace the `cancelAndRestore` method (currently lines 114-132) with:

```ts
/**
 * Atomic, idempotent cancel. Restores each line's stock and flips the order to
 * Cancelled ONLY while it is still Pending/Confirmed. Returns true if THIS call
 * performed the cancel, false if the order was already non-cancellable (a
 * concurrent or duplicate cancel). Statement order matters: the restores run
 * first so their subquery still sees a cancellable status; a serialized second
 * call sees status='Cancelled', so every statement no-ops.
 */
async cancelAndRestore(
	orderId: string,
	items: OrderItemSelect[],
	updatedAt: string,
): Promise<boolean> {
	const results = await this.db.batch([
		...items.map((it) =>
			this.db
				.update(productsSchema)
				.set({ stock: sql`${productsSchema.stock} + ${it.quantity}` })
				.where(
					and(
						eq(productsSchema.id, it.productId),
						sql`(SELECT status FROM orders WHERE id = ${orderId}) IN ('Pending','Confirmed')`,
					),
				),
		),
		this.db
			.update(ordersSchema)
			.set({ status: "Cancelled", updatedAt })
			.where(
				and(
					eq(ordersSchema.id, orderId),
					inArray(ordersSchema.status, ["Pending", "Confirmed"]),
				),
			)
			.returning({ id: ordersSchema.id }),
	] as never);
	const flipped = results[results.length - 1] as { id: string }[];
	return flipped.length === 1;
}
```

- [ ] **Step 5: Run the test — verify it passes**

Run: `cd workers/api && bun run test src/__tests__/modules/orders/orders.repository.integration.test.ts`
Expected: PASS (all three cases).

- [ ] **Step 6: Confirm no new typecheck errors + no unrelated test regressions**

Run: `bunx tsc --noEmit -p packages/core/tsconfig.json 2>&1 | grep orders.repository || echo "no new errors"`
Expected: `no new errors`.
Run: `cd workers/api && bun run test src/__tests__/modules/orders/`
Expected: existing service/route tests still pass (the service ignores the new boolean return for now).

- [ ] **Step 7: Lint + commit**

```bash
bunx biome check --write packages/core/src/database/repositories/orders.repository.ts workers/api/src/__tests__/helpers/test-db.ts workers/api/src/__tests__/modules/orders/orders.repository.integration.test.ts
git add packages/core/src/database/repositories/orders.repository.ts workers/api/src/__tests__/helpers/test-db.ts workers/api/src/__tests__/modules/orders/orders.repository.integration.test.ts
git commit -m "fix(core): atomic idempotent cancelAndRestore — no double stock restore"
```

---

## Task 2: Repository CAS + service forward path (TDD)

Adds the compare-and-swap to forward transitions. The repo signature change forces the single service call site to update in the same task, so the build stays green.

**Files:**
- Modify: `packages/core/src/database/repositories/orders.repository.ts:134-147` (the `updateStatus` method)
- Modify: `workers/api/src/modules/orders/orders.service.ts:242-252` (forward branch of `updateStatus`)
- Modify: `workers/api/src/__tests__/modules/orders/orders.service.test.ts` (forward tests)
- Add cases to: `workers/api/src/__tests__/modules/orders/orders.repository.integration.test.ts`

- [ ] **Step 1: Write the failing repo CAS integration cases**

Append to `orders.repository.integration.test.ts`:

```ts
describe("OrdersRepository.updateStatus (compare-and-swap)", () => {
	let db: Db;
	beforeEach(async () => {
		db = attachBatch(createTestDb());
		await seedProduct(db, "prod-1", 10);
	});

	it("flips and returns the row when expectedCurrent matches", async () => {
		await seedOrder(db, "order-1", "Confirmed");
		const repo = new OrdersRepository(db as never);

		const res = await repo.updateStatus("order-1", "OutForDelivery", "Confirmed");

		expect(res.data?.status).toBe("OutForDelivery");
		expect(await readStatus(db, "order-1")).toBe("OutForDelivery");
	});

	it("no-ops and returns null when expectedCurrent is stale", async () => {
		await seedOrder(db, "order-1", "OutForDelivery");
		const repo = new OrdersRepository(db as never);

		// Caller thinks it is still Confirmed, but it already moved on.
		const res = await repo.updateStatus("order-1", "Delivered", "Confirmed");

		expect(res.data).toBeNull();
		expect(await readStatus(db, "order-1")).toBe("OutForDelivery"); // unchanged
	});
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `cd workers/api && bun run test src/__tests__/modules/orders/orders.repository.integration.test.ts`
Expected: FAIL — `updateStatus` currently takes `(id, status, extra)` (no `expectedCurrent`); the 3rd arg `"Confirmed"` is treated as `extra` and the unconditional update flips regardless.

- [ ] **Step 3: Implement the CAS `updateStatus` in the repository**

Replace the `updateStatus` method (currently lines 134-147) of `orders.repository.ts` with:

```ts
/**
 * Compare-and-swap status update: flips to `status` (plus any `extra` fields)
 * only if the row's current status still equals `expectedCurrent`. Returns the
 * updated row, or `{ data: null }` when the CAS misses (status moved under us).
 */
async updateStatus(
	id: string,
	status: OrderSelect["status"],
	expectedCurrent: OrderSelect["status"],
	extra: Partial<OrderInsert> = {},
): Promise<ApiResponse<OrderSelect | null>> {
	const rows = await this.db
		.update(ordersSchema)
		.set({ status, updatedAt: new Date().toISOString(), ...extra })
		.where(
			and(
				eq(ordersSchema.id, id),
				eq(ordersSchema.status, expectedCurrent),
			),
		)
		.returning();
	return { data: (rows[0] as OrderSelect) ?? null };
}
```

- [ ] **Step 4: Run repo test — verify it passes**

Run: `cd workers/api && bun run test src/__tests__/modules/orders/orders.repository.integration.test.ts`
Expected: PASS (all five cases now).

- [ ] **Step 5: Update the service forward path + its tests (failing first)**

In `orders.service.ts`, replace the forward-transition tail of `updateStatus` (currently lines 242-251, from `const extra =` through `return result.data!;`) with:

```ts
		const extra =
			next === "Delivered" ? { deliveredAt: new Date().toISOString() } : {};
		const result = await this.repo.updateStatus(
			orderId,
			next,
			order.status as OrderStatusType,
			extra,
		);
		if (!result.data) {
			// Lost a race — re-read for an accurate 422.
			const fresh = await this.repo.findOne(orderId);
			throw new ValidationError(
				`Cannot move order from ${fresh.data?.status} to ${next}`,
			);
		}
		if (order.userId) {
			await this.queue.send({
				type: "notification.order_status_changed",
				orderId,
				status: next,
			});
		}
		return result.data;
```

In `orders.service.test.ts`, update the forward tests for the new arg order and the `userId` guard:

- In `"updateStatus (forward) enqueues an order_status_changed job"` change the mock to include a `userId`:
```ts
		authz.assertOrderAccess.mockResolvedValue({
			id: "o1",
			status: "Pending",
			userId: "u1",
		});
```
- In `"stamps deliveredAt when moving to Delivered"` the `extra` arg moved from index 2 to 3 — change the assertion:
```ts
		const extra = repo.updateStatus.mock.calls[0][3];
		expect(extra.deliveredAt).toBeTruthy();
```

Add a new forward-CAS-miss test inside `describe("OrdersService queue + owner-cancel", …)`:

```ts
	it("forward transition whose CAS misses (status changed under us) throws 422 and does not enqueue", async () => {
		authz.assertOrderAccess.mockResolvedValue({
			id: "o1",
			status: "Pending",
			userId: "u1",
		});
		repo.updateStatus.mockResolvedValue({ data: null }); // CAS miss
		repo.findOne.mockResolvedValue({ data: { id: "o1", status: "Confirmed" } });
		await expect(
			makeService().updateStatus("owner", "o1", "Confirmed", null),
		).rejects.toBeInstanceOf(ValidationError);
		expect(queue.send).not.toHaveBeenCalled();
	});
```

- [ ] **Step 6: Run service + repo tests — verify they pass**

Run: `cd workers/api && bun run test src/__tests__/modules/orders/`
Expected: PASS. (`OrdersService.cancel` and the owner-cancel tests still pass here because Task 3 hasn't touched them — they mock `cancelAndRestore` to `undefined`, which the unchanged `doCancel` still ignores.)

- [ ] **Step 7: Typecheck + lint + commit**

```bash
bunx tsc --noEmit -p workers/api/tsconfig.json 2>&1 | grep -E "modules/orders" || echo "no new errors"
bunx biome check --write packages/core/src/database/repositories/orders.repository.ts workers/api/src/modules/orders/orders.service.ts workers/api/src/__tests__/modules/orders/orders.service.test.ts workers/api/src/__tests__/modules/orders/orders.repository.integration.test.ts
git add packages/core/src/database/repositories/orders.repository.ts workers/api/src/modules/orders/orders.service.ts workers/api/src/__tests__/modules/orders/
git commit -m "fix(api): CAS on forward order transitions + race-loser 422"
```

---

## Task 3: Service — idempotent cancel race resolution + notification dedup (TDD)

Wires `doCancel` to the Task 1 boolean: idempotent success on a duplicate cancel, 422 on a genuinely-invalid one, notify only on the winning write and only when there is a customer, and return the persisted row from owner-cancel (LOW-1, LOW-2).

**Files:**
- Modify: `workers/api/src/modules/orders/orders.service.ts` (`updateStatus` cancel branch lines 226-230, `cancel` lines 254-257, `doCancel` lines 259-276)
- Modify: `workers/api/src/__tests__/modules/orders/orders.service.test.ts`

- [ ] **Step 1: Update existing cancel tests + add new ones (failing first)**

In `orders.service.test.ts`:

Replace the `"owner cancels via updateStatus('Cancelled')…"` test body with (adds `userId`, makes `cancelAndRestore` win, mocks the refetch):
```ts
	it("owner cancels via updateStatus('Cancelled'): assertOrderAccess, restores stock, enqueues Cancelled, no plain update", async () => {
		authz.assertOrderAccess.mockResolvedValue({
			id: "o1",
			status: "Confirmed",
			userId: "u1",
		});
		repo.findItems.mockResolvedValue([{ productId: "p1", quantity: 2 }]);
		repo.cancelAndRestore.mockResolvedValue(true);
		repo.findOne.mockResolvedValue({ data: { id: "o1", status: "Cancelled" } });
		const res = await makeService().updateStatus("owner", "o1", "Cancelled", null);
		expect(authz.assertOrderAccess).toHaveBeenCalledWith("owner", "o1", null);
		expect(repo.cancelAndRestore).toHaveBeenCalledOnce();
		expect(repo.updateStatus).not.toHaveBeenCalled();
		expect(res.status).toBe("Cancelled");
		expect(queue.send).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "notification.order_status_changed",
				orderId: "o1",
				status: "Cancelled",
			}),
		);
	});
```

In `"customer cancel uses assertCustomerOwnsOrder…"`, set the order `userId` and make the cancel win:
```ts
		authz.assertCustomerOwnsOrder.mockResolvedValue({
			id: "o1",
			status: "Pending",
			userId: "u1",
		});
		repo.findItems.mockResolvedValue([]);
		repo.cancelAndRestore.mockResolvedValue(true);
```

In `"OrdersService.cancel" > "restores stock and cancels a Pending order"`, make the cancel win:
```ts
		repo.cancelAndRestore.mockResolvedValue(true);
```

Add new tests inside `describe("OrdersService queue + owner-cancel", …)`:
```ts
	it("duplicate/concurrent cancel on an already-Cancelled order is idempotent — no throw, no enqueue", async () => {
		authz.assertCustomerOwnsOrder.mockResolvedValue({
			id: "o1",
			status: "Confirmed",
			userId: "u1",
		});
		repo.findItems.mockResolvedValue([{ productId: "p1", quantity: 1 }]);
		repo.cancelAndRestore.mockResolvedValue(false); // lost the race
		repo.findOne.mockResolvedValue({ data: { id: "o1", status: "Cancelled" } });
		await expect(makeService().cancel("u1", "o1")).resolves.toBeUndefined();
		expect(queue.send).not.toHaveBeenCalled();
	});

	it("cancel that lost to a forward transition throws 422", async () => {
		authz.assertCustomerOwnsOrder.mockResolvedValue({
			id: "o1",
			status: "Confirmed",
			userId: "u1",
		});
		repo.findItems.mockResolvedValue([{ productId: "p1", quantity: 1 }]);
		repo.cancelAndRestore.mockResolvedValue(false);
		repo.findOne.mockResolvedValue({
			data: { id: "o1", status: "OutForDelivery" },
		});
		await expect(makeService().cancel("u1", "o1")).rejects.toBeInstanceOf(
			ValidationError,
		);
		expect(queue.send).not.toHaveBeenCalled();
	});

	it("guest/walk-in order (no userId) is cancelled but enqueues no notification", async () => {
		authz.assertOrderAccess.mockResolvedValue({
			id: "o1",
			status: "Confirmed",
			userId: null,
		});
		repo.findItems.mockResolvedValue([{ productId: "p1", quantity: 1 }]);
		repo.cancelAndRestore.mockResolvedValue(true);
		repo.findOne.mockResolvedValue({ data: { id: "o1", status: "Cancelled" } });
		await makeService().updateStatus("owner", "o1", "Cancelled", null);
		expect(repo.cancelAndRestore).toHaveBeenCalledOnce();
		expect(queue.send).not.toHaveBeenCalled();
	});

	it("owner-cancel returns the persisted row (with updatedAt), not a synthesized snapshot", async () => {
		authz.assertOrderAccess.mockResolvedValue({
			id: "o1",
			status: "Confirmed",
			userId: "u1",
		});
		repo.findItems.mockResolvedValue([]);
		repo.cancelAndRestore.mockResolvedValue(true);
		repo.findOne.mockResolvedValue({
			data: { id: "o1", status: "Cancelled", updatedAt: "2026-06-13T00:00:00.000Z" },
		});
		const res = await makeService().updateStatus("owner", "o1", "Cancelled", null);
		expect(res).toMatchObject({
			id: "o1",
			status: "Cancelled",
			updatedAt: "2026-06-13T00:00:00.000Z",
		});
	});
```

- [ ] **Step 2: Run — verify the updated/new tests fail**

Run: `cd workers/api && bun run test src/__tests__/modules/orders/orders.service.test.ts`
Expected: FAIL — the current `doCancel` enqueues unconditionally (so the idempotent/guest "no enqueue" assertions fail) and returns the synthesized `{ ...order, status: "Cancelled" }` rather than the refetched row.

- [ ] **Step 3: Implement the service cancel changes**

In `orders.service.ts`, replace the `updateStatus` cancel branch (currently lines 226-230):

```ts
		// Owner-cancel: route through the restore-aware path, not a plain status flip.
		if (next === "Cancelled") {
			await this.doCancel(order);
			const fresh = await this.repo.findOne(orderId);
			return fresh.data as OrderSelect; // persisted row, not a synthesized snapshot
		}
```

Replace `cancel` (currently lines 254-257):

```ts
	async cancel(userId: string, orderId: string): Promise<void> {
		const order = await this.authz.assertCustomerOwnsOrder(userId, orderId);
		await this.doCancel(order);
	}
```

Replace `doCancel` (currently lines 259-276) with the order-taking, idempotent version:

```ts
	/** Restore stock, mark Cancelled, notify. Caller has already authorized + loaded the order. */
	private async doCancel(order: OrderSelect): Promise<void> {
		// Idempotent: an order already Cancelled is in the desired state (a
		// sequential double-tap whose second request loads Cancelled).
		if (order.status === "Cancelled") return;
		// Fast 422 for a terminally non-cancellable order; status only moves
		// forward or to Cancelled, so a loaded OutForDelivery/Delivered is final.
		if (order.status !== "Pending" && order.status !== "Confirmed") {
			throw new ValidationError(
				`Cannot cancel an order in ${order.status} state`,
			);
		}
		const items = await this.repo.findItems(order.id);
		const didCancel = await this.repo.cancelAndRestore(
			order.id,
			items,
			new Date().toISOString(),
		);
		if (!didCancel) {
			// Lost the race / duplicate — re-read to decide.
			const fresh = await this.repo.findOne(order.id);
			if (fresh.data?.status === "Cancelled") return; // idempotent success
			throw new ValidationError(
				`Cannot cancel an order in ${fresh.data?.status} state`,
			);
		}
		// We won — notify only when there is a customer account to notify.
		if (order.userId) {
			await this.queue.send({
				type: "notification.order_status_changed",
				orderId: order.id,
				status: "Cancelled",
			});
		}
	}
```

- [ ] **Step 4: Run — verify all order service tests pass**

Run: `cd workers/api && bun run test src/__tests__/modules/orders/`
Expected: PASS (service + routes + repository integration).

- [ ] **Step 5: Typecheck + lint + commit**

```bash
bunx tsc --noEmit -p workers/api/tsconfig.json 2>&1 | grep -E "modules/orders" || echo "no new errors"
bunx biome check --write workers/api/src/modules/orders/orders.service.ts workers/api/src/__tests__/modules/orders/orders.service.test.ts
git add workers/api/src/modules/orders/orders.service.ts workers/api/src/__tests__/modules/orders/orders.service.test.ts
git commit -m "fix(api): idempotent order cancel + notify-only-on-win + guest skip + persisted-row return"
```

---

## Task 4: Mobile customer feed — `order` notification icon (TDD)

Customer-only (owners receive no order notifications). Extract the pure type mapping so it is unit-testable, add the `order` case, and give it a distinct icon.

**Files:**
- Modify: `apps/mobile-app/src/data.ts:88` (the `Notification` type union)
- Modify: `apps/mobile-app/src/lib/adapters.ts`
- Modify: `apps/mobile-app/src/context.tsx:131-136,142`
- Modify: `apps/mobile-app/src/components/screens/NotificationsScreen.tsx:12-26`
- Create: `apps/mobile-app/src/__tests__/notification-adapters.test.ts`

- [ ] **Step 1: Write the failing mapping test**

Create `apps/mobile-app/src/__tests__/notification-adapters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mapNotificationType } from "../lib/adapters";

describe("mapNotificationType", () => {
	it("maps the order status type to its own local type", () => {
		expect(mapNotificationType("order")).toBe("order");
	});

	it("maps booking/review through to their local types", () => {
		expect(mapNotificationType("booking")).toBe("confirmed");
		expect(mapNotificationType("review")).toBe("review");
	});

	it("maps cancel and unknown types to the system fallback", () => {
		expect(mapNotificationType("cancel")).toBe("system");
		expect(mapNotificationType("whatever")).toBe("system");
	});
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `cd apps/mobile-app && bun run test src/__tests__/notification-adapters.test.ts`
Expected: FAIL — `mapNotificationType` is not exported from `../lib/adapters`.

- [ ] **Step 3: Add `"order"` to the local `Notification` type**

In `apps/mobile-app/src/data.ts`, change the `Notification` type's `type` union (line 89) to include `"order"`:

```ts
	type: "reminder" | "reward" | "offer" | "review" | "confirmed" | "system" | "order";
```

- [ ] **Step 4: Add the pure mapping to `lib/adapters.ts`**

In `apps/mobile-app/src/lib/adapters.ts`, add `Notification` to the existing local-type import from `../data` (it already imports `Booking, Branch, Business, CustomerAddress, …` from there), then append:

```ts
/**
 * Maps an API AppNotification.type to the local Notification view-model type.
 * Unknown/unmapped types (and order cancellations, which arrive as "cancel")
 * fall back to "system". Pure — unit-tested in notification-adapters.test.ts.
 */
const NOTIF_TYPE_MAP: Record<string, Notification["type"]> = {
	booking: "confirmed",
	cancel: "system",
	review: "review",
	system: "system",
	order: "order",
};

export function mapNotificationType(apiType: string): Notification["type"] {
	return NOTIF_TYPE_MAP[apiType] ?? "system";
}
```

- [ ] **Step 5: Use the shared mapping in `context.tsx`**

In `apps/mobile-app/src/context.tsx`:
- Delete the local `NOTIF_TYPE_MAP` const (lines 131-136).
- Add `mapNotificationType` to the import from `./lib/adapters` (line 29 currently imports `adaptApiBooking`):
```ts
import { adaptApiBooking, mapNotificationType } from "./lib/adapters";
```
- In `adaptNotification`, replace the `type` line (line 142):
```ts
		type: mapNotificationType(n.type),
```

- [ ] **Step 6: Add the `order` style to the notifications screen**

In `apps/mobile-app/src/components/screens/NotificationsScreen.tsx`, add an `order` entry to `NOTIF_STYLE` (after the `review` entry, around line 24):

```ts
	order: { icon: "Package", bg: Colors.primary100, fg: Colors.primary700 },
```

- [ ] **Step 7: Run the mapping test — verify it passes**

Run: `cd apps/mobile-app && bun run test src/__tests__/notification-adapters.test.ts`
Expected: PASS.

- [ ] **Step 8: Typecheck + lint + commit**

```bash
cd apps/mobile-app && bunx tsc --noEmit 2>&1 | grep -E "adapters|context|NotificationsScreen|data.ts" || echo "no new errors"
cd ../.. && bunx biome check --write apps/mobile-app/src/data.ts apps/mobile-app/src/lib/adapters.ts apps/mobile-app/src/context.tsx apps/mobile-app/src/components/screens/NotificationsScreen.tsx apps/mobile-app/src/__tests__/notification-adapters.test.ts
git add apps/mobile-app/src/data.ts apps/mobile-app/src/lib/adapters.ts apps/mobile-app/src/context.tsx apps/mobile-app/src/components/screens/NotificationsScreen.tsx apps/mobile-app/src/__tests__/notification-adapters.test.ts
git commit -m "feat(mobile): distinct icon for order notifications in the customer feed"
```

---

## Task 5: Docs + final verification gate

**Files:**
- Modify: `workers/api/CLAUDE.md`

- [ ] **Step 1: Find the stale migration references**

Run: `grep -n "0015\|0016" workers/api/CLAUDE.md`
Expected: two hits — the Orders "Notifications." paragraph (`migration \`0015\``) and the Khata section (`Migration \`0016\` (\`0016_payments.sql\`)`).

- [ ] **Step 2: Correct them + document the new behavior**

In `workers/api/CLAUDE.md`, Orders section, change the notification-schema sentence so it no longer cites migration 0015:

> Notification schema: `notifications.order_id` column (present in the squashed `0000_initial_migration`), `type = "order"` for forward transitions or `"cancel"` for cancellations, `go = "orders"`, `orderId` …

In the Khata section, change:

> Migration `0016` (`0016_payments.sql`) adds the `payments` table.

to:

> The `payments` table ships in the squashed `0000_initial_migration`.

In the Orders "Cancellation" paragraph, add a sentence documenting the new guarantee:

> Cancellation is **atomic and idempotent**: `cancelAndRestore` restores stock and flips to `Cancelled` only while the order is `Pending`/`Confirmed` (status-predicated `db.batch()` writes), so a concurrent or duplicate cancel cannot double-restore stock. Forward transitions use a compare-and-swap on the loaded status; a lost race returns `422`. A duplicate cancel on an already-`Cancelled` order is idempotent success. Guest/walk-in orders (`userId` null) are cancelled but enqueue no customer notification.

- [ ] **Step 3: Commit docs**

```bash
git add workers/api/CLAUDE.md
git commit -m "docs(api): atomic idempotent order cancel + corrected migration references"
```

- [ ] **Step 4: Final gate**

Run: `cd workers/api && bun run test`
Expected: no new failures vs the pre-existing baseline; the new orders integration + service tests pass.
Run: `bun run --filter @repo/queue test`
Expected: green (queue handler unchanged — still passes).
Run: `cd apps/mobile-app && bun run test`
Expected: no new failures vs baseline; the new mapping test passes.
Run (from repo root): `bun run lint`
Expected: touched files clean (repo baseline red is expected; confirm no NEW errors in touched files).
Run (from repo root): `bun run build`
Expected: succeeds.

- [ ] **Step 5: Finish the branch**

Use superpowers:finishing-a-development-branch to choose merge / PR / cleanup for `feat/order-cancel-atomicity`.

---

## Self-Review notes

- **Spec coverage:** HIGH atomic guard → Tasks 1 (cancel) + 2 (forward CAS) + 3 (service race resolution). LOW-1 guest skip → Task 3 (and forward path in Task 2). LOW-2 persisted-row return → Task 3. LOW-3 customer-feed icon → Task 4. LOW-4 docs → Task 5. Testing (real-DB integration + service unit + mobile mapping) → Tasks 1-4. Out-of-scope items (queue-retry dup, deep-link to specific order) intentionally untouched.
- **Type consistency:** `cancelAndRestore` returns `boolean` (Task 1), consumed by `doCancel` as `didCancel` (Task 3). `updateStatus(id, status, expectedCurrent, extra)` (Task 2) is called with `order.status` as `expectedCurrent` in the service (Task 2) and returns `ApiResponse<OrderSelect | null>` whose `.data` the service null-checks. `mapNotificationType` returns `Notification["type"]`, which gains `"order"` in Task 4; `NOTIF_STYLE` gains a matching `order` key.
- **Ordering / green-per-commit:** Task 1 changes only the repo (service ignores the new boolean — still compiles, double-restore already fixed at DB). Task 2 changes the repo signature **and** the one service call site together so arity stays valid. Task 3 only refines service cancel behavior. No commit leaves the build broken.
- **Known test-harness note:** `db.batch()` is D1-only; the `better-sqlite3` integration harness runs it via the `attachBatch` shim (sequential await), which exercises the real conditional SQL — the source of the idempotency correctness. True D1 transactional rollback is a platform guarantee, not re-tested here.
