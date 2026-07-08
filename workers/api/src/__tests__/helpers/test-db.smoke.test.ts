import { businessesSchema } from "@repo/core/src/database/schema";
import { describe, expect, it } from "vitest";
import { createTestDb } from "./test-db";

describe("createTestDb", () => {
	it("creates a usable in-memory db with the businesses table", async () => {
		const db = createTestDb();
		await db.insert(businessesSchema).values({
			id: "v-1",
			ownerId: "o-1",
			name: "Smoke Business",
			category: "Beauty",
			city: "Dhaka",
			createdAt: "2026-01-01T00:00:00.000Z",
		} as never);
		const rows = await db.select().from(businessesSchema);
		expect(rows).toHaveLength(1);
	});
});
