import { describe, expect, it } from "vitest";
import { seedChain } from "./seed";
import { createTestDb } from "./test-db";

describe("seedChain", () => {
	it("seeds a business→branch→service chain owned by the given owner", async () => {
		const db = createTestDb();
		const chain = await seedChain(db, { ownerId: "owner-1" });
		expect(chain.ownerId).toBe("owner-1");
		expect(chain.businessId).toBeTruthy();
		expect(chain.branchId).toBeTruthy();
		expect(chain.serviceId).toBeTruthy();
	});
});
