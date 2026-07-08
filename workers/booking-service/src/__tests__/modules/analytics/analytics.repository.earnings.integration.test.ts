/**
 * Integration test for AnalyticsRepository.getEarnings.
 *
 * Uses the real in-memory SQLite harness (createTestDb) with all migrations
 * applied, so the actual reconciliation SQL (Completed + slot-window +
 * discount-netted) is exercised against a real DB — not mocked. This is the
 * only check that the four breakdowns sum to the same total.
 */
import { AnalyticsRepository } from "@repo/core/src/database/repositories/analytics.repository";
import {
	bookingsSchema,
	teamMembersSchema,
	usersSchema,
} from "@repo/core/src/database/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { seedChain } from "../../helpers/seed";
import { createTestDb } from "../../helpers/test-db";

const TS = "2026-01-01T00:00:00.000Z";
const RANGE = { startDate: "2026-06-01", endDate: "2026-06-30" };

type Db = ReturnType<typeof createTestDb>;

function makeRepo(db: Db) {
	return new AnalyticsRepository(db as never);
}

async function seedUser(db: Db, id: string, name: string) {
	// biome-ignore lint/suspicious/noExplicitAny: better-sqlite3 vs D1 drizzle type mismatch in tests
	await (db as any)
		.insert(usersSchema)
		.values({ id, name, role: "staff", createdAt: TS });
}

async function seedStaff(
	db: Db,
	opts: { id: string; userId: string; businessId: string; branchId: string },
) {
	// biome-ignore lint/suspicious/noExplicitAny: better-sqlite3 vs D1 drizzle type mismatch in tests
	await (db as any).insert(teamMembersSchema).values({
		id: opts.id,
		userId: opts.userId,
		businessId: opts.businessId,
		branchId: opts.branchId,
		title: "Stylist",
		role: "Staff",
		createdAt: TS,
	});
}

async function seedBooking(
	db: Db,
	opts: {
		id: string;
		userId: string;
		serviceId: string;
		branchId: string;
		staffId: string | null;
		slot: string;
		status: "Pending" | "Confirmed" | "Cancelled" | "Completed";
		price: number;
		discount: number;
	},
) {
	// biome-ignore lint/suspicious/noExplicitAny: better-sqlite3 vs D1 drizzle type mismatch in tests
	await (db as any).insert(bookingsSchema).values({
		id: opts.id,
		userId: opts.userId,
		serviceId: opts.serviceId,
		branchId: opts.branchId,
		staffId: opts.staffId,
		slot: opts.slot,
		status: opts.status,
		price: opts.price,
		discount: opts.discount,
		createdAt: TS,
	});
}

describe("AnalyticsRepository.getEarnings", () => {
	let db: Db;

	beforeEach(async () => {
		db = createTestDb();
		// business → branch → service chain owned by owner-1
		await seedChain(db, {
			ownerId: "owner-1",
			businessId: "biz-1",
			branchId: "branch-1",
			serviceId: "svc-1",
		});
		await seedUser(db, "cust-1", "Customer One");
		await seedUser(db, "staff-user-1", "Alice Stylist");
		await seedStaff(db, {
			id: "staff-1",
			userId: "staff-user-1",
			businessId: "biz-1",
			branchId: "branch-1",
		});

		// In-range Completed, assigned to staff-1: net 900
		await seedBooking(db, {
			id: "bk-1",
			userId: "cust-1",
			serviceId: "svc-1",
			branchId: "branch-1",
			staffId: "staff-1",
			slot: "2026-06-10T11:00:00",
			status: "Completed",
			price: 1000,
			discount: 100,
		});
		// In-range Completed, UNASSIGNED (staffId null): net 500
		await seedBooking(db, {
			id: "bk-2",
			userId: "cust-1",
			serviceId: "svc-1",
			branchId: "branch-1",
			staffId: null,
			slot: "2026-06-12T14:00:00",
			status: "Completed",
			price: 500,
			discount: 0,
		});
		// In-range but NOT Completed → excluded
		await seedBooking(db, {
			id: "bk-3",
			userId: "cust-1",
			serviceId: "svc-1",
			branchId: "branch-1",
			staffId: "staff-1",
			slot: "2026-06-15T09:00:00",
			status: "Cancelled",
			price: 9999,
			discount: 0,
		});
		// Completed but slot OUT of range (July) → excluded even though createdAt is in TS
		await seedBooking(db, {
			id: "bk-4",
			userId: "cust-1",
			serviceId: "svc-1",
			branchId: "branch-1",
			staffId: "staff-1",
			slot: "2026-07-01T11:00:00",
			status: "Completed",
			price: 7777,
			discount: 0,
		});
	});

	it("reconciles: each breakdown sums to total (900 + 500 = 1400)", async () => {
		const e = await makeRepo(db).getEarnings("biz-1", RANGE);
		expect(e.total).toBe(1400);
		const sum = (rows: { revenue: number }[]) =>
			rows.reduce((s, r) => s + r.revenue, 0);
		expect(sum(e.byStaff)).toBe(1400);
		expect(sum(e.byService)).toBe(1400);
		expect(sum(e.byBranch)).toBe(1400);
		expect(sum(e.overTime)).toBe(1400);
	});

	it("includes an Unassigned staff bucket for null-staff bookings", async () => {
		const e = await makeRepo(db).getEarnings("biz-1", RANGE);
		const unassigned = e.byStaff.find((r) => r.teamMemberId === null);
		expect(unassigned).toBeDefined();
		expect(unassigned?.name).toBe("Unassigned");
		expect(unassigned?.revenue).toBe(500);
		const alice = e.byStaff.find((r) => r.teamMemberId === "staff-1");
		expect(alice?.name).toBe("Alice Stylist");
		expect(alice?.revenue).toBe(900);
	});

	it("nets discount and excludes non-Completed and out-of-range slots", async () => {
		const e = await makeRepo(db).getEarnings("biz-1", RANGE);
		// 9999 (Cancelled) and 7777 (July slot) must not appear anywhere
		expect(e.total).toBe(1400);
		expect(e.byBranch).toHaveLength(1);
		expect(e.byBranch[0]?.branchId).toBe("branch-1");
		expect(e.byBranch[0]?.bookings).toBe(2);

		// overTime: exactly the two in-range Completed slots, ordered by date asc
		expect(e.overTime.map((p) => p.date)).toEqual(["2026-06-10", "2026-06-12"]);

		// byService: the svc-1 join resolves the service name
		const svc = e.byService.find((r) => r.serviceId === "svc-1");
		expect(svc?.name).toBe("Haircut");
		expect(svc?.revenue).toBe(1400);
	});

	it("returns empty/zero for a business with no branches", async () => {
		const e = await makeRepo(db).getEarnings("biz-unknown", RANGE);
		expect(e).toEqual({
			total: 0,
			byStaff: [],
			byService: [],
			byBranch: [],
			overTime: [],
		});
	});
});
