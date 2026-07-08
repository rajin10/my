# Order Notifications + Owner-Cancel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notify the customer (in-app + Expo push) on every owner-driven order status change, and let an owner cancel an unfulfillable order (restoring stock) — the backend foundation for the order-flow UI slices.

**Architecture:** Mirror the existing booking notification chain: `OrdersService` enqueues a `notification.order_status_changed` job → the queue worker creates an in-app notification row (`go:"orders"`, `orderId`) and sends Expo push. `OrdersService.cancel` is generalized so owners can cancel via `assertOrderAccess` (customers still via `assertCustomerOwnsOrder`); both funnel through the existing restore-aware `cancelAndRestore`. A `notifications.order_id` column (additive migration `0015`) carries the deep-link target.

**Tech Stack:** Drizzle/D1, Cloudflare Queues (`@repo/queue` worker), Hono + `@hono/zod-openapi` (`@repo/api`), Vitest (Node, mocked).

**Spec:** `docs/superpowers/specs/2026-06-10-commerce-order-flow-ux-design.md` (§1 notifications, §2 owner-cancel).

**Base:** worktree `claude/order-flow-ux` off `develop` @ `9308c34` (order-flow backend merged).

**Commands:** `bun run api:test` (api), `bun run --filter @repo/queue test` (queue), `bun run lint`, `bun run build`. Baselines are pre-existing RED — gate on **touched files + zero new errors/failures vs baseline** (stash-diff); Biome auto-fix touched files with `bunx biome check --write <files>`.

---

## File Structure

**Modify:**
- `packages/core/src/queue/jobs.ts` — add `notification.order_status_changed` to `JobPayload`
- `packages/core/src/database/schema/notifications.schema.ts` — add `orderId` column + `"order"` to `NotificationType`/enum
- `workers/api/src/database/migrations/0015_notifications_order_id.sql` — **create** (additive ALTER)
- `workers/api/src/database/migrations/meta/_journal.json` — register `0015`
- `workers/queue/src/handler.ts` — `OrdersRepository` in `Repos`; `recordInAppNotification` gains `orderId`/`go:"orders"`; `handleOrderStatusNotification` + dispatch case
- `workers/queue/src/__tests__/handler.test.ts` — test the new job
- `workers/api/src/modules/orders/orders.service.ts` — `QueueProducer` dep; fire job on `updateStatus` + `cancel`; generalize `cancel` for owner
- `workers/api/src/modules/orders/index.ts` — owner-cancel route; `installOrdersService` passes `queue`
- `workers/api/src/__tests__/modules/orders/orders.service.test.ts` — queue + owner-cancel cases
- `workers/api/src/__tests__/modules/orders/orders.routes.test.ts` — owner-cancel route cases
- `workers/api/src/modules/notifications/notifications.service.ts` — DTO gains `orderId` + `go:"orders"`
- `packages/api-client/src/types.ts` — `AppNotification` gains `orderId` + `go:"orders"`, `AppNotificationType` gains `"order"`

---

## Task 1: Core — job type + notifications schema + migration 0015

**Files:** `packages/core/src/queue/jobs.ts`, `packages/core/src/database/schema/notifications.schema.ts`, `workers/api/src/database/migrations/0015_notifications_order_id.sql` (create), `workers/api/src/database/migrations/meta/_journal.json`.

- [ ] **Step 1: Add the job type** — in `packages/core/src/queue/jobs.ts`, add an import and a union member.

At the top add:
```ts
import type { OrderStatusType } from "../database/schema";
```
Add to the `JobPayload` union (after the booking members):
```ts
	| (BaseJob & {
			type: "notification.order_status_changed";
			orderId: string;
			status: OrderStatusType;
	  })
```

- [ ] **Step 2: Extend the notifications schema** — in `packages/core/src/database/schema/notifications.schema.ts`:

Add `"order"` to the `NotificationType` const and the column enum, and add the `orderId` column.

Change the const:
```ts
export const NotificationType = {
	BOOKING: "booking",
	CANCEL: "cancel",
	REVIEW: "review",
	SYSTEM: "system",
	ORDER: "order",
} as const;
```
Change the `type` column enum and add `orderId` after `reviewId`:
```ts
		type: text({
			enum: ["booking", "cancel", "review", "system", "order"],
		}).notNull(),
		title: text().notNull(),
		body: text().notNull(),
		readAt: text("read_at"),
		businessId: text("business_id"),
		bookingId: text("booking_id"),
		reviewId: text("review_id"),
		orderId: text("order_id"),
		go: text(),
```
(`orderId` is plain unconstrained `text` — mirrors `bookingId`/`reviewId`. The enum is drizzle-type-only; the DB column is plain `text` with no CHECK, so adding `"order"` needs no migration.)

- [ ] **Step 3: Create migration `0015_notifications_order_id.sql`** (hand-authored, additive — mirrors how `0013`/`0014` were authored; snapshots are intentionally not regenerated):

```sql
ALTER TABLE `notifications` ADD `order_id` text;
```

- [ ] **Step 4: Register in `_journal.json`** — append after the `0014_commerce_orders` entry (inside `entries`):

```json
    {
      "idx": 15,
      "version": "6",
      "when": 1780957481721,
      "tag": "0015_notifications_order_id",
      "breakpoints": true
    }
```

- [ ] **Step 5: Verify** — migration applies and core typechecks.

Run: `bun run cli db fresh`
Expected: completes with no errors; `notifications` table now has `order_id` (the run applies all 15 migrations).
Run: `bunx tsc --noEmit -p packages/core/tsconfig.json`
Expected: no new errors (the `OrderStatusType` import resolves; baseline `client.ts` error may remain — ignore).

- [ ] **Step 6: Lint touched files + commit**

```bash
bunx biome check --write packages/core/src/queue/jobs.ts packages/core/src/database/schema/notifications.schema.ts
git add packages/core/src/queue/jobs.ts packages/core/src/database/schema/notifications.schema.ts workers/api/src/database/migrations/0015_notifications_order_id.sql workers/api/src/database/migrations/meta/_journal.json
git commit -m "feat(core): order_status_changed job + notifications.order_id (migration 0015)"
```

---

## Task 2: Queue worker — order status notification handler (TDD)

**Files:** `workers/queue/src/handler.ts`, `workers/queue/src/__tests__/handler.test.ts`.

> The handler loads the order, then notifies the **customer** (`order.userId`) only — owner-driven changes don't notify the owner. Reuses `recordInAppNotification` + `pushAndCleanup`.

- [ ] **Step 1: Write the failing test** — append to `workers/queue/src/__tests__/handler.test.ts`. First add an Orders repo mock alongside the existing `vi.hoisted` mocks (match the file's existing hoisted-mock style):

```ts
const { MockOrdersRepository, mockOrderFindOne } = vi.hoisted(() => {
	const mockOrderFindOne = vi.fn();
	const MockOrdersRepository = vi.fn(function (this: {
		findOne: typeof mockOrderFindOne;
	}) {
		this.findOne = mockOrderFindOne;
	});
	return { MockOrdersRepository, mockOrderFindOne };
});
```
Add the module mock next to the other repository `vi.mock(...)` calls:
```ts
vi.mock(
	"@repo/core/src/database/repositories/orders.repository",
	() => ({ OrdersRepository: MockOrdersRepository }),
);
```
Then add a test block (mirror the booking-notification tests — find `mockAuthFindUserById` / `mockNotificationCreate` already declared in the file and reuse them):
```ts
describe("notification.order_status_changed", () => {
	it("creates an in-app notification for the customer and pushes", async () => {
		mockOrderFindOne.mockResolvedValue({
			data: { id: "o1", userId: "u1", businessId: "biz1", status: "Confirmed" },
		});
		mockAuthFindUserById.mockResolvedValue({ id: "u1", pushToken: "ExpoTok[1]" });
		mockNotificationCreate.mockResolvedValue({ id: "n1" });
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ data: [{ status: "ok" }] }), { status: 200 }),
		);

		await handleQueue(
			batchOf({ type: "notification.order_status_changed", orderId: "o1", status: "Confirmed" }),
			TEST_ENV,
		);

		expect(mockNotificationCreate).toHaveBeenCalledWith(
			expect.objectContaining({ userId: "u1", orderId: "o1", go: "orders", type: "order" }),
		);
		expect(fetchSpy).toHaveBeenCalledOnce();
		fetchSpy.mockRestore();
	});

	it("uses type 'cancel' for a cancelled order and does not push without a token", async () => {
		mockOrderFindOne.mockResolvedValue({
			data: { id: "o2", userId: "u2", businessId: "biz1", status: "Cancelled" },
		});
		mockAuthFindUserById.mockResolvedValue({ id: "u2", pushToken: null });
		mockNotificationCreate.mockResolvedValue({ id: "n2" });
		const fetchSpy = vi.spyOn(globalThis, "fetch");

		await handleQueue(
			batchOf({ type: "notification.order_status_changed", orderId: "o2", status: "Cancelled" }),
			TEST_ENV,
		);

		expect(mockNotificationCreate).toHaveBeenCalledWith(
			expect.objectContaining({ userId: "u2", orderId: "o2", go: "orders", type: "cancel" }),
		);
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
```
> Use the file's existing helpers for `batchOf(...)`/`TEST_ENV`/`mockAuthFindUserById`/`mockNotificationCreate`. If they're named differently, grep the test file and match exactly (e.g. the booking test constructs a `MessageBatch` inline — copy that shape). Declare the orders `vi.mock` BEFORE `handleQueue` is imported (hoisted mocks already are).

- [ ] **Step 2: Run → fail.** `bun run --filter @repo/queue test src/__tests__/handler.test.ts` → FAIL (no dispatch case; `mockNotificationCreate` not called).

- [ ] **Step 3: Implement in `handler.ts`.**

(a) Import + add to `Repos`:
```ts
import { OrdersRepository } from "@repo/core/src/database/repositories/orders.repository";
```
In `interface Repos` add: `orders: OrdersRepository;`
In the `repos` object (in `handleQueue`) add: `orders: new OrdersRepository(db),`

(b) Extend `recordInAppNotification`'s `params` to accept the order shape — change its `go` and add `orderId`:
```ts
		go?: "bookings" | "reviews" | "orders";
		businessId?: string;
		bookingId?: string;
		reviewId?: string;
		orderId?: string;
```
and in the `repo.create({...})` body add: `orderId: params.orderId ?? null,`

(c) Add the dispatch case (in `dispatch`'s `switch`):
```ts
		case "notification.order_status_changed":
			return handleOrderStatusNotification(job.orderId, job.status, repos);
```

(d) Add the handler function:
```ts
async function handleOrderStatusNotification(
	orderId: string,
	status: string,
	{ auth, orders, notifications }: Repos,
): Promise<void> {
	const orderResult = await orders.findOne(orderId);
	const order = orderResult.data;
	if (!order) {
		logger.warn(WORKER, "Order not found for notification", { orderId, status });
		return;
	}

	const COPY: Record<string, { title: string; body: string }> = {
		Confirmed: { title: "Order confirmed", body: "Your order has been confirmed and is being prepared." },
		OutForDelivery: { title: "Out for delivery", body: "Your order is on its way." },
		Delivered: { title: "Order delivered", body: "Your order has been delivered. Enjoy!" },
		Cancelled: { title: "Order cancelled", body: "Your order has been cancelled." },
	};
	const copy = COPY[status];
	if (!copy) {
		logger.warn(WORKER, "No notification copy for order status — skipping", { orderId, status });
		return;
	}

	const customer = await auth.findUserById(order.userId as string);
	if (!customer) return;

	const notifType: NotificationTypeValue = status === "Cancelled" ? "cancel" : "order";
	await recordInAppNotification(notifications, {
		userId: customer.id,
		type: notifType,
		title: copy.title,
		body: copy.body,
		go: "orders",
		businessId: order.businessId as string,
		orderId,
	});
	if (customer.pushToken) {
		await pushAndCleanup(customer.id, customer.pushToken, copy.title, copy.body, auth);
		logger.info(WORKER, "Sent order status push to customer", { userId: customer.id, status });
	}
}
```

- [ ] **Step 4: Run → pass.** `bun run --filter @repo/queue test src/__tests__/handler.test.ts` → all pass (existing + 2 new).

- [ ] **Step 5: tsc + lint + commit**

```bash
bunx tsc --noEmit -p workers/queue/tsconfig.json 2>&1 | grep handler || echo "no new errors"
bunx biome check --write workers/queue/src/handler.ts workers/queue/src/__tests__/handler.test.ts
git add workers/queue/src/handler.ts workers/queue/src/__tests__/handler.test.ts
git commit -m "feat(queue): order_status_changed notification handler"
```

---

## Task 3: API — OrdersService queue + owner-cancel (TDD)

**Files:** `workers/api/src/modules/orders/orders.service.ts`, `workers/api/src/modules/orders/index.ts`, `workers/api/src/__tests__/modules/orders/orders.service.test.ts`, `workers/api/src/__tests__/modules/orders/orders.routes.test.ts`.

- [ ] **Step 1: Write failing service tests** — add to `orders.service.test.ts`. Add a `queue` mock and pass it as the 6th constructor arg in the `makeService()` factory:

```ts
const queue = { send: vi.fn() };
```
Update the existing factory to: `new OrdersService(repo as never, addressesRepo as never, branchesRepo as never, productsRepo as never, authz as never, queue as never)`. Add `assertOrderAccess` to the `authz` mock if not present. New tests:
```ts
describe("OrdersService queue + owner-cancel", () => {
	it("updateStatus (forward) enqueues an order_status_changed job", async () => {
		authz.assertOrderAccess.mockResolvedValue({ id: "o1", status: "Pending" });
		repo.updateStatus.mockResolvedValue({ data: { id: "o1", status: "Confirmed" } });
		await makeService().updateStatus("owner", "o1", "Confirmed", null);
		expect(queue.send).toHaveBeenCalledWith(
			expect.objectContaining({ type: "notification.order_status_changed", orderId: "o1", status: "Confirmed" }),
		);
	});

	it("owner cancels via updateStatus('Cancelled'): assertOrderAccess, restores stock, enqueues Cancelled, does NOT plain-update", async () => {
		authz.assertOrderAccess.mockResolvedValue({ id: "o1", status: "Confirmed" });
		repo.findItems.mockResolvedValue([{ productId: "p1", quantity: 2 }]);
		repo.cancelAndRestore.mockResolvedValue(undefined);
		const res = await makeService().updateStatus("owner", "o1", "Cancelled", null);
		expect(authz.assertOrderAccess).toHaveBeenCalledWith("owner", "o1", null);
		expect(repo.cancelAndRestore).toHaveBeenCalledOnce();
		expect(repo.updateStatus).not.toHaveBeenCalled(); // routed through restore path, not a plain flip
		expect(res.status).toBe("Cancelled");
		expect(queue.send).toHaveBeenCalledWith(
			expect.objectContaining({ type: "notification.order_status_changed", orderId: "o1", status: "Cancelled" }),
		);
	});

	it("owner updateStatus('Cancelled') on a Delivered order is rejected (422)", async () => {
		authz.assertOrderAccess.mockResolvedValue({ id: "o1", status: "Delivered" });
		await expect(
			makeService().updateStatus("owner", "o1", "Cancelled", null),
		).rejects.toBeInstanceOf(ValidationError);
	});

	it("customer cancel uses assertCustomerOwnsOrder, restores stock, and enqueues a Cancelled job", async () => {
		authz.assertCustomerOwnsOrder.mockResolvedValue({ id: "o1", status: "Pending" });
		repo.findItems.mockResolvedValue([]);
		repo.cancelAndRestore.mockResolvedValue(undefined);
		await makeService().cancel("u1", "o1");
		expect(authz.assertCustomerOwnsOrder).toHaveBeenCalledWith("u1", "o1");
		expect(queue.send).toHaveBeenCalledWith(
			expect.objectContaining({ type: "notification.order_status_changed", orderId: "o1", status: "Cancelled" }),
		);
	});
});
```

- [ ] **Step 2: Run → fail.** `cd workers/api && bun run test src/__tests__/modules/orders/orders.service.test.ts` → FAIL (constructor arity / `queue.send` not called).

- [ ] **Step 3: Implement in `orders.service.ts`.**

(a) Import the producer type:
```ts
import type { QueueProducer } from "@repo/core/src/queue/producer";
```
(b) Add the constructor param (last):
```ts
		private readonly authz: AuthorizationService,
		private readonly queue: QueueProducer,
```
(c) Add a private restore-aware cancel helper (used by both the customer `cancel` and the owner `updateStatus('Cancelled')` path) — place it after `cancel`:
```ts
	/** Restore stock, mark Cancelled, notify. Caller has already authorized + loaded the order. */
	private async doCancel(orderId: string, currentStatus: OrderStatusType): Promise<void> {
		if (currentStatus !== "Pending" && currentStatus !== "Confirmed") {
			throw new ValidationError(`Cannot cancel an order in ${currentStatus} state`);
		}
		const items = await this.repo.findItems(orderId);
		await this.repo.cancelAndRestore(orderId, items, new Date().toISOString());
		await this.queue.send({
			type: "notification.order_status_changed",
			orderId,
			status: "Cancelled",
		});
	}
```

(d) Replace `updateStatus` so it special-cases `Cancelled` (owner cancel) through `doCancel`, keeps the forward-only machine for the rest, and enqueues the notification:
```ts
	async updateStatus(
		actorId: string,
		orderId: string,
		next: OrderStatusType,
		scopedBranchIds: string[] | null,
	): Promise<OrderSelect> {
		const order = await this.authz.assertOrderAccess(
			actorId,
			orderId,
			scopedBranchIds,
		);

		// Owner-cancel: route through the restore-aware path, not a plain status flip.
		if (next === "Cancelled") {
			await this.doCancel(orderId, order.status as OrderStatusType);
			return { ...order, status: "Cancelled" } as OrderSelect;
		}

		const allowed = ALLOWED_TRANSITIONS[order.status as OrderStatusType] ?? [];
		if (!allowed.includes(next)) {
			throw new ValidationError(
				`Cannot move order from ${order.status} to ${next}`,
			);
		}
		const extra =
			next === "Delivered" ? { deliveredAt: new Date().toISOString() } : {};
		const result = await this.repo.updateStatus(orderId, next, extra);
		await this.queue.send({
			type: "notification.order_status_changed",
			orderId,
			status: next,
		});
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure
		return result.data!;
	}
```

(e) Update the customer `cancel` to delegate to `doCancel` (keeps the same 2-arg signature the customer route uses):
```ts
	async cancel(userId: string, orderId: string): Promise<void> {
		const order = await this.authz.assertCustomerOwnsOrder(userId, orderId);
		await this.doCancel(orderId, order.status as OrderStatusType);
	}
```
`ALLOWED_TRANSITIONS` stays forward-only (no `Cancelled` targets) — the `Cancelled` branch is handled before that table is consulted, so the stock-leak the table was protecting against cannot occur.

- [ ] **Step 4: Run → pass.** `cd workers/api && bun run test src/__tests__/modules/orders/orders.service.test.ts` → all pass.

- [ ] **Step 5: Wire `queue` into the installer + add the owner-cancel route** (`workers/api/src/modules/orders/index.ts`).

(a) `installOrdersService` — destructure `queue` from deps and pass it last:
```ts
export const installOrdersService: ServiceInstaller = (
	c,
	{ ordersRepo, customerAddressesRepo, branchesRepo, productsRepo, authz, queue },
) =>
	c.set(
		"ordersService",
		new OrdersService(
			ordersRepo,
			customerAddressesRepo,
			branchesRepo,
			productsRepo,
			authz,
			queue,
		),
	);
```
(b) Widen `UpdateStatusBody` to accept `Cancelled` (owner cancels via the existing status route — no new route, no path collision with the customer `PATCH /:id/cancel`). Find the `UpdateStatusBody` definition in `index.ts` and change its enum:
```ts
const UpdateStatusBody = z.object({
	status: z.enum(["Confirmed", "OutForDelivery", "Delivered", "Cancelled"]),
});
```
Update the `updateStatusRoute` summary to `"Update order status (incl. owner cancel)"`. No other route changes — the existing `updateStatusRoute` handler already forwards `status` to `ordersService.updateStatus`, which now routes `Cancelled` through the restore-aware path. The customer `cancelRoute` (`PATCH /:id/cancel`) is unchanged.

- [ ] **Step 6: Add owner-cancel route test** — owner cancels via the status route. In `orders.routes.test.ts`, inside the existing `describe("PATCH /api/v1/orders/:id/status ...")` block:
```ts
	it("200 when an owner cancels via status=Cancelled", async () => {
		mockOrdersService.updateStatus.mockResolvedValue({ id: "o1", status: "Cancelled" });
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request("/api/v1/orders/o1/status", {
			method: "PATCH",
			headers: { "Content-Type": "application/json", ...authHeader(token) },
			body: JSON.stringify({ status: "Cancelled" }),
		}, TEST_ENV);
		expect(res.status).toBe(200);
		expect(mockOrdersService.updateStatus).toHaveBeenCalledWith(
			"owner-1", "o1", "Cancelled", expect.anything(),
		);
	});
```
> The earlier backend slice added a test "422 for owner posting a non-forward status (Cancelled)" — that assertion is now obsolete (Cancelled is accepted). **Find and update/remove it** so it doesn't contradict the new behavior (it currently expects 422 at enum validation; the enum now allows Cancelled, and the mocked service won't throw). Replace it with the 200 case above or delete it.

- [ ] **Step 7: Run → pass + verify no new tsc errors.**

Run: `cd workers/api && bun run test src/__tests__/modules/orders/`
Expected: all pass.
Run: `bunx tsc --noEmit -p workers/api/tsconfig.json 2>&1 | grep -E "modules/orders"` → no output.

- [ ] **Step 8: Lint + commit**

```bash
bunx biome check --write workers/api/src/modules/orders/orders.service.ts workers/api/src/modules/orders/index.ts workers/api/src/__tests__/modules/orders/orders.service.test.ts workers/api/src/__tests__/modules/orders/orders.routes.test.ts
git add workers/api/src/modules/orders/ workers/api/src/__tests__/modules/orders/
git commit -m "feat(api): order status notifications + owner-cancel route"
```

---

## Task 4: DTO + api-client — expose orderId / go:"orders"

**Files:** `workers/api/src/modules/notifications/notifications.service.ts`, `packages/api-client/src/types.ts`.

- [ ] **Step 1: Extend the API DTO** — in `notifications.service.ts`:

In `NotificationDto` add `orderId: string | null;` and widen `go`:
```ts
	go: "bookings" | "reviews" | "orders" | null;
	orderId: string | null;
```
In `toDto(row)` add: `orderId: row.orderId,` and update the `go` cast type to include `"orders"`.

- [ ] **Step 2: Extend the api-client type** — in `packages/api-client/src/types.ts`:

Change `AppNotificationType`:
```ts
export type AppNotificationType = "booking" | "cancel" | "review" | "system" | "order";
```
In `AppNotification`, add `orderId: string | null;` and widen `go`:
```ts
	go: "bookings" | "reviews" | "orders" | null;
```

- [ ] **Step 3: Verify typecheck (both packages) + lint**

Run: `bunx tsc --noEmit -p workers/api/tsconfig.json 2>&1 | grep notifications` → no output.
Run: `bunx tsc --noEmit -p packages/api-client/tsconfig.json 2>&1 | grep types` → no output.
Run: `bunx biome check --write workers/api/src/modules/notifications/notifications.service.ts packages/api-client/src/types.ts`

- [ ] **Step 4: Commit**

```bash
git add workers/api/src/modules/notifications/notifications.service.ts packages/api-client/src/types.ts
git commit -m "feat(api,api-client): notification DTO carries orderId + go:orders"
```

---

## Task 5: Docs + final gate

**Files:** `workers/api/CLAUDE.md`, `docs/guides/api-endpoints.md`, `docs/guides/ui-backend-sync.md`.

- [ ] **Step 1:** `workers/api/CLAUDE.md` — under the Orders section, note: order status changes + owner-cancel enqueue `notification.order_status_changed`; owner-cancel is `PATCH /api/v1/orders/:id/cancel` (owner/manager, branch-scoped) and restores stock. Add `order` to the notification types list; mention `notifications.order_id` + `go:"orders"` deep-link.
- [ ] **Step 2:** `docs/guides/api-endpoints.md` — add the owner-cancel route; note order notifications.
- [ ] **Step 3:** `docs/guides/ui-backend-sync.md` — note the `go:"orders"` deep-link contract for the mobile notifications feed.
- [ ] **Step 4: Final gate.**

Run: `bun run lint` — touched files clean (repo baseline red is expected; confirm no NEW errors in touched files).
Run: `bun run api:test` — no new failures vs the ~20 pre-existing baseline; the new queue + orders tests pass.
Run: `bun run --filter @repo/queue test` — green.
Run: `bun run build` — succeeds.
Run: `bun run cli db fresh` — clean (0015 applies).

- [ ] **Step 5: Commit**

```bash
git add docs/ workers/api/CLAUDE.md
git commit -m "docs: order status notifications + owner-cancel"
```

---

## Self-Review notes

- **Spec coverage:** §1 notifications → Tasks 1–4; §2 owner-cancel → Task 3; testing → per-task TDD; docs → Task 5. Migration `0015` → Task 1.
- **Type consistency:** `notification.order_status_changed` payload `{ orderId, status: OrderStatusType }` is identical in jobs.ts (Task 1), the producer calls (Task 3), and the handler (Task 2). `go:"orders"` + `orderId` consistent across schema (T1), handler (T2), DTO + api-client (T4). `NotificationType` gains `"order"` in T1 and T4.
- **No new route / no path collision:** owner-cancel reuses `PATCH /:id/status` with `status:"Cancelled"` (routed through the restore-aware `doCancel`), avoiding a second `PATCH /:id/cancel` that the customer app would shadow. The customer `PATCH /:id/cancel` is unchanged. **Obsolete test to fix (Task 3 Step 6):** the backend slice's "422 for owner posting Cancelled" must be updated — Cancelled is now a valid status payload.
- **Stock-invariant preserved:** `ALLOWED_TRANSITIONS` stays forward-only; `Cancelled` is intercepted before that table and always goes through `cancelAndRestore` (never a plain status flip), for both customer and owner. Two call sites (`cancel`, `updateStatus`) share the private `doCancel` helper — no duplicated restore logic.
- **Spec deviation (intentional):** spec §2 proposed a dedicated owner `PATCH /:id/cancel` route; this plan implements the same capability via `status:"Cancelled"` because the dedicated path collides with the customer cancel route under the two-app mount. Capability is identical (owner cancels + stock restored + notified). Spec §2 updated to match.
- **Issue refs:** commits omit `(#NN)`; this is part of #73 (and unblocks #72's notifications). Tick the relevant boxes in Task 5 / at PR time.
