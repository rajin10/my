/**
 * Integration test for KhataRepository.customerDue and KhataRepository.businessDues.
 *
 * Uses the real in-memory SQLite harness (createTestDb) with all migrations
 * applied so the actual Σ delivered-order totals − Σ payments SQL is exercised
 * against a real DB — not mocked. This is the only check of the derivation SQL.
 */
import { KhataRepository } from "@repo/core/src/database/repositories/khata.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { seedChain } from "../../helpers/seed";
import { createTestDb } from "../../helpers/test-db";

const TS = "2026-01-01T00:00:00.000Z";

function makeRepo(db: ReturnType<typeof createTestDb>) {
	return new KhataRepository(db as never);
}

async function seedDeliveredOrder(
	db: ReturnType<typeof createTestDb>,
	opts: {
		id: string;
		businessId: string;
		branchId: string;
		userId: string;
		total: number;
	},
) {
	const { ordersSchema } = await import("@repo/core/src/database/schema");
	// biome-ignore lint/suspicious/noExplicitAny: better-sqlite3 drizzle vs D1 drizzle type mismatch in tests
	await (db as any).insert(ordersSchema).values({
		id: opts.id,
		businessId: opts.businessId,
		branchId: opts.branchId,
		userId: opts.userId,
		status: "Delivered",
		total: opts.total,
		deliveryLine: "123 Test St",
		deliveredAt: TS,
		createdAt: TS,
		updatedAt: TS,
		deletedAt: null,
	});
}

async function seedPendingOrder(
	db: ReturnType<typeof createTestDb>,
	opts: {
		id: string;
		businessId: string;
		branchId: string;
		userId: string;
		total: number;
	},
) {
	const { ordersSchema } = await import("@repo/core/src/database/schema");
	// biome-ignore lint/suspicious/noExplicitAny: better-sqlite3 drizzle vs D1 drizzle type mismatch in tests
	await (db as any).insert(ordersSchema).values({
		id: opts.id,
		businessId: opts.businessId,
		branchId: opts.branchId,
		userId: opts.userId,
		status: "Pending",
		total: opts.total,
		deliveryLine: "123 Test St",
		deliveredAt: null,
		createdAt: TS,
		updatedAt: TS,
		deletedAt: null,
	});
}

async function seedPayment(
	db: ReturnType<typeof createTestDb>,
	opts: {
		id: string;
		businessId: string;
		userId: string;
		amount: number;
		recordedBy: string;
		deletedAt?: string | null;
	},
) {
	const { paymentsSchema } = await import("@repo/core/src/database/schema");
	// biome-ignore lint/suspicious/noExplicitAny: better-sqlite3 drizzle vs D1 drizzle type mismatch in tests
	await (db as any).insert(paymentsSchema).values({
		id: opts.id,
		businessId: opts.businessId,
		userId: opts.userId,
		amount: opts.amount,
		recordedBy: opts.recordedBy,
		orderId: null,
		note: null,
		createdAt: TS,
		updatedAt: TS,
		deletedAt: opts.deletedAt ?? null,
	});
}

async function seedUser(
	db: ReturnType<typeof createTestDb>,
	opts: { id: string; name: string },
) {
	const { usersSchema } = await import("@repo/core/src/database/schema");
	// biome-ignore lint/suspicious/noExplicitAny: better-sqlite3 drizzle vs D1 drizzle type mismatch in tests
	await (db as any).insert(usersSchema).values({
		id: opts.id,
		name: opts.name,
		role: "user",
		createdAt: TS,
		updatedAt: TS,
		deletedAt: null,
	});
}

describe("KhataRepository.customerDue (real-DB derivation)", () => {
	let db: ReturnType<typeof createTestDb>;
	let businessId: string;
	let branchId: string;
	const ownerId = "owner-khata-test";
	const userId = "customer-khata-test";

	beforeEach(async () => {
		db = createTestDb();
		const chain = await seedChain(db, { ownerId });
		businessId = chain.businessId;
		branchId = chain.branchId;
	});

	it("returns { due: 700, totalDelivered: 1200, totalPaid: 500 } for two delivered orders and one payment", async () => {
		await seedDeliveredOrder(db, {
			id: "order-1",
			businessId,
			branchId,
			userId,
			total: 700,
		});
		await seedDeliveredOrder(db, {
			id: "order-2",
			businessId,
			branchId,
			userId,
			total: 500,
		});
		await seedPayment(db, {
			id: "pay-1",
			businessId,
			userId,
			amount: 500,
			recordedBy: ownerId,
		});

		const result = await makeRepo(db).customerDue(businessId, userId);
		expect(result).toEqual({ due: 700, totalDelivered: 1200, totalPaid: 500 });
	});

	it("excludes voided payments (deletedAt set) from totalPaid", async () => {
		await seedDeliveredOrder(db, {
			id: "order-3",
			businessId,
			branchId,
			userId,
			total: 1000,
		});
		// This payment is voided — should NOT reduce due.
		await seedPayment(db, {
			id: "pay-voided",
			businessId,
			userId,
			amount: 800,
			recordedBy: ownerId,
			deletedAt: TS,
		});
		// Only this live payment counts.
		await seedPayment(db, {
			id: "pay-live",
			businessId,
			userId,
			amount: 200,
			recordedBy: ownerId,
		});

		const result = await makeRepo(db).customerDue(businessId, userId);
		expect(result).toEqual({ due: 800, totalDelivered: 1000, totalPaid: 200 });
	});

	it("returns due: 0 when no delivered orders exist", async () => {
		const result = await makeRepo(db).customerDue(businessId, userId);
		expect(result).toEqual({ due: 0, totalDelivered: 0, totalPaid: 0 });
	});

	it("non-Delivered orders are not counted in totalDelivered", async () => {
		// Insert a Pending order — should not appear in the delivered sum.
		await seedPendingOrder(db, {
			id: "order-pending",
			businessId,
			branchId,
			userId,
			total: 999,
		});
		await seedDeliveredOrder(db, {
			id: "order-delivered",
			businessId,
			branchId,
			userId,
			total: 400,
		});

		const result = await makeRepo(db).customerDue(businessId, userId);
		expect(result).toEqual({ due: 400, totalDelivered: 400, totalPaid: 0 });
	});
});

describe("KhataRepository.businessDues (real-DB derivation)", () => {
	let db: ReturnType<typeof createTestDb>;
	let businessId: string;
	let branchId: string;
	const ownerId = "owner-biz-dues-test";

	// Three distinct customer IDs and names used across the main `it` block.
	const userA = "customer-a-biz-dues";
	const userB = "customer-b-biz-dues";
	const userC = "customer-c-biz-dues";

	beforeEach(async () => {
		db = createTestDb();
		const chain = await seedChain(db, { ownerId });
		businessId = chain.businessId;
		branchId = chain.branchId;
	});

	it("returns only customers with due > 0, sorted by due descending, with real names", async () => {
		// Seed user rows so businessDues can resolve names.
		await seedUser(db, { id: userA, name: "Alice" });
		await seedUser(db, { id: userB, name: "Bob" });
		await seedUser(db, { id: userC, name: "Carol" });

		// Customer A: 2000 delivered, 500 paid → due 1500 (should appear).
		await seedDeliveredOrder(db, {
			id: "a-order-1",
			businessId,
			branchId,
			userId: userA,
			total: 1200,
		});
		await seedDeliveredOrder(db, {
			id: "a-order-2",
			businessId,
			branchId,
			userId: userA,
			total: 800,
		});
		await seedPayment(db, {
			id: "a-pay-1",
			businessId,
			userId: userA,
			amount: 500,
			recordedBy: ownerId,
		});

		// Customer B: 800 delivered, 800 paid → due 0 (should be excluded).
		await seedDeliveredOrder(db, {
			id: "b-order-1",
			businessId,
			branchId,
			userId: userB,
			total: 800,
		});
		await seedPayment(db, {
			id: "b-pay-1",
			businessId,
			userId: userB,
			amount: 800,
			recordedBy: ownerId,
		});

		// Customer C: 1000 delivered, no payments → due 1000 (should appear).
		await seedDeliveredOrder(db, {
			id: "c-order-1",
			businessId,
			branchId,
			userId: userC,
			total: 1000,
		});

		const result = await makeRepo(db).businessDues(businessId);

		// Exactly 2 entries: A (1500) first, then C (1000). B is excluded (due = 0).
		expect(result).toEqual([
			{ userId: userA, name: "Alice", due: 1500 },
			{ userId: userC, name: "Carol", due: 1000 },
		]);
	});

	it("excludes voided payments from the paid sum — voided payment leaves customer in the dues list", async () => {
		const userId = "customer-void-biz-dues";
		await seedUser(db, { id: userId, name: "Dave" });

		// 1000 delivered, 1000 paid but voided → net paid = 0, so due = 1000.
		await seedDeliveredOrder(db, {
			id: "void-order-1",
			businessId,
			branchId,
			userId,
			total: 1000,
		});
		await seedPayment(db, {
			id: "void-pay-1",
			businessId,
			userId,
			amount: 1000,
			recordedBy: ownerId,
			deletedAt: TS,
		});

		const result = await makeRepo(db).businessDues(businessId);

		expect(result).toEqual([{ userId, name: "Dave", due: 1000 }]);
	});

	it("excludes customers whose only order is non-Delivered (Pending)", async () => {
		const userId = "customer-pending-biz-dues";
		await seedUser(db, { id: userId, name: "Eve" });

		// Only a Pending order — no delivered total, so no due > 0.
		await seedPendingOrder(db, {
			id: "pending-order-1",
			businessId,
			branchId,
			userId,
			total: 500,
		});

		const result = await makeRepo(db).businessDues(businessId);

		expect(result).toEqual([]);
	});
});
