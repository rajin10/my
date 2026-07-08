/**
 * Real-DB integration test for commerceSearch — exercises the actual area filter
 * and commerce/booking isolation against in-memory SQLite (createTestDb).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { commerceSearch } from "../../../modules/search/commerce-strategy";
import { createTestDb } from "../../helpers/test-db";

vi.mock("@repo/core/src/database/client", async () => {
	const drizzle =
		await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
	return {
		getDB: vi.fn(),
		and: drizzle.and,
		eq: drizzle.eq,
		inArray: drizzle.inArray,
		isNotNull: drizzle.isNotNull,
		isNull: drizzle.isNull,
		sql: drizzle.sql,
	};
});

const TS = "2026-01-01T00:00:00.000Z";

async function seedBusiness(
	db: ReturnType<typeof createTestDb>,
	o: { id: string; vertical: "booking" | "commerce"; city?: string },
) {
	const { businessesSchema } = await import("@repo/core/src/database/schema");
	// biome-ignore lint/suspicious/noExplicitAny: better-sqlite3 vs D1 drizzle type mismatch
	await (db as any).insert(businessesSchema).values({
		id: o.id,
		name: `${o.vertical}-${o.id}`,
		category: "LPG",
		city: o.city ?? "Dhaka",
		vertical: o.vertical,
		status: "Active",
		ownerId: "owner-1",
		createdAt: TS,
	});
}

async function seedBranch(
	db: ReturnType<typeof createTestDb>,
	o: {
		id: string;
		businessId: string;
		area: string;
		lat?: number;
		lng?: number;
	},
) {
	const { branchesSchema } = await import("@repo/core/src/database/schema");
	// biome-ignore lint/suspicious/noExplicitAny: better-sqlite3 vs D1 drizzle type mismatch
	await (db as any).insert(branchesSchema).values({
		id: o.id,
		businessId: o.businessId,
		name: `${o.area} Branch`,
		address: "123 St",
		area: o.area,
		city: "Dhaka",
		lat: o.lat ?? null,
		lng: o.lng ?? null,
		createdAt: TS,
	});
}

async function seedProduct(
	db: ReturnType<typeof createTestDb>,
	o: { id: string; branchId: string; price: number },
) {
	const { productsSchema } = await import("@repo/core/src/database/schema");
	// biome-ignore lint/suspicious/noExplicitAny: better-sqlite3 vs D1 drizzle type mismatch
	await (db as any).insert(productsSchema).values({
		id: o.id,
		branchId: o.branchId,
		name: "Cylinder",
		price: o.price,
		stock: 10,
		status: "Active",
		createdAt: TS,
	});
}

describe("commerceSearch — area mode (real DB)", () => {
	let db: ReturnType<typeof createTestDb>;

	beforeEach(() => {
		db = createTestDb();
	});

	it("returns only commerce sellers with a branch in the requested area", async () => {
		await seedBusiness(db, { id: "c1", vertical: "commerce" });
		await seedBranch(db, { id: "c1b", businessId: "c1", area: "Banani" });
		await seedProduct(db, { id: "c1p", branchId: "c1b", price: 1200 });

		await seedBusiness(db, { id: "b1", vertical: "booking" });
		await seedBranch(db, { id: "b1b", businessId: "b1", area: "Banani" });

		await seedBusiness(db, { id: "c2", vertical: "commerce" });
		await seedBranch(db, { id: "c2b", businessId: "c2", area: "Gulshan" });

		const result = await commerceSearch(db as never, { area: "Banani" });
		expect(result.data.map((r) => r.id)).toEqual(["c1"]);
		expect(result.data[0]).toMatchObject({
			vertical: "commerce",
			area: "Banani",
			minPrice: 1200,
			distanceKm: null,
		});
		expect(result.aiRanked).toBe(false);
	});
});

describe("commerceSearch — distance mode (real DB)", () => {
	let db: ReturnType<typeof createTestDb>;
	beforeEach(() => {
		db = createTestDb();
	});

	it("ranks sellers nearest-first by branch lat/lng and sets distanceKm", async () => {
		await seedBusiness(db, { id: "far", vertical: "commerce" });
		await seedBranch(db, {
			id: "far-b",
			businessId: "far",
			area: "Uttara",
			lat: 23.81,
			lng: 90.4,
		});
		await seedBusiness(db, { id: "near", vertical: "commerce" });
		await seedBranch(db, {
			id: "near-b",
			businessId: "near",
			area: "Banani",
			lat: 23.781,
			lng: 90.4,
		});

		const result = await commerceSearch(db as never, {
			lat: 23.78,
			lng: 90.4,
		});
		expect(result.data.map((r) => r.id)).toEqual(["near", "far"]);
		const near = result.data[0];
		expect(near?.distanceKm).not.toBeNull();
		expect(near?.distanceKm as number).toBeLessThan(
			result.data[1]?.distanceKm as number,
		);
	});

	it("uses the nearest branch (not an arbitrary one) for a multi-branch seller", async () => {
		await seedBusiness(db, { id: "multi", vertical: "commerce" });
		await seedBranch(db, {
			id: "multi-far",
			businessId: "multi",
			area: "Uttara",
			lat: 23.81,
			lng: 90.4,
		});
		await seedBranch(db, {
			id: "multi-near",
			businessId: "multi",
			area: "Banani",
			lat: 23.781,
			lng: 90.4,
		});
		await seedProduct(db, {
			id: "multi-p",
			branchId: "multi-near",
			price: 900,
		});

		await seedBusiness(db, { id: "mid", vertical: "commerce" });
		await seedBranch(db, {
			id: "mid-b",
			businessId: "mid",
			area: "Mohakhali",
			lat: 23.79,
			lng: 90.4,
		});

		const result = await commerceSearch(db as never, { lat: 23.78, lng: 90.4 });

		expect(result.data.map((r) => r.id)).toEqual(["multi", "mid"]);

		const multi = result.data[0];
		expect(multi?.distanceKm as number).toBeLessThan(0.5);
		expect(multi?.area).toBe("Banani");
		expect(multi?.lat).toBe(23.781);
		expect(multi?.lng).toBe(90.4);
	});

	it("sorts sellers without coordinates last in distance mode", async () => {
		await seedBusiness(db, { id: "geo", vertical: "commerce" });
		await seedBranch(db, {
			id: "geo-b",
			businessId: "geo",
			area: "Banani",
			lat: 23.78,
			lng: 90.4,
		});
		await seedBusiness(db, { id: "nogeo", vertical: "commerce" });
		await seedBranch(db, {
			id: "nogeo-b",
			businessId: "nogeo",
			area: "Mirpur",
		});

		const result = await commerceSearch(db as never, { lat: 23.78, lng: 90.4 });
		expect(result.data.map((r) => r.id)).toEqual(["geo", "nogeo"]);
		expect(result.data[1]?.distanceKm).toBeNull();
	});

	it("restricts nearest-branch selection to the requested area when area + coords are both set", async () => {
		await seedBusiness(db, { id: "s", vertical: "commerce" });
		await seedBranch(db, {
			id: "s-near-other",
			businessId: "s",
			area: "Gulshan",
			lat: 23.781,
			lng: 90.4,
		});
		await seedBranch(db, {
			id: "s-far-banani",
			businessId: "s",
			area: "Banani",
			lat: 23.81,
			lng: 90.4,
		});

		const result = await commerceSearch(db as never, {
			area: "Banani",
			lat: 23.78,
			lng: 90.4,
		});

		expect(result.data.map((r) => r.id)).toEqual(["s"]);
		const s = result.data[0];
		expect(s?.area).toBe("Banani");
		expect(s?.lat).toBe(23.81);
		expect(s?.distanceKm as number).toBeGreaterThan(1);
	});
});
