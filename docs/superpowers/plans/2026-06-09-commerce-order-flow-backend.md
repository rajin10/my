# Commerce Order Flow — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend for the commerce order flow — `customer_addresses`, `orders`, `order_items` tables with CRUD/placement/cancellation API, ownership enforcement, and the atomic stock invariant.

**Architecture:** Mirror the merged `products` slice (#71). Two per-resource Hono modules (`orders`, `customer-addresses`), two repositories in `@repo/core`, three new schemas, a hand-authored additive migration `0014`, and three new `AuthorizationService` methods. Order placement uses a single `db.batch()` whose `CHECK(stock >= 0)` constraint makes oversell impossible under a race; the service maps the resulting SQLite error to a 409.

**Tech Stack:** Hono + `@hono/zod-openapi`, Drizzle ORM, Cloudflare D1 (SQLite), Vitest (Node, mocked repos/services).

**Scope:** Backend + api-client only. The two Expo UIs (mobile-app customer ordering, owner-app fulfillment) are a **separate follow-up plan** written after this lands and the api-client types exist.

**Spec:** [docs/superpowers/specs/2026-06-09-commerce-order-flow-design.md](../specs/2026-06-09-commerce-order-flow-design.md)
**Schema source of truth (verbatim):** [docs/plan/multi-vertical-schema-design.md](../../plan/multi-vertical-schema-design.md) §"Phase 1 — commerce (LPG) tables".

**Commands** (from repo root unless noted): `bun run api:test` (api tests), `bun run lint`, `bun run build`. Run a single test file: `bun run --filter @repo/api test <path>` or `cd workers/api && bun run test <path>`.

---

## File Structure

**Create:**
- `packages/core/src/database/schema/orders.schema.ts`
- `packages/core/src/database/schema/order-items.schema.ts`
- `packages/core/src/database/schema/customer-addresses.schema.ts`
- `packages/core/src/database/repositories/orders.repository.ts`
- `packages/core/src/database/repositories/customer-addresses.repository.ts`
- `workers/api/src/database/migrations/0014_commerce_orders.sql`
- `workers/api/src/modules/orders/index.ts`
- `workers/api/src/modules/orders/orders.service.ts`
- `workers/api/src/modules/customer-addresses/index.ts`
- `workers/api/src/modules/customer-addresses/customer-addresses.service.ts`
- `workers/api/src/__tests__/modules/orders/orders.service.test.ts`
- `workers/api/src/__tests__/modules/orders/orders.routes.test.ts`
- `workers/api/src/__tests__/modules/customer-addresses/customer-addresses.service.test.ts`
- `workers/api/src/__tests__/modules/customer-addresses/customer-addresses.routes.test.ts`
- `packages/api-client/src/endpoints/orders.ts`
- `packages/api-client/src/endpoints/customer-addresses.ts`

**Modify:**
- `packages/core/src/database/schema/index.ts` — re-export new schemas/types
- `workers/api/src/database/migrations/meta/_journal.json` — register `0014`
- `workers/api/src/core/authorization.ts` — 2 new repo deps + 3 methods
- `workers/api/src/middleware/shared-deps.ts` — add `ordersRepo`, `customerAddressesRepo`
- `workers/api/src/middleware/services.ts` — construct + wire the 2 new repos
- `workers/api/src/modules/routes.ts` — mount the 2 new modules
- `workers/api/src/__tests__/helpers/create-test-app.ts` — register the 2 new module apps
- `workers/api/src/__tests__/core/authorization.test.ts` — update `new AuthorizationService(...)` call
- `packages/api-client/src/types.ts` (or wherever `Product` type lives) — add `Order`, `OrderItem`, `OrderStatus`, `CustomerAddress`
- `packages/api-client/src/client.ts` (endpoint registration) — register new endpoint groups
- Docs (final task)

---

## Task 1: Schemas

**Files:**
- Create: `packages/core/src/database/schema/orders.schema.ts`
- Create: `packages/core/src/database/schema/order-items.schema.ts`
- Create: `packages/core/src/database/schema/customer-addresses.schema.ts`
- Modify: `packages/core/src/database/schema/index.ts`

- [ ] **Step 1: Create `orders.schema.ts`** (verbatim from design doc §180)

```ts
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { primaryID, timestamps } from "../helpers";
import { branchesSchema } from "./branches.schema";
import { businessesSchema } from "./businesses.schema";
import { usersSchema } from "./users.schema";

export const OrderStatus = {
	PENDING: "Pending",
	CONFIRMED: "Confirmed",
	OUT_FOR_DELIVERY: "OutForDelivery",
	DELIVERED: "Delivered",
	CANCELLED: "Cancelled",
} as const;
export type OrderStatusType = (typeof OrderStatus)[keyof typeof OrderStatus];

export const ordersSchema = sqliteTable(
	"orders",
	{
		...primaryID(),
		businessId: text("business_id")
			.notNull()
			.references(() => businessesSchema.id),
		branchId: text("branch_id")
			.notNull()
			.references(() => branchesSchema.id),
		userId: text("user_id")
			.notNull()
			.references(() => usersSchema.id),
		status: text({
			enum: ["Pending", "Confirmed", "OutForDelivery", "Delivered", "Cancelled"],
		})
			.notNull()
			.default("Pending"),
		total: integer().notNull(),
		deliveryLine: text("delivery_line").notNull(),
		deliveryArea: text("delivery_area"),
		deliveryCity: text("delivery_city"),
		deliveryLat: real("delivery_lat"),
		deliveryLng: real("delivery_lng"),
		deliveredAt: text("delivered_at"),
		...timestamps(),
	},
	(t) => [
		index("orders_business_id_idx").on(t.businessId),
		index("orders_branch_id_idx").on(t.branchId),
		index("orders_user_id_idx").on(t.userId),
		index("orders_status_idx").on(t.status),
		index("orders_business_user_idx").on(t.businessId, t.userId),
	],
);

export type OrderSelect = typeof ordersSchema.$inferSelect;
export type OrderInsert = Omit<
	typeof ordersSchema.$inferInsert,
	"id" | "createdAt" | "updatedAt" | "deletedAt"
>;
```

- [ ] **Step 2: Create `order-items.schema.ts`** (verbatim from design doc §228)

```ts
import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { primaryID, timestamps } from "../helpers";
import { ordersSchema } from "./orders.schema";
import { productsSchema } from "./products.schema";

export const orderItemsSchema = sqliteTable(
	"order_items",
	{
		...primaryID(),
		orderId: text("order_id")
			.notNull()
			.references(() => ordersSchema.id, { onDelete: "cascade" }),
		productId: text("product_id")
			.notNull()
			.references(() => productsSchema.id),
		quantity: integer().notNull(),
		unitPrice: integer("unit_price").notNull(),
		...timestamps(),
	},
	(t) => [
		index("order_items_order_id_idx").on(t.orderId),
		index("order_items_product_id_idx").on(t.productId),
		check("order_items_qty_positive", sql`${t.quantity} > 0`),
	],
);

export type OrderItemSelect = typeof orderItemsSchema.$inferSelect;
export type OrderItemInsert = Omit<
	typeof orderItemsSchema.$inferInsert,
	"id" | "createdAt" | "updatedAt" | "deletedAt"
>;
```

- [ ] **Step 3: Create `customer-addresses.schema.ts`** (verbatim from design doc §287)

```ts
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { primaryID, timestamps } from "../helpers";
import { usersSchema } from "./users.schema";

export const customerAddressesSchema = sqliteTable(
	"customer_addresses",
	{
		...primaryID(),
		userId: text("user_id")
			.notNull()
			.references(() => usersSchema.id, { onDelete: "cascade" }),
		label: text(),
		line: text().notNull(),
		area: text(),
		city: text(),
		lat: real(),
		lng: real(),
		isDefault: integer("is_default", { mode: "boolean" })
			.notNull()
			.default(false),
		...timestamps(),
	},
	(t) => [index("customer_addresses_user_id_idx").on(t.userId)],
);

export type CustomerAddressSelect = typeof customerAddressesSchema.$inferSelect;
export type CustomerAddressInsert = Omit<
	typeof customerAddressesSchema.$inferInsert,
	"id" | "createdAt" | "updatedAt" | "deletedAt"
>;
```

- [ ] **Step 4: Re-export from `schema/index.ts`** — add these blocks (keep alphabetical-ish grouping consistent with the file; insert near the existing `customer`/`order`/`products` neighbours):

```ts
export type {
	CustomerAddressInsert,
	CustomerAddressSelect,
} from "./customer-addresses.schema";
export { customerAddressesSchema } from "./customer-addresses.schema";
export type { OrderItemInsert, OrderItemSelect } from "./order-items.schema";
export { orderItemsSchema } from "./order-items.schema";
export type {
	OrderInsert,
	OrderSelect,
	OrderStatusType,
} from "./orders.schema";
export { OrderStatus, ordersSchema } from "./orders.schema";
```

- [ ] **Step 5: Typecheck the schemas**

Run: `bun run build` (or `bun run --filter @repo/core build` if defined)
Expected: PASS — no type errors. If `helpers` path or `primaryID`/`timestamps` names differ, open `packages/core/src/database/helpers.ts` and match exactly.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/database/schema/
git commit -m "feat(core): orders + order_items + customer_addresses schemas (#<issue>)"
```

---

## Task 2: Migration 0014 (hand-authored, additive)

**Files:**
- Create: `workers/api/src/database/migrations/0014_commerce_orders.sql`
- Modify: `workers/api/src/database/migrations/meta/_journal.json`

> Hand-authored (not `drizzle-kit generate`) because the snapshot chain is broken (missing `0007`/`0012`/`0013` snapshots) — generating would re-propose the data-preserving `0012` rename. This mirrors how `0013` was done.

- [ ] **Step 1: Write `0014_commerce_orders.sql`** (DDL style copied from `0013`; column names match the schemas — `timestamps()` emits `createdAt`/`updatedAt`/`deletedAt`)

```sql
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	`total` integer NOT NULL,
	`delivery_line` text NOT NULL,
	`delivery_area` text,
	`delivery_city` text,
	`delivery_lat` real,
	`delivery_lng` real,
	`delivered_at` text,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `orders_business_id_idx` ON `orders` (`business_id`);--> statement-breakpoint
CREATE INDEX `orders_branch_id_idx` ON `orders` (`branch_id`);--> statement-breakpoint
CREATE INDEX `orders_user_id_idx` ON `orders` (`user_id`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `orders_business_user_idx` ON `orders` (`business_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT `order_items_qty_positive` CHECK(`quantity` > 0)
);
--> statement-breakpoint
CREATE INDEX `order_items_order_id_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_items_product_id_idx` ON `order_items` (`product_id`);--> statement-breakpoint
CREATE TABLE `customer_addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text,
	`line` text NOT NULL,
	`area` text,
	`city` text,
	`lat` real,
	`lng` real,
	`is_default` integer DEFAULT false NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `customer_addresses_user_id_idx` ON `customer_addresses` (`user_id`);
```

- [ ] **Step 2: Register in `_journal.json`** — append after the `0013_commerce_products` entry (inside `entries`), incrementing `idx` to 14 and `when` to be strictly greater than `0013`'s:

```json
    {
      "idx": 14,
      "version": "6",
      "when": 1780957481720,
      "tag": "0014_commerce_orders",
      "breakpoints": true
    }
```

- [ ] **Step 3: Verify the CHECK survived** (the load-bearing grep)

Run: `grep -n "order_items_qty_positive" workers/api/src/database/migrations/0014_commerce_orders.sql`
Expected: one line containing `CHECK(\`quantity\` > 0)`. (There is no `stock` CHECK in this migration — that lives in `0013`; orders only adds the qty CHECK.)

- [ ] **Step 4: Replay the migration in the test DB / fresh seed**

Run: `bun run cli db fresh`
Expected: completes without error; `orders`, `order_items`, `customer_addresses` tables created. Then `bun run cli db status` lists the three new tables (0 rows is fine — seeders come in Task 9).

- [ ] **Step 5: Commit**

```bash
git add workers/api/src/database/migrations/0014_commerce_orders.sql workers/api/src/database/migrations/meta/_journal.json
git commit -m "feat(db): migration 0014 commerce orders (additive) (#<issue>)"
```

---

## Task 3: Repositories

**Files:**
- Create: `packages/core/src/database/repositories/orders.repository.ts`
- Create: `packages/core/src/database/repositories/customer-addresses.repository.ts`

> The orders repo models its list/allowlist on `BookingsRepository` (products has no `findAll`). It also owns `order_items` access and the two atomic `db.batch()` operations. The repo just runs the batch and lets it throw — the CHECK→409 mapping is the **service's** job (Task 5).

- [ ] **Step 1: Create `orders.repository.ts`**

```ts
import { and, eq, isNull, sql } from "drizzle-orm";
import type {
	ApiResponse,
	BaseQueryDto,
	PaginatedQueryDto,
	PaginatedResponse,
} from "../../http/response";
import type { DbClient } from "../client";
import type {
	OrderInsert,
	OrderItemInsert,
	OrderItemSelect,
	OrderSelect,
} from "../schema";
import {
	branchesSchema,
	orderItemsSchema,
	ordersSchema,
	productsSchema,
} from "../schema";
import { BaseRepository, type QueryAllowlist } from "./base.repository";

export class OrdersRepository {
	constructor(private readonly db: DbClient) {}

	private static readonly queryAllowlist: QueryAllowlist = {
		filterable: ["status", "branchId", "businessId", "userId"],
		searchable: [],
		sortable: ["createdAt", "total", "status"],
	};

	async findAll(
		query: PaginatedQueryDto,
	): Promise<PaginatedResponse<OrderSelect>> {
		return BaseRepository.findAll(
			this.db,
			ordersSchema,
			query,
			OrdersRepository.queryAllowlist,
		) as Promise<PaginatedResponse<OrderSelect>>;
	}

	async findOne(
		id: string,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<OrderSelect | null>> {
		return BaseRepository.findOne(this.db, ordersSchema, id, query, [
			"id",
		]) as Promise<ApiResponse<OrderSelect | null>>;
	}

	async findByUser(userId: string): Promise<OrderSelect[]> {
		return this.db
			.select()
			.from(ordersSchema)
			.where(
				and(eq(ordersSchema.userId, userId), isNull(ordersSchema.deletedAt)),
			);
	}

	async findByBranch(branchId: string): Promise<OrderSelect[]> {
		return this.db
			.select()
			.from(ordersSchema)
			.where(
				and(eq(ordersSchema.branchId, branchId), isNull(ordersSchema.deletedAt)),
			);
	}

	async findItems(orderId: string): Promise<OrderItemSelect[]> {
		return this.db
			.select()
			.from(orderItemsSchema)
			.where(eq(orderItemsSchema.orderId, orderId));
	}

	/**
	 * Atomic order placement. Decrements each line's stock unconditionally (the
	 * `CHECK(stock >= 0)` aborts the whole batch on oversell), then inserts the
	 * order + items. Throws the raw SQLite/D1 error on constraint violation —
	 * the service maps it to a 409.
	 */
	async placeOrder(
		order: OrderInsert & { id: string },
		items: (OrderItemInsert & { id: string })[],
	): Promise<void> {
		await this.db.batch([
			...items.map((it) =>
				this.db
					.update(productsSchema)
					.set({ stock: sql`${productsSchema.stock} - ${it.quantity}` })
					.where(eq(productsSchema.id, it.productId)),
			),
			this.db.insert(ordersSchema).values(order),
			...items.map((it) => this.db.insert(orderItemsSchema).values(it)),
		] as never);
	}

	/** Atomic cancel: restore each line's stock and flip status to Cancelled. */
	async cancelAndRestore(
		orderId: string,
		items: OrderItemSelect[],
		updatedAt: string,
	): Promise<void> {
		await this.db.batch([
			...items.map((it) =>
				this.db
					.update(productsSchema)
					.set({ stock: sql`${productsSchema.stock} + ${it.quantity}` })
					.where(eq(productsSchema.id, it.productId)),
			),
			this.db
				.update(ordersSchema)
				.set({ status: "Cancelled", updatedAt })
				.where(eq(ordersSchema.id, orderId)),
		] as never);
	}

	async updateStatus(
		id: string,
		status: OrderSelect["status"],
		extra: Partial<OrderInsert> = {},
	): Promise<ApiResponse<OrderSelect | null>> {
		return BaseRepository.updateOne(
			this.db,
			ordersSchema,
			id,
			{ status, ...extra } as Partial<OrderInsert>,
			{},
			["id"],
		) as Promise<ApiResponse<OrderSelect | null>>;
	}
}
```

> **Note on `db.batch`:** drizzle's D1 driver exposes `db.batch([...])`. If the `DbClient` type doesn't surface `.batch` cleanly, the `as never` cast on the array keeps the call site typed; verify at runtime via the Task 5 service test (which mocks the repo) and the `db fresh` smoke. If `.batch` is genuinely absent on the local driver, fall back to drizzle's `db.transaction` — but D1 prod requires `batch` (no interactive txns), so prefer `batch`.

- [ ] **Step 2: Create `customer-addresses.repository.ts`**

```ts
import { and, eq, isNull } from "drizzle-orm";
import type { ApiResponse, BaseQueryDto } from "../../http/response";
import type { DbClient } from "../client";
import type { CustomerAddressInsert, CustomerAddressSelect } from "../schema";
import { customerAddressesSchema } from "../schema";
import { BaseRepository } from "./base.repository";

export class CustomerAddressesRepository {
	constructor(private readonly db: DbClient) {}

	async findByUser(userId: string): Promise<CustomerAddressSelect[]> {
		return this.db
			.select()
			.from(customerAddressesSchema)
			.where(
				and(
					eq(customerAddressesSchema.userId, userId),
					isNull(customerAddressesSchema.deletedAt),
				),
			);
	}

	async findOne(
		id: string,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<CustomerAddressSelect | null>> {
		return BaseRepository.findOne(
			this.db,
			customerAddressesSchema,
			id,
			query,
			["id"],
		) as Promise<ApiResponse<CustomerAddressSelect | null>>;
	}

	async create(
		data: CustomerAddressInsert,
	): Promise<ApiResponse<CustomerAddressSelect | null>> {
		return BaseRepository.create(
			this.db,
			customerAddressesSchema,
			data,
		) as Promise<ApiResponse<CustomerAddressSelect | null>>;
	}

	async updateOne(
		id: string,
		data: Partial<CustomerAddressInsert>,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<CustomerAddressSelect | null>> {
		return BaseRepository.updateOne(
			this.db,
			customerAddressesSchema,
			id,
			data,
			query,
			["id"],
		) as Promise<ApiResponse<CustomerAddressSelect | null>>;
	}

	async deleteOne(
		id: string,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<CustomerAddressSelect | null>> {
		return BaseRepository.deleteOne(
			this.db,
			customerAddressesSchema,
			id,
			query,
			["id"],
		) as Promise<ApiResponse<CustomerAddressSelect | null>>;
	}

	/** Clears the default flag on all of a user's addresses (used before setting a new default). */
	async clearDefault(userId: string): Promise<void> {
		await this.db
			.update(customerAddressesSchema)
			.set({ isDefault: false })
			.where(eq(customerAddressesSchema.userId, userId));
	}
}
```

- [ ] **Step 3: Typecheck**

Run: `bun run build`
Expected: PASS. (Confirm `PaginatedQueryDto`/`PaginatedResponse`/`BaseQueryDto` import paths against `bookings.repository.ts`.)

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/database/repositories/orders.repository.ts packages/core/src/database/repositories/customer-addresses.repository.ts
git commit -m "feat(core): orders + customer-addresses repositories (#<issue>)"
```

---

## Task 4: AuthorizationService methods

**Files:**
- Modify: `workers/api/src/core/authorization.ts`
- Modify: `workers/api/src/__tests__/core/authorization.test.ts`

- [ ] **Step 1: Add constructor deps + imports.** At the top, add type imports:

```ts
import type { OrdersRepository } from "@repo/core/src/database/repositories/orders.repository";
import type { CustomerAddressesRepository } from "@repo/core/src/database/repositories/customer-addresses.repository";
```

Add to the import of schema types: `OrderSelect`, `CustomerAddressSelect`. Then append two constructor params (after `reviewsRepo`):

```ts
		private readonly ordersRepo: OrdersRepository,
		private readonly customerAddressesRepo: CustomerAddressesRepository,
```

- [ ] **Step 2: Add the three methods** (place near `assertBookingAccess` / `assertCustomerOwnsBooking`):

```ts
	/** Branch-scoped access to an order (owner/manager view). Returns the order. */
	async assertOrderAccess(
		actorId: string,
		orderId: string,
		scopedBranchIds: string[] | null,
	): Promise<OrderSelect> {
		const order = await this.ordersRepo.findOne(orderId);
		if (!order.data) throw new NotFoundError("Order not found");
		await this.assertBranchAccess(actorId, order.data.branchId, scopedBranchIds);
		return order.data as OrderSelect;
	}

	/** Customer owns their own order. Returns the order. */
	async assertCustomerOwnsOrder(
		userId: string,
		orderId: string,
	): Promise<OrderSelect> {
		const order = await this.ordersRepo.findOne(orderId);
		if (!order.data) throw new NotFoundError("Order not found");
		if (order.data.userId !== userId) {
			throw new ForbiddenError("You do not own this order");
		}
		return order.data as OrderSelect;
	}

	/** Customer owns their own address. Returns the address. */
	async assertCustomerOwnsAddress(
		userId: string,
		addressId: string,
	): Promise<CustomerAddressSelect> {
		const address = await this.customerAddressesRepo.findOne(addressId);
		if (!address.data) throw new NotFoundError("Address not found");
		if (address.data.userId !== userId) {
			throw new ForbiddenError("You do not own this address");
		}
		return address.data as CustomerAddressSelect;
	}
```

- [ ] **Step 3: Write/extend the failing test** in `authorization.test.ts` — add cases mirroring the booking ones. First update its `new AuthorizationService(...)` construction to pass two extra mock repos (`{ findOne: vi.fn() }` shaped). Add:

```ts
it("assertCustomerOwnsOrder throws 403 when the order belongs to another user", async () => {
	ordersRepo.findOne.mockResolvedValue({ data: { id: "o1", userId: "other" } });
	await expect(
		authz.assertCustomerOwnsOrder("me", "o1"),
	).rejects.toThrow(ForbiddenError);
});

it("assertCustomerOwnsOrder returns the order when owned", async () => {
	ordersRepo.findOne.mockResolvedValue({ data: { id: "o1", userId: "me" } });
	await expect(authz.assertCustomerOwnsOrder("me", "o1")).resolves.toMatchObject({ id: "o1" });
});

it("assertCustomerOwnsAddress throws 404 when missing", async () => {
	customerAddressesRepo.findOne.mockResolvedValue({ data: null });
	await expect(
		authz.assertCustomerOwnsAddress("me", "missing"),
	).rejects.toThrow(NotFoundError);
});
```

(Match the existing test's mock-repo construction style — grep the file for how `bookingsRepo`/`productsRepo` mocks are declared and copy that shape for `ordersRepo`/`customerAddressesRepo`.)

- [ ] **Step 4: Run the test to verify it fails, then passes after Steps 1–2 are in**

Run: `cd workers/api && bun run test src/__tests__/core/authorization.test.ts`
Expected: the three new cases pass; no pre-existing cases regress.

- [ ] **Step 5: Commit**

```bash
git add workers/api/src/core/authorization.ts workers/api/src/__tests__/core/authorization.test.ts
git commit -m "feat(api): assertOrderAccess/OwnsOrder/OwnsAddress authorization (#<issue>)"
```

---

## Task 5: Orders service (the commerce invariant) + tests

**Files:**
- Create: `workers/api/src/modules/orders/orders.service.ts`
- Create: `workers/api/src/__tests__/modules/orders/orders.service.test.ts`

> This is the load-bearing task. TDD: write the service tests first, watch them fail, implement.

- [ ] **Step 1: Write the failing service test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, ValidationError } from "../../../core/errors";
import { OrdersService } from "../../../modules/orders/orders.service";

const repo = {
	findAll: vi.fn(),
	findOne: vi.fn(),
	findByUser: vi.fn(),
	findByBranch: vi.fn(),
	findItems: vi.fn(),
	placeOrder: vi.fn(),
	cancelAndRestore: vi.fn(),
	updateStatus: vi.fn(),
};
const addressesRepo = { findOne: vi.fn() };
const branchesRepo = { findOne: vi.fn() };
const productsRepo = { findOne: vi.fn() };
const authz = {
	assertOrderAccess: vi.fn(),
	assertCustomerOwnsOrder: vi.fn(),
};

function makeService() {
	return new OrdersService(
		repo as never,
		addressesRepo as never,
		branchesRepo as never,
		productsRepo as never,
		authz as never,
	);
}

beforeEach(() => vi.clearAllMocks());

describe("OrdersService.create", () => {
	it("snapshots address + prices, derives businessId, places the order", async () => {
		branchesRepo.findOne.mockResolvedValue({ data: { id: "b1", businessId: "biz1" } });
		addressesRepo.findOne.mockResolvedValue({
			data: { id: "a1", userId: "u1", line: "12 Road", area: "Banani", city: "Dhaka", lat: 1, lng: 2 },
		});
		productsRepo.findOne
			.mockResolvedValueOnce({ data: { id: "p1", branchId: "b1", price: 1200, stock: 10 } });
		repo.placeOrder.mockResolvedValue(undefined);

		const order = await makeService().create("u1", {
			branchId: "b1",
			addressId: "a1",
			items: [{ productId: "p1", quantity: 2 }],
		});

		expect(order.businessId).toBe("biz1");
		expect(order.total).toBe(2400);
		expect(order.deliveryLine).toBe("12 Road");
		expect(repo.placeOrder).toHaveBeenCalledOnce();
	});

	it("maps a CHECK constraint violation to 409 (oversell)", async () => {
		branchesRepo.findOne.mockResolvedValue({ data: { id: "b1", businessId: "biz1" } });
		addressesRepo.findOne.mockResolvedValue({ data: { id: "a1", userId: "u1", line: "x" } });
		productsRepo.findOne.mockResolvedValue({ data: { id: "p1", branchId: "b1", price: 100, stock: 1 } });
		repo.placeOrder.mockRejectedValue(
			Object.assign(new Error("CHECK constraint failed: products_stock_nonneg"), {
				code: "SQLITE_CONSTRAINT_CHECK",
			}),
		);

		await expect(
			makeService().create("u1", { branchId: "b1", addressId: "a1", items: [{ productId: "p1", quantity: 5 }] }),
		).rejects.toBeInstanceOf(ConflictError);
	});

	it("rejects an address that belongs to another user", async () => {
		branchesRepo.findOne.mockResolvedValue({ data: { id: "b1", businessId: "biz1" } });
		addressesRepo.findOne.mockResolvedValue({ data: { id: "a1", userId: "someone-else", line: "x" } });
		await expect(
			makeService().create("u1", { branchId: "b1", addressId: "a1", items: [{ productId: "p1", quantity: 1 }] }),
		).rejects.toBeTruthy();
	});
});

describe("OrdersService.updateStatus", () => {
	it("allows Pending -> Confirmed", async () => {
		authz.assertOrderAccess.mockResolvedValue({ id: "o1", status: "Pending" });
		repo.updateStatus.mockResolvedValue({ data: { id: "o1", status: "Confirmed" } });
		const res = await makeService().updateStatus("owner", "o1", "Confirmed", null);
		expect(res.status).toBe("Confirmed");
	});

	it("rejects Delivered -> Pending (422)", async () => {
		authz.assertOrderAccess.mockResolvedValue({ id: "o1", status: "Delivered" });
		await expect(
			makeService().updateStatus("owner", "o1", "Pending", null),
		).rejects.toBeInstanceOf(ValidationError);
	});

	it("stamps deliveredAt when moving to Delivered", async () => {
		authz.assertOrderAccess.mockResolvedValue({ id: "o1", status: "OutForDelivery" });
		repo.updateStatus.mockResolvedValue({ data: { id: "o1", status: "Delivered" } });
		await makeService().updateStatus("owner", "o1", "Delivered", null);
		const extra = repo.updateStatus.mock.calls[0][2];
		expect(extra.deliveredAt).toBeTruthy();
	});
});

describe("OrdersService.cancel", () => {
	it("restores stock and cancels a Pending order", async () => {
		authz.assertCustomerOwnsOrder.mockResolvedValue({ id: "o1", status: "Pending" });
		repo.findItems.mockResolvedValue([{ productId: "p1", quantity: 2 }]);
		repo.cancelAndRestore.mockResolvedValue(undefined);
		await makeService().cancel("u1", "o1");
		expect(repo.cancelAndRestore).toHaveBeenCalledOnce();
	});

	it("rejects cancelling a Delivered order (422)", async () => {
		authz.assertCustomerOwnsOrder.mockResolvedValue({ id: "o1", status: "Delivered" });
		await expect(makeService().cancel("u1", "o1")).rejects.toBeInstanceOf(ValidationError);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd workers/api && bun run test src/__tests__/modules/orders/orders.service.test.ts`
Expected: FAIL — `Cannot find module '.../orders.service'`.

- [ ] **Step 3: Implement `orders.service.ts`**

```ts
import type { CustomerAddressesRepository } from "@repo/core/src/database/repositories/customer-addresses.repository";
import type { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import type { OrdersRepository } from "@repo/core/src/database/repositories/orders.repository";
import type { ProductsRepository } from "@repo/core/src/database/repositories/products.repository";
import type { OrderSelect, OrderStatusType } from "@repo/core/src/database/schema";
import type { PaginatedQueryDto } from "@repo/core/src/http/response";
import type { AuthorizationService } from "../../core/authorization";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../core/errors";

export interface PlaceOrderInput {
	branchId: string;
	addressId: string;
	items: { productId: string; quantity: number }[];
}

const ALLOWED_TRANSITIONS: Record<OrderStatusType, OrderStatusType[]> = {
	Pending: ["Confirmed", "Cancelled"],
	Confirmed: ["OutForDelivery", "Cancelled"],
	OutForDelivery: ["Delivered"],
	Delivered: [],
	Cancelled: [],
};

export class OrdersService {
	constructor(
		private readonly repo: OrdersRepository,
		private readonly addressesRepo: CustomerAddressesRepository,
		private readonly branchesRepo: BranchesRepository,
		private readonly productsRepo: ProductsRepository,
		private readonly authz: AuthorizationService,
	) {}

	async create(userId: string, input: PlaceOrderInput): Promise<OrderSelect> {
		if (input.items.length === 0) {
			throw new ValidationError("An order must contain at least one item");
		}

		const branch = await this.branchesRepo.findOne(input.branchId);
		if (!branch.data) throw new NotFoundError("Branch not found");
		const businessId = branch.data.businessId;

		const address = await this.addressesRepo.findOne(input.addressId);
		if (!address.data) throw new NotFoundError("Address not found");
		if (address.data.userId !== userId) {
			throw new ForbiddenError("You do not own this address");
		}

		// Snapshot prices; build line items.
		let total = 0;
		const items: { id: string; orderId: string; productId: string; quantity: number; unitPrice: number }[] = [];
		const orderId = crypto.randomUUID();
		for (const line of input.items) {
			const product = await this.productsRepo.findOne(line.productId);
			if (!product.data) throw new NotFoundError(`Product ${line.productId} not found`);
			if (product.data.branchId !== input.branchId) {
				throw new ValidationError("All items must belong to the order's branch");
			}
			const unitPrice = product.data.price;
			total += unitPrice * line.quantity;
			items.push({
				id: crypto.randomUUID(),
				orderId,
				productId: line.productId,
				quantity: line.quantity,
				unitPrice,
			});
		}

		const order = {
			id: orderId,
			businessId,
			branchId: input.branchId,
			userId,
			status: "Pending" as const,
			total,
			deliveryLine: address.data.line,
			deliveryArea: address.data.area ?? null,
			deliveryCity: address.data.city ?? null,
			deliveryLat: address.data.lat ?? null,
			deliveryLng: address.data.lng ?? null,
			deliveredAt: null,
		};

		try {
			await this.repo.placeOrder(order, items);
		} catch (err) {
			// CHECK(stock >= 0) aborts the batch on oversell; SQLite/D1 surface
			// "CHECK constraint failed: ...". Map to 409 instead of a 500.
			if (String((err as { message?: string })?.message ?? err).includes("CHECK constraint failed")) {
				throw new ConflictError("One or more items are out of stock");
			}
			throw err;
		}

		return order as OrderSelect;
	}

	listMine(userId: string) {
		return this.repo.findByUser(userId);
	}

	async get(actorId: string, orderId: string, scopedBranchIds: string[] | null, asOwner: boolean) {
		const order = asOwner
			? await this.authz.assertOrderAccess(actorId, orderId, scopedBranchIds)
			: await this.authz.assertCustomerOwnsOrder(actorId, orderId);
		const items = await this.repo.findItems(orderId);
		return { ...order, items };
	}

	listByBranch(branchId: string) {
		return this.repo.findByBranch(branchId);
	}

	async updateStatus(
		actorId: string,
		orderId: string,
		next: OrderStatusType,
		scopedBranchIds: string[] | null,
	): Promise<OrderSelect> {
		const order = await this.authz.assertOrderAccess(actorId, orderId, scopedBranchIds);
		const allowed = ALLOWED_TRANSITIONS[order.status as OrderStatusType] ?? [];
		if (!allowed.includes(next)) {
			throw new ValidationError(`Cannot move order from ${order.status} to ${next}`);
		}
		const extra = next === "Delivered" ? { deliveredAt: new Date().toISOString() } : {};
		const result = await this.repo.updateStatus(orderId, next, extra);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure
		return result.data!;
	}

	async cancel(userId: string, orderId: string): Promise<void> {
		const order = await this.authz.assertCustomerOwnsOrder(userId, orderId);
		if (order.status !== "Pending" && order.status !== "Confirmed") {
			throw new ValidationError(`Cannot cancel an order in ${order.status} state`);
		}
		const items = await this.repo.findItems(orderId);
		await this.repo.cancelAndRestore(orderId, items, new Date().toISOString());
	}
}
```

> **Note:** `cancel` is customer-initiated here (self-owned). The spec also allows owner cancellation; that path is added in Task 6 via a status-route guard if needed, but keep the customer cancel as the primary. If owner-cancel is required now, add an `asOwner` branch mirroring `get`. (YAGNI: defer unless the UI plan needs it.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd workers/api && bun run test src/__tests__/modules/orders/orders.service.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add workers/api/src/modules/orders/orders.service.ts workers/api/src/__tests__/modules/orders/orders.service.test.ts
git commit -m "feat(api): orders service — atomic placement, status machine, cancel (#<issue>)"
```

---

## Task 6: Orders module routes + tests

**Files:**
- Create: `workers/api/src/modules/orders/index.ts`
- Create: `workers/api/src/__tests__/modules/orders/orders.routes.test.ts`
- Modify: `workers/api/src/middleware/shared-deps.ts`
- Modify: `workers/api/src/middleware/services.ts`
- Modify: `workers/api/src/modules/routes.ts`
- Modify: `workers/api/src/__tests__/helpers/create-test-app.ts`

- [ ] **Step 1: Wire the new repos into `SharedDeps`** (`shared-deps.ts`): add type imports for `OrdersRepository` and `CustomerAddressesRepository`, and two fields:

```ts
	ordersRepo: OrdersRepository;
	customerAddressesRepo: CustomerAddressesRepository;
```

- [ ] **Step 2: Construct them in `services.ts`** — import both classes, instantiate after `reviewsRepo`, pass into the `AuthorizationService` constructor (now 10 args) and into the `deps` object:

```ts
		const ordersRepo = new OrdersRepository(db);
		const customerAddressesRepo = new CustomerAddressesRepository(db);
```
Add `ordersRepo, customerAddressesRepo` to the `new AuthorizationService(...)` call (append, order-matching Task 4) and to the `deps` literal.

- [ ] **Step 3: Write `orders/index.ts`** (mirror `products/index.ts` structure: zod-openapi route defs, `publicApp` is empty here — orders has no public routes — and a `privateApp`; plus a separate customer-scoped app). Key routes:

```ts
import { createRoute, z } from "@hono/zod-openapi";
import { createApp } from "../../core/create-app";
import { authenticate } from "../../middleware/auth";
import { requireAuth } from "../../middleware/auth-guard";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import { OrdersService } from "./orders.service";

const OrderStatusEnum = z.enum([
	"Pending", "Confirmed", "OutForDelivery", "Delivered", "Cancelled",
]);
const PlaceOrderBody = z.object({
	branchId: z.string().min(1),
	addressId: z.string().min(1),
	items: z
		.array(z.object({ productId: z.string().min(1), quantity: z.number().int().positive() }))
		.min(1),
}).openapi("PlaceOrderBody");
const UpdateStatusBody = z.object({ status: OrderStatusEnum }).openapi("UpdateOrderStatusBody");
const IdParam = z.object({ id: z.string() });
const ErrorSchema = z
	.object({ ok: z.literal(false), code: z.string(), message: z.string() })
	.openapi("Error");

// --- customer-scoped app (authenticate only) ---
const customerApp = createApp();
customerApp.use("*", authenticate);
customerApp
	.openapi(
		createRoute({
			method: "post", path: "/", tags: ["Orders"], summary: "Place an order",
			security: [{ bearerAuth: [] }],
			request: { body: { content: { "application/json": { schema: PlaceOrderBody } }, required: true } },
			responses: {
				201: { content: { "application/json": { schema: z.any() } }, description: "Created" },
				409: { content: { "application/json": { schema: ErrorSchema } }, description: "Out of stock" },
			},
		}),
		async (c) => {
			const body = c.req.valid("json");
			const order = await c.var.ordersService.create(c.var.user.id, body);
			return c.json(order, 201);
		},
	)
	.openapi(
		createRoute({
			method: "get", path: "/", tags: ["Orders"], summary: "List my orders",
			security: [{ bearerAuth: [] }],
			responses: { 200: { content: { "application/json": { schema: z.array(z.any()) } }, description: "OK" } },
		}),
		async (c) => c.json(await c.var.ordersService.listMine(c.var.user.id), 200),
	)
	.openapi(
		createRoute({
			method: "patch", path: "/:id/cancel", tags: ["Orders"], summary: "Cancel my order",
			security: [{ bearerAuth: [] }], request: { params: IdParam },
			responses: {
				204: { description: "Cancelled" },
				422: { content: { "application/json": { schema: ErrorSchema } }, description: "Invalid state" },
			},
		}),
		async (c) => {
			await c.var.ordersService.cancel(c.var.user.id, c.req.valid("param").id);
			return new Response(null, { status: 204 });
		},
	);

// --- owner/manager app (branch-scoped) ---
const ownerApp = createApp();
ownerApp.use("*", authenticate, requireAuth(["owner", "manager"], { branchScope: true }));
ownerApp
	.openapi(
		createRoute({
			method: "get", path: "/branch", tags: ["Orders"], summary: "List branch orders (fulfillment queue)",
			security: [{ bearerAuth: [] }],
			request: { query: z.object({ branchId: z.string() }) },
			responses: { 200: { content: { "application/json": { schema: z.array(z.any()) } }, description: "OK" } },
		}),
		async (c) => c.json(await c.var.ordersService.listByBranch(c.req.valid("query").branchId), 200),
	)
	.openapi(
		createRoute({
			method: "patch", path: "/:id/status", tags: ["Orders"], summary: "Advance order status",
			security: [{ bearerAuth: [] }],
			request: { params: IdParam, body: { content: { "application/json": { schema: UpdateStatusBody } }, required: true } },
			responses: {
				200: { content: { "application/json": { schema: z.any() } }, description: "OK" },
				422: { content: { "application/json": { schema: ErrorSchema } }, description: "Invalid transition" },
			},
		}),
		async (c) => {
			const order = await c.var.ordersService.updateStatus(
				c.var.user.id, c.req.valid("param").id, c.req.valid("json").status, c.var.scopedBranchIds,
			);
			return c.json(order, 200);
		},
	)
	.openapi(
		createRoute({
			method: "get", path: "/:id", tags: ["Orders"], summary: "Get order (owner/manager)",
			security: [{ bearerAuth: [] }], request: { params: IdParam },
			responses: {
				200: { content: { "application/json": { schema: z.any() } }, description: "OK" },
				404: { content: { "application/json": { schema: ErrorSchema } }, description: "Not found" },
			},
		}),
		async (c) =>
			c.json(
				await c.var.ordersService.get(c.var.user.id, c.req.valid("param").id, c.var.scopedBranchIds, true),
				200,
			),
	);

export const ordersApp = createApp().route("/", customerApp).route("/", ownerApp);

export const installOrdersService: ServiceInstaller = (c, { ordersRepo, customerAddressesRepo, branchesRepo, productsRepo, authz }) =>
	c.set(
		"ordersService",
		new OrdersService(ordersRepo, customerAddressesRepo, branchesRepo, productsRepo, authz),
	);
```

> **Route-order caveat:** Hono matches in registration order. `/:id` is registered last on `ownerApp`, after `/branch`, so `GET /branch` is not shadowed by `GET /:id`. Keep that order. (If a customer `GET /:id` is wanted, add it to `customerApp` with `asOwner=false`; the spec's dual-auth detail can be served by the owner route + the customer's own list for now — YAGNI, confirm in the UI plan.)

- [ ] **Step 2 (types): register `ordersService` on `AppEnv`** — in `workers/api/src/types/index.ts`, add `ordersService: OrdersService` (and `customerAddressesService` in Task 7) to the context `Variables` interface, mirroring `productsService`.

- [ ] **Step 3: Mount in `modules/routes.ts`** — import `{ installOrdersService, ordersApp }`, add `installOrdersService` to the installers array, and `apiRoutes.route("/v1/orders", ordersApp);`.

- [ ] **Step 4: Register in `create-test-app.ts`** — add `ordersApp` to the registered apps and accept `ordersService` in the test services bag (mirror `productsService`).

- [ ] **Step 5: Write the failing route test** `orders.routes.test.ts` (mirror `products.routes.test.ts`):

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, ValidationError } from "../../../core/errors";
import { authHeader, createTestToken, TEST_ENV } from "../../helpers/auth";
import { createTestApp } from "../../helpers/create-test-app";

const mockOrdersService = {
	create: vi.fn(), listMine: vi.fn(), get: vi.fn(),
	listByBranch: vi.fn(), updateStatus: vi.fn(), cancel: vi.fn(),
};
const app = createTestApp({ ordersService: mockOrdersService as never });
beforeEach(() => vi.clearAllMocks());

const body = { branchId: "b1", addressId: "a1", items: [{ productId: "p1", quantity: 2 }] };

describe("POST /api/v1/orders", () => {
	it("401 without auth", async () => {
		const res = await app.request("/api/v1/orders", {
			method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
		}, TEST_ENV);
		expect(res.status).toBe(401);
	});

	it("201 for a customer", async () => {
		mockOrdersService.create.mockResolvedValue({ id: "o1", total: 2400 });
		const token = await createTestToken({ role: "customer", userId: "u1" });
		const res = await app.request("/api/v1/orders", {
			method: "POST", headers: { "Content-Type": "application/json", ...authHeader(token) }, body: JSON.stringify(body),
		}, TEST_ENV);
		expect(res.status).toBe(201);
	});

	it("409 when out of stock", async () => {
		mockOrdersService.create.mockRejectedValue(new ConflictError("out of stock"));
		const token = await createTestToken({ role: "customer", userId: "u1" });
		const res = await app.request("/api/v1/orders", {
			method: "POST", headers: { "Content-Type": "application/json", ...authHeader(token) }, body: JSON.stringify(body),
		}, TEST_ENV);
		expect(res.status).toBe(409);
	});

	it("422 with empty items", async () => {
		const token = await createTestToken({ role: "customer", userId: "u1" });
		const res = await app.request("/api/v1/orders", {
			method: "POST", headers: { "Content-Type": "application/json", ...authHeader(token) },
			body: JSON.stringify({ ...body, items: [] }),
		}, TEST_ENV);
		expect(res.status).toBe(422);
	});
});

describe("PATCH /api/v1/orders/:id/status", () => {
	it("403 for a customer", async () => {
		const token = await createTestToken({ role: "customer", userId: "u1" });
		const res = await app.request("/api/v1/orders/o1/status", {
			method: "PATCH", headers: { "Content-Type": "application/json", ...authHeader(token) },
			body: JSON.stringify({ status: "Confirmed" }),
		}, TEST_ENV);
		expect(res.status).toBe(403);
	});

	it("422 on invalid transition", async () => {
		mockOrdersService.updateStatus.mockRejectedValue(new ValidationError("bad transition"));
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request("/api/v1/orders/o1/status", {
			method: "PATCH", headers: { "Content-Type": "application/json", ...authHeader(token) },
			body: JSON.stringify({ status: "Pending" }),
		}, TEST_ENV);
		expect(res.status).toBe(422);
	});
});

describe("GET /api/v1/orders/branch", () => {
	it("200 for an owner", async () => {
		mockOrdersService.listByBranch.mockResolvedValue([]);
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request("/api/v1/orders/branch?branchId=b1", { headers: authHeader(token) }, TEST_ENV);
		expect(res.status).toBe(200);
	});
});
```

- [ ] **Step 6: Run tests to verify they fail, implement Steps 1–4, then pass**

Run: `cd workers/api && bun run test src/__tests__/modules/orders/`
Expected: PASS. If a customer token's role string differs (`"customer"` vs `"user"`), match `createTestToken`/`products.routes.test.ts` exactly.

- [ ] **Step 7: Commit**

```bash
git add workers/api/src/modules/orders/ workers/api/src/middleware/ workers/api/src/modules/routes.ts workers/api/src/types/ workers/api/src/__tests__/
git commit -m "feat(api): orders module + routes, wired + tested (#<issue>)"
```

---

## Task 7: Customer-addresses service + module + tests

**Files:**
- Create: `workers/api/src/modules/customer-addresses/customer-addresses.service.ts`
- Create: `workers/api/src/modules/customer-addresses/index.ts`
- Create: `workers/api/src/__tests__/modules/customer-addresses/customer-addresses.service.test.ts`
- Create: `workers/api/src/__tests__/modules/customer-addresses/customer-addresses.routes.test.ts`
- Modify: `modules/routes.ts`, `create-test-app.ts`, `types/index.ts` (register `customerAddressesService`)

- [ ] **Step 1: Write the failing service test** (self-scope + single-default invariant)

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerAddressesService } from "../../../modules/customer-addresses/customer-addresses.service";

const repo = {
	findByUser: vi.fn(), findOne: vi.fn(), create: vi.fn(),
	updateOne: vi.fn(), deleteOne: vi.fn(), clearDefault: vi.fn(),
};
const authz = { assertCustomerOwnsAddress: vi.fn() };
const make = () => new CustomerAddressesService(repo as never, authz as never);
beforeEach(() => vi.clearAllMocks());

it("create with isDefault=true clears previous defaults first", async () => {
	repo.create.mockResolvedValue({ data: { id: "a1" } });
	await make().create("u1", { line: "x", isDefault: true });
	expect(repo.clearDefault).toHaveBeenCalledWith("u1");
});

it("create without isDefault does not clear defaults", async () => {
	repo.create.mockResolvedValue({ data: { id: "a1" } });
	await make().create("u1", { line: "x" });
	expect(repo.clearDefault).not.toHaveBeenCalled();
});

it("update asserts ownership", async () => {
	authz.assertCustomerOwnsAddress.mockResolvedValue({ id: "a1", userId: "u1" });
	repo.updateOne.mockResolvedValue({ data: { id: "a1" } });
	await make().update("u1", "a1", { label: "Home" });
	expect(authz.assertCustomerOwnsAddress).toHaveBeenCalledWith("u1", "a1");
});
```

- [ ] **Step 2: Run → fail.** `cd workers/api && bun run test src/__tests__/modules/customer-addresses/customer-addresses.service.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `customer-addresses.service.ts`**

```ts
import type { CustomerAddressesRepository } from "@repo/core/src/database/repositories/customer-addresses.repository";
import type { CustomerAddressInsert } from "@repo/core/src/database/schema";
import type { AuthorizationService } from "../../core/authorization";

export type CreateAddressInput = Omit<CustomerAddressInsert, "userId">;

export class CustomerAddressesService {
	constructor(
		private readonly repo: CustomerAddressesRepository,
		private readonly authz: AuthorizationService,
	) {}

	listMine(userId: string) {
		return this.repo.findByUser(userId);
	}

	async create(userId: string, data: CreateAddressInput) {
		if (data.isDefault) await this.repo.clearDefault(userId);
		const result = await this.repo.create({ ...data, userId } as CustomerAddressInsert);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure
		return result.data!;
	}

	async update(userId: string, id: string, data: Partial<CreateAddressInput>) {
		await this.authz.assertCustomerOwnsAddress(userId, id);
		if (data.isDefault) await this.repo.clearDefault(userId);
		const result = await this.repo.updateOne(id, data as Partial<CustomerAddressInsert>);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure
		return result.data!;
	}

	async remove(userId: string, id: string) {
		await this.authz.assertCustomerOwnsAddress(userId, id);
		const result = await this.repo.deleteOne(id);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure
		return result.data!;
	}
}
```

- [ ] **Step 4: Implement `customer-addresses/index.ts`** — a single `customerApp` (`authenticate` on `*`) with `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`, mirroring the `ordersApp` customer-app structure. Body schema:

```ts
const AddressBody = z.object({
	label: z.string().optional(),
	line: z.string().min(1),
	area: z.string().optional(),
	city: z.string().optional(),
	lat: z.number().optional(),
	lng: z.number().optional(),
	isDefault: z.boolean().optional(),
}).openapi("CustomerAddressBody");
```
Export `customerAddressesApp` and:
```ts
export const installCustomerAddressesService: ServiceInstaller = (c, { customerAddressesRepo, authz }) =>
	c.set("customerAddressesService", new CustomerAddressesService(customerAddressesRepo, authz));
```

- [ ] **Step 5: Mount + register** — `modules/routes.ts` (`apiRoutes.route("/v1/customer-addresses", customerAddressesApp)` + installer), `create-test-app.ts`, and `customerAddressesService` on `AppEnv`.

- [ ] **Step 6: Write the failing route test** `customer-addresses.routes.test.ts` — 401 without auth on `GET /`; 200 with a customer token; 401/403 matrix mirroring orders. Run the dir, implement, pass:

Run: `cd workers/api && bun run test src/__tests__/modules/customer-addresses/`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add workers/api/src/modules/customer-addresses/ workers/api/src/modules/routes.ts workers/api/src/types/ workers/api/src/__tests__/
git commit -m "feat(api): customer-addresses module + routes + tests (#<issue>)"
```

---

## Task 8: Full API suite + lint + build gate

- [ ] **Step 1: Run the whole API test suite**

Run: `bun run api:test`
Expected: all new tests green; pre-existing pass count unchanged except for the +N new tests. (Baseline has a known `clearAllMocks` constructor-mock quirk in 3 inline-repo modules — those failures, if present, must be identical to baseline; zero new failures from this work.)

- [ ] **Step 2: Lint + build**

Run: `bun run lint && bun run build`
Expected: PASS. Fix any biome/type issues inline.

- [ ] **Step 3: Commit** any lint fixups.

```bash
git add -A && git commit -m "chore(api): lint/build fixups for commerce orders (#<issue>)"
```

---

## Task 9: api-client endpoints + types

**Files:**
- Create: `packages/api-client/src/endpoints/orders.ts`
- Create: `packages/api-client/src/endpoints/customer-addresses.ts`
- Modify: `packages/api-client/src/types.ts` — add `Order`, `OrderItem`, `OrderStatus`, `OrderWithItems`, `CustomerAddress`
- Modify: the api-client index/`client.ts` — register both endpoint groups (mirror `createProductsEndpoints`)

- [ ] **Step 1: Add types** (match the API response shapes; mirror the existing `Product` type's field naming — camelCase):

```ts
export type OrderStatus = "Pending" | "Confirmed" | "OutForDelivery" | "Delivered" | "Cancelled";

export interface OrderItem {
	id: string;
	orderId: string;
	productId: string;
	quantity: number;
	unitPrice: number;
}

export interface Order {
	id: string;
	businessId: string;
	branchId: string;
	userId: string;
	status: OrderStatus;
	total: number;
	deliveryLine: string;
	deliveryArea: string | null;
	deliveryCity: string | null;
	deliveryLat: number | null;
	deliveryLng: number | null;
	deliveredAt: string | null;
	createdAt: string;
	updatedAt: string | null;
}

export interface OrderWithItems extends Order {
	items: OrderItem[];
}

export interface CustomerAddress {
	id: string;
	userId: string;
	label: string | null;
	line: string;
	area: string | null;
	city: string | null;
	lat: number | null;
	lng: number | null;
	isDefault: boolean;
	createdAt: string;
	updatedAt: string | null;
}
```

- [ ] **Step 2: Create `endpoints/orders.ts`** (mirror `products.ts`):

```ts
import type { ApiClient } from "../client";
import type { Order, OrderStatus, OrderWithItems } from "../types";

export interface PlaceOrderBody {
	branchId: string;
	addressId: string;
	items: { productId: string; quantity: number }[];
}

export function createOrdersEndpoints(client: ApiClient) {
	return {
		create: (body: PlaceOrderBody) => client.post<Order>("/api/v1/orders", body),
		listMine: () => client.get<Order[]>("/api/v1/orders"),
		cancel: (id: string) => client.patch<void>(`/api/v1/orders/${id}/cancel`, {}),
		listByBranch: (branchId: string) =>
			client.get<Order[]>("/api/v1/orders/branch", { branchId }),
		get: (id: string) => client.get<OrderWithItems>(`/api/v1/orders/${id}`),
		updateStatus: (id: string, status: OrderStatus) =>
			client.patch<Order>(`/api/v1/orders/${id}/status`, { status }),
	};
}
```

> Match the actual `client.get/post/patch` return-wrapper convention (`SingleResponse<T>` vs raw) used by `products.ts` — orders' list endpoints return a raw array (not the paginated envelope), so type them as `T[]`, not `PaginatedResponse<T>`. Adjust if `client` auto-unwraps.

- [ ] **Step 3: Create `endpoints/customer-addresses.ts`**

```ts
import type { ApiClient } from "../client";
import type { CustomerAddress } from "../types";

export interface AddressBody {
	label?: string;
	line: string;
	area?: string;
	city?: string;
	lat?: number;
	lng?: number;
	isDefault?: boolean;
}

export function createCustomerAddressesEndpoints(client: ApiClient) {
	return {
		list: () => client.get<CustomerAddress[]>("/api/v1/customer-addresses"),
		create: (body: AddressBody) =>
			client.post<CustomerAddress>("/api/v1/customer-addresses", body),
		update: (id: string, body: Partial<AddressBody>) =>
			client.patch<CustomerAddress>(`/api/v1/customer-addresses/${id}`, body),
		remove: (id: string) =>
			client.delete<CustomerAddress>(`/api/v1/customer-addresses/${id}`),
	};
}
```

- [ ] **Step 4: Register both groups** on the client object (find where `createProductsEndpoints(client)` is attached — likely `client.ts` — and add `orders: createOrdersEndpoints(client)` and `customerAddresses: createCustomerAddressesEndpoints(client)`).

- [ ] **Step 5: Build the api-client**

Run: `bun run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/api-client/src/
git commit -m "feat(api-client): orders + customer-addresses endpoints + types (#<issue>)"
```

---

## Task 10: Seeders

**Files:**
- Create/Modify: seeder files under `tools/cli/` (see [docs/guides/cli.md](../../guides/cli.md) "how to add a seeder")

- [ ] **Step 1:** Add an addresses seeder (1–2 per customer user) and an orders seeder (a few Delivered + Pending orders per commerce business, with 1–2 `order_items` each, snapshotting product price; decrement stock to keep the invariant honest — or seed orders without decrement and document it). Follow the existing products/bookings seeder shape.

- [ ] **Step 2: Verify**

Run: `bun run cli db fresh && bun run cli db status`
Expected: `orders`, `order_items`, `customer_addresses` show non-zero rows; no FK/CHECK errors.

- [ ] **Step 3: Commit**

```bash
git add tools/cli/
git commit -m "feat(cli): seeders for orders, order_items, customer_addresses (#<issue>)"
```

---

## Task 11: Documentation

**Files:** `workers/api/CLAUDE.md`, `docs/guides/api-endpoints.md`, `docs/guides/api-query-repository-pattern.md`, `docs/plan/multi-vertical-schema-design.md`, `AGENTS.md` (Learned Workspace Facts if relevant).

- [ ] **Step 1:** `workers/api/CLAUDE.md` — add an **Orders** section (routes table, status machine, atomic-batch invariant + 409 mapping) and a **Customer Addresses** section (self-scoped, single-default), modeled on the existing "Products" section. Add `assertOrderAccess`/`assertCustomerOwnsOrder`/`assertCustomerOwnsAddress` to the Authorization list and `OrdersService`/`CustomerAddressesService` to its "Currently used by".

- [ ] **Step 2:** `docs/guides/api-endpoints.md` — add the new `/v1/orders` and `/v1/customer-addresses` routes.

- [ ] **Step 3:** `docs/guides/api-query-repository-pattern.md` — add an Orders subsection noting the `OrdersRepository` query allowlist and the `placeOrder`/`cancelAndRestore` batch methods.

- [ ] **Step 4:** `docs/plan/multi-vertical-schema-design.md` — mark the order-flow portion of Phase 1 done; note `payments` + khata derivation remain (next slice).

- [ ] **Step 5: Final gate**

Run: `bun run lint && bun run api:test && bun run build`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add docs/ workers/api/CLAUDE.md AGENTS.md
git commit -m "docs: commerce order-flow backend (routes, authz, schema status) (#<issue>)"
```

---

## Self-Review notes (for the implementer)

- **Spec coverage:** Tasks 1–2 = data layer (§1); Tasks 3,5,6,7 = API surface + invariant + status machine (§2–4); Task 9 = api-client (§5); Task 10 = seeders; Task 11 = docs (§8) + gates (§9). UI (§6) and payments/khata are explicitly out of this plan.
- **Deferred decisions flagged inline:** dual-auth `GET /:id` (owner route now; customer detail deferred to UI plan), owner-initiated cancel (customer cancel is primary), `db.batch` typing fallback.
- **Type consistency:** `OrderStatusType` enum values are identical across schema, service `ALLOWED_TRANSITIONS`, route zod enum, and api-client `OrderStatus`. Repo method names (`placeOrder`, `cancelAndRestore`, `findItems`, `updateStatus`) are used identically in service + tests.
- **Issue number:** replace `#<issue>` in commit messages with the real tracking issue once filed.
- **Verify before "done":** per AGENTS.md, confirm against the codebase — run the final gate, and `bun run cli db fresh` to prove the migration + seeders.
