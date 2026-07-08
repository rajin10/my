/**
 * Integration test for the `businesses.brand_palette` column.
 *
 * Uses the real in-memory SQLite harness (createTestDb) with all migrations
 * applied — including 0017's `ALTER TABLE businesses ADD brand_palette text` —
 * so the actual Drizzle `mode: "json"` round-trip is exercised against a real
 * column, not mocked. The service/route tests mock the repository, so this is
 * the only check that a palette is genuinely stored as TEXT and read back as a
 * parsed object (and that the column applies at all).
 */
import { BusinessesRepository } from "@repo/core/src/database/repositories/businesses.repository";
import type { BrandPalette } from "@repo/core/src/database/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../helpers/test-db";

const PALETTE: BrandPalette = {
	primary: "#5B2A86",
	accent: "#C9A063",
	foreground: "#1A1320",
	surface: "#FDFBFF",
};

let db: ReturnType<typeof createTestDb>;
let repo: BusinessesRepository;

beforeEach(() => {
	db = createTestDb();
	repo = new BusinessesRepository(db as never);
});

describe("businesses.brand_palette round-trip", () => {
	it("stores a palette and reads it back as a parsed object (mode: json)", async () => {
		const created = await repo.create({
			name: "Themed Salon",
			category: "Beauty",
			city: "Dhaka",
			vertical: "booking",
			ownerId: "owner-1",
			brandPalette: PALETTE,
		} as never);

		const read = await repo.findOne(created.data?.id);
		// Must come back as an object, not a JSON string.
		expect(read.data?.brandPalette).toEqual(PALETTE);
		expect(typeof read.data?.brandPalette).toBe("object");
	});

	it("defaults to null when no palette is supplied", async () => {
		const created = await repo.create({
			name: "Plain Salon",
			category: "Beauty",
			city: "Dhaka",
			vertical: "booking",
			ownerId: "owner-1",
		} as never);

		const read = await repo.findOne(created.data?.id);
		expect(read.data?.brandPalette).toBeNull();
	});

	it("updates and clears a palette through updateOne", async () => {
		const created = await repo.create({
			name: "Salon",
			category: "Beauty",
			city: "Dhaka",
			vertical: "booking",
			ownerId: "owner-1",
		} as never);
		const id = created.data?.id;

		await repo.updateOne(id, { brandPalette: PALETTE } as never);
		expect((await repo.findOne(id)).data?.brandPalette).toEqual(PALETTE);

		// Clearing reverts to Talash defaults (null).
		await repo.updateOne(id, { brandPalette: null } as never);
		expect((await repo.findOne(id)).data?.brandPalette).toBeNull();
	});
});
