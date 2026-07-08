import { BaseRepository } from "@repo/core/src/database/repositories/base.repository";
import { businessesSchema } from "@repo/core/src/database/schema";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../helpers/test-db";

type Db = ReturnType<typeof createTestDb>;

// Five businesses. Two share a createdAt (the tie case the keyset must break on id).
const SEED = [
	{ id: "id-zzz", createdAt: "2026-01-01T00:00:00.000Z" },
	{ id: "id-aaa", createdAt: "2026-01-01T00:00:00.000Z" }, // tie with id-zzz
	{ id: "id-mmm", createdAt: "2026-01-02T00:00:00.000Z" },
	{ id: "id-bbb", createdAt: "2026-01-03T00:00:00.000Z" },
	{ id: "id-yyy", createdAt: "2026-01-04T00:00:00.000Z" },
];

async function seed(db: Db) {
	for (const row of SEED) {
		await db.insert(businessesSchema).values({
			id: row.id,
			ownerId: "owner-1",
			name: `Business ${row.id}`,
			category: "Beauty",
			city: "Dhaka",
			createdAt: row.createdAt,
		} as never);
	}
}

function ids(rows: Array<Record<string, unknown>>) {
	return rows.map((r) => r.id as string);
}

describe("BaseRepository.findAll — cursor pagination", () => {
	let db: Db;

	beforeEach(async () => {
		db = createTestDb();
		await seed(db);
	});

	it("paginates desc by (createdAt, id) returning disjoint, complete, ordered pages", async () => {
		const p1 = await BaseRepository.findAll(db as never, businessesSchema, {
			cursor: "",
			limit: 2,
			sortBy: "desc",
		});
		expect(p1.query.mode).toBe("cursor");
		expect(ids(p1.data)).toEqual(["id-yyy", "id-bbb"]);
		expect(p1.query.hasNextPage).toBe(true);
		expect(p1.query.nextCursor).toBeTruthy();

		const p2 = await BaseRepository.findAll(db as never, businessesSchema, {
			cursor: p1.query.nextCursor as string,
			limit: 2,
			sortBy: "desc",
		});
		// id-mmm (02), then the tie at 01 broken by id desc => id-zzz before id-aaa
		expect(ids(p2.data)).toEqual(["id-mmm", "id-zzz"]);
		expect(p2.query.hasNextPage).toBe(true);

		const p3 = await BaseRepository.findAll(db as never, businessesSchema, {
			cursor: p2.query.nextCursor as string,
			limit: 2,
			sortBy: "desc",
		});
		expect(ids(p3.data)).toEqual(["id-aaa"]);
		expect(p3.query.hasNextPage).toBe(false);
		expect(p3.query.nextCursor).toBeNull();

		const all = [...ids(p1.data), ...ids(p2.data), ...ids(p3.data)];
		expect(new Set(all).size).toBe(5);
		expect(all).toHaveLength(5);
	});

	it("honors asc direction", async () => {
		const p1 = await BaseRepository.findAll(db as never, businessesSchema, {
			cursor: "",
			limit: 2,
			sortBy: "asc",
		});
		// asc by (createdAt, id): tie at 01 => id-aaa before id-zzz
		expect(ids(p1.data)).toEqual(["id-aaa", "id-zzz"]);
	});

	it("excludes soft-deleted rows", async () => {
		await db
			.update(businessesSchema)
			.set({ deletedAt: "2026-02-01T00:00:00.000Z" } as never)
			// soft-delete the newest row so its absence is observable on page 1
			.where(eq(businessesSchema.id, "id-yyy"));

		const p1 = await BaseRepository.findAll(db as never, businessesSchema, {
			cursor: "",
			limit: 2,
			sortBy: "desc",
		});
		expect(ids(p1.data)).toEqual(["id-bbb", "id-mmm"]);
	});

	it("treats a malformed cursor as the first page", async () => {
		const p = await BaseRepository.findAll(db as never, businessesSchema, {
			cursor: "garbage!!",
			limit: 2,
			sortBy: "desc",
		});
		expect(ids(p.data)).toEqual(["id-yyy", "id-bbb"]);
	});
});

describe("BaseRepository.findAll — queryAllowlist", () => {
	let db: Db;

	beforeEach(async () => {
		db = createTestDb();
		await seed(db);
	});

	it("restricts filter columns to the allowlist", async () => {
		// 'ownerId' is not in the filterable allowlist — filter is silently ignored
		const result = await BaseRepository.findAll(
			db as never,
			businessesSchema,
			{ filters: { ownerId: "owner-1" } },
			{ filterable: ["status"] },
		);
		// All 5 businesses returned because ownerId filter was dropped
		expect(result.data).toHaveLength(5);
	});

	it("allows filter when column is in the allowlist", async () => {
		// Insert a second owner's business
		await (db as never).insert(businessesSchema).values({
			id: "id-other",
			ownerId: "owner-2",
			name: "Other Business",
			category: "Beauty",
			city: "Dhaka",
			createdAt: "2026-01-05T00:00:00.000Z",
		});

		const result = await BaseRepository.findAll(
			db as never,
			businessesSchema,
			{ filters: { ownerId: "owner-2" } },
			{ filterable: ["ownerId", "status"] },
		);
		expect(result.data).toHaveLength(1);
		expect((result.data[0] as { id: string }).id).toBe("id-other");
	});

	it("restricts searchable columns to the allowlist", async () => {
		// 'ownerId' is not in searchable allowlist — searching 'owner-1' returns nothing
		const result = await BaseRepository.findAll(
			db as never,
			businessesSchema,
			{ search: "owner-1" },
			{ searchable: ["name"] },
		);
		// 'owner-1' does not appear in any business name
		expect(result.data).toHaveLength(0);
	});

	it("defaults to a safe-empty allowlist when none is provided (filter dropped)", async () => {
		// Insert a second owner's business so the filter would be observable if applied.
		await (db as never).insert(businessesSchema).values({
			id: "id-other",
			ownerId: "owner-2",
			name: "Other Business",
			category: "Beauty",
			city: "Dhaka",
			createdAt: "2026-01-05T00:00:00.000Z",
		});

		// No allowlist → safe default: column-level filtering is opt-in, so the
		// ownerId filter is dropped and all 6 businesses are returned (not just owner-2's).
		const result = await BaseRepository.findAll(db as never, businessesSchema, {
			filters: { ownerId: "owner-2" },
		});
		expect(result.data).toHaveLength(6);
	});

	it("defaults to a safe-empty searchable allowlist when none is provided", async () => {
		// "Business id-zzz" matches the name column. Under the safe default no column is
		// searchable, so the search clause is omitted entirely (search disabled) and the
		// match does NOT narrow the result — proving columns aren't scanned by default.
		const result = await BaseRepository.findAll(db as never, businessesSchema, {
			search: "Business id-zzz",
		});
		expect(result.data).toHaveLength(5);
	});
});
