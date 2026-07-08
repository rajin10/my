import { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import { CouponsRepository } from "@repo/core/src/database/repositories/coupons.repository";
import { UsersRepository } from "@repo/core/src/database/repositories/users.repository";
import {
	branchesSchema,
	businessesSchema,
	couponsSchema,
	usersSchema,
} from "@repo/core/src/database/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../helpers/test-db";

type Db = ReturnType<typeof createTestDb>;

// ─── Branches ───────────────────────────────────────────────────────────────

describe("BranchesRepository — queryAllowlist", () => {
	let db: Db;
	let branchesRepo: BranchesRepository;
	const TS = "2026-01-01T00:00:00.000Z";

	beforeEach(async () => {
		db = createTestDb();
		branchesRepo = new BranchesRepository(db as never);

		await db.insert(businessesSchema).values({
			id: "v1",
			name: "Business 1",
			category: "Beauty",
			city: "Dhaka",
			ownerId: "owner-1",
			createdAt: TS,
		} as never);
		await db.insert(businessesSchema).values({
			id: "v2",
			name: "Business 2",
			category: "Beauty",
			city: "Chittagong",
			ownerId: "owner-1",
			createdAt: "2026-01-02T00:00:00.000Z",
		} as never);

		await db.insert(branchesSchema).values({
			id: "b1",
			businessId: "v1",
			name: "Dhaka Branch",
			address: "1 Dhaka St",
			city: "Dhaka",
			createdAt: TS,
		} as never);
		await db.insert(branchesSchema).values({
			id: "b2",
			businessId: "v2",
			name: "Chittagong Branch",
			address: "1 CTG St",
			city: "Chittagong",
			createdAt: "2026-01-02T00:00:00.000Z",
		} as never);
	});

	it("silently ignores filter on non-allowlisted column (id)", async () => {
		// 'id' is not in the filterable allowlist — filter is dropped, both branches returned
		const result = await branchesRepo.findAll({ filters: { id: "b1" } });
		expect(result.data).toHaveLength(2);
	});

	it("filters by city when in allowlist", async () => {
		const result = await branchesRepo.findAll({ filters: { city: "Dhaka" } });
		expect(result.data).toHaveLength(1);
		expect((result.data[0] as { id: string }).id).toBe("b1");
	});

	it("filters by businessId when in allowlist", async () => {
		const result = await branchesRepo.findAll({
			filters: { businessId: "v1" },
		});
		expect(result.data).toHaveLength(1);
		expect((result.data[0] as { id: string }).id).toBe("b1");
	});

	it("restricts search to allowlisted columns — does not search id", async () => {
		// 'b1' matches the id column but id is not in searchable allowlist
		const result = await branchesRepo.findAll({ search: "b1" });
		expect(result.data).toHaveLength(0);
	});
});

// ─── Coupons ────────────────────────────────────────────────────────────────

describe("CouponsRepository — queryAllowlist", () => {
	let db: Db;
	let couponsRepo: CouponsRepository;
	const TS = "2026-01-01T00:00:00.000Z";
	const EXPIRES = "2027-01-01T00:00:00.000Z";

	beforeEach(async () => {
		db = createTestDb();
		couponsRepo = new CouponsRepository(db as never);

		await db.insert(businessesSchema).values({
			id: "v1",
			name: "Business 1",
			category: "Beauty",
			city: "Dhaka",
			ownerId: "owner-1",
			createdAt: TS,
		} as never);
		await db.insert(businessesSchema).values({
			id: "v2",
			name: "Business 2",
			category: "Beauty",
			city: "Dhaka",
			ownerId: "owner-1",
			createdAt: "2026-01-02T00:00:00.000Z",
		} as never);

		// v1 has two coupons (Active + Expired); v2 has one Active
		await db.insert(couponsSchema).values({
			id: "c1",
			businessId: "v1",
			code: "SAVE10",
			type: "Percentage",
			value: 10,
			maxUses: 100,
			status: "Active",
			expiresAt: EXPIRES,
			createdAt: TS,
		} as never);
		await db.insert(couponsSchema).values({
			id: "c2",
			businessId: "v1",
			code: "FLAT50",
			type: "Fixed",
			value: 50,
			maxUses: 50,
			status: "Expired",
			expiresAt: "2025-01-01T00:00:00.000Z",
			createdAt: "2026-01-02T00:00:00.000Z",
		} as never);
		await db.insert(couponsSchema).values({
			id: "c3",
			businessId: "v2",
			code: "V2DEAL",
			type: "Fixed",
			value: 20,
			maxUses: 10,
			status: "Active",
			expiresAt: EXPIRES,
			createdAt: "2026-01-03T00:00:00.000Z",
		} as never);
	});

	it("silently ignores filter on non-allowlisted column (usedCount)", async () => {
		// usedCount is not in filterable allowlist — filter dropped, all 3 returned
		const result = await couponsRepo.findAll({ filters: { usedCount: "0" } });
		expect(result.data).toHaveLength(3);
	});

	it("filters by status when in allowlist", async () => {
		const result = await couponsRepo.findAll({ filters: { status: "Active" } });
		expect(result.data).toHaveLength(2);
	});

	it("filters by type when in allowlist", async () => {
		const result = await couponsRepo.findAll({
			filters: { type: "Percentage" },
		});
		expect(result.data).toHaveLength(1);
		expect((result.data[0] as { id: string }).id).toBe("c1");
	});

	it("findAllByBusiness scopes to the given business (internal businessId filter honored)", async () => {
		// The internal businessId filter injected by findAllByBusiness must still work
		// with the allowlist — businessId is in filterable to support this.
		const result = await couponsRepo.findAllByBusiness("v1", {});
		expect(result.data).toHaveLength(2);
		for (const row of result.data) {
			expect((row as { businessId: string }).businessId).toBe("v1");
		}
	});

	it("findAllByBusiness does not leak other business's coupons", async () => {
		const result = await couponsRepo.findAllByBusiness("v2", {});
		expect(result.data).toHaveLength(1);
		expect((result.data[0] as { id: string }).id).toBe("c3");
	});
});

// ─── Users ──────────────────────────────────────────────────────────────────

describe("UsersRepository — queryAllowlist", () => {
	let db: Db;
	let usersRepo: UsersRepository;
	const TS = "2026-01-01T00:00:00.000Z";

	beforeEach(async () => {
		db = createTestDb();
		usersRepo = new UsersRepository(db as never);

		await db.insert(usersSchema).values({
			id: "u1",
			name: "Alice Owner",
			email: "alice@example.com",
			role: "owner",
			googleId: "google-alice",
			createdAt: TS,
		} as never);
		await db.insert(usersSchema).values({
			id: "u2",
			name: "Bob User",
			email: "bob@example.com",
			role: "user",
			googleId: "google-bob",
			createdAt: "2026-01-02T00:00:00.000Z",
		} as never);
	});

	it("silently ignores filter on non-allowlisted column (googleId)", async () => {
		// googleId is PII — not in filterable, filter dropped, both users returned
		const result = await usersRepo.findAll({
			filters: { googleId: "google-alice" },
		});
		expect(result.data).toHaveLength(2);
	});

	it("silently ignores filter on non-allowlisted column (pushToken)", async () => {
		const result = await usersRepo.findAll({
			filters: { pushToken: "any-token" },
		});
		expect(result.data).toHaveLength(2);
	});

	it("filters by role when in allowlist", async () => {
		const result = await usersRepo.findAll({ filters: { role: "owner" } });
		expect(result.data).toHaveLength(1);
		expect((result.data[0] as { id: string }).id).toBe("u1");
	});

	it("restricts search to name, email, phone — does not search googleId", async () => {
		// 'google-alice' matches googleId but googleId is not in searchable allowlist
		const result = await usersRepo.findAll({ search: "google-alice" });
		expect(result.data).toHaveLength(0);
	});

	it("searches by name when in searchable allowlist", async () => {
		const result = await usersRepo.findAll({ search: "Alice" });
		expect(result.data).toHaveLength(1);
		expect((result.data[0] as { id: string }).id).toBe("u1");
	});

	it("does not let ?fields= bypass the searchable allowlist (googleId)", async () => {
		// Attempt to search the PII googleId column by smuggling it through `fields`.
		// The searchable allowlist must still constrain which columns are searched, so
		// no predicate is applied to googleId and both users come back.
		const result = await usersRepo.findAll({
			search: "google-alice",
			fields: ["googleId"],
		});
		expect(result.data).toHaveLength(2);
	});

	it("intersects ?fields= with the searchable allowlist (name honored, pushToken dropped)", async () => {
		// `name` is searchable, `pushToken` is not — only the `name` predicate survives,
		// so "Alice" matches just u1. (`fields` also projects output columns, hence the
		// assertion on `name` rather than `id`.)
		const result = await usersRepo.findAll({
			search: "Alice",
			fields: ["name", "pushToken"],
		});
		expect(result.data).toHaveLength(1);
		expect((result.data[0] as { name: string }).name).toBe("Alice Owner");
	});

	it("ignores sort on a non-sortable column and falls back to the default order", async () => {
		// `email` is not in the sortable allowlist. Emails sort opposite to createdAt,
		// so honoring the request would flip the order; gating keeps default (createdAt asc).
		await db.insert(usersSchema).values({
			id: "u3",
			name: "Zoe Late",
			email: "aaa-first@example.com",
			role: "user",
			googleId: "google-zoe",
			createdAt: "2026-01-03T00:00:00.000Z",
		} as never);

		const result = await usersRepo.findAll({ sort: "email", sortBy: "asc" });
		// Default order is createdAt asc → u1, u2, u3 (NOT email asc which would put u3 first)
		expect((result.data as Array<{ id: string }>).map((r) => r.id)).toEqual([
			"u1",
			"u2",
			"u3",
		]);
	});

	it("excludes googleId and pushToken from the default list projection", async () => {
		const result = await usersRepo.findAll({});
		expect(result.data).toHaveLength(2);
		for (const row of result.data) {
			expect(row).not.toHaveProperty("googleId");
			expect(row).not.toHaveProperty("pushToken");
			// selectable columns are still present
			expect(row).toHaveProperty("id");
			expect(row).toHaveProperty("name");
			expect(row).toHaveProperty("role");
		}
	});

	it("does not let ?fields=googleId project the PII column (floors to selectable)", async () => {
		// The attack: request only the non-selectable PII column. The empty intersection
		// must floor to the full selectable set, never fall through to SELECT *.
		const result = await usersRepo.findAll({ fields: ["googleId"] });
		expect(result.data).toHaveLength(2);
		for (const row of result.data) {
			expect(row).not.toHaveProperty("googleId");
		}
	});

	it("intersects ?fields= with selectable (name kept, pushToken dropped)", async () => {
		const result = await usersRepo.findAll({ fields: ["name", "pushToken"] });
		expect(result.data).toHaveLength(2);
		for (const row of result.data) {
			expect(row).toHaveProperty("name");
			expect(row).not.toHaveProperty("pushToken");
			// narrowed to the allowed subset → id was not requested
			expect(row).not.toHaveProperty("id");
		}
	});
});
