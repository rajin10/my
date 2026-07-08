/**
 * Real-DB regression test for the atomic, idempotent cancel guard. The
 * concurrency class (double-restore / cancel-races-forward) is invisible to the
 * mocked-repo service tests, so this exercises the actual conditional SQL
 * against an in-memory SQLite engine via the db.batch() shim.
 */
import { OrdersRepository } from "@repo/core/src/database/repositories/orders.repository";
import { sql } from "drizzle-orm";
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
		.where(sql`id = ${id}`);
	return rows[0].stock as number;
}

async function readStatus(db: Db, id: string): Promise<string> {
	const { ordersSchema } = await import("@repo/core/src/database/schema");
	// biome-ignore lint/suspicious/noExplicitAny: better-sqlite3 vs D1 drizzle type mismatch in tests
	const rows = await (db as any)
		.select()
		.from(ordersSchema)
		.where(sql`id = ${id}`);
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

describe("OrdersRepository.updateStatus (compare-and-swap)", () => {
	let db: Db;
	beforeEach(async () => {
		db = attachBatch(createTestDb());
		await seedProduct(db, "prod-1", 10);
	});

	it("flips and returns the row when expectedCurrent matches", async () => {
		await seedOrder(db, "order-1", "Confirmed");
		const repo = new OrdersRepository(db as never);

		const res = await repo.updateStatus(
			"order-1",
			"OutForDelivery",
			"Confirmed",
		);

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
