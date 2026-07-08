import { BookingsRepository } from "@repo/core/src/database/repositories/bookings.repository";
import { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import { BusinessesRepository } from "@repo/core/src/database/repositories/businesses.repository";
import { ServicesRepository } from "@repo/core/src/database/repositories/services.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationService } from "../../../core/authorization";
import { ForbiddenError, NotFoundError } from "../../../core/errors";
import { BranchesService } from "../../../modules/branches/branches.service";
import { seedChain } from "../../helpers/seed";
import { createTestDb } from "../../helpers/test-db";

// NOTE: keep this factory in sync with the BranchesService constructor.
// Constructor after Task 1 migration: (repo, servicesRepo, bookingsRepo, authz).
function makeService(db: ReturnType<typeof createTestDb>) {
	const authz = new AuthorizationService(
		new BusinessesRepository(db as never),
		new BranchesRepository(db as never),
	);
	return new BranchesService(
		new BranchesRepository(db as never),
		new ServicesRepository(db as never),
		new BookingsRepository(db as never),
		authz,
	);
}

describe("BranchesService authorization (characterization)", () => {
	let db: ReturnType<typeof createTestDb>;
	beforeEach(() => {
		db = createTestDb();
	});

	it("create: rejects an owner who does not own the business (403)", async () => {
		const { businessId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeService(db).create("owner-2", businessId, {
				name: "B",
				address: "1 St",
				city: "Dhaka",
			} as never),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("create: throws 404 for a missing business", async () => {
		await expect(
			makeService(db).create("owner-1", "missing-business", {
				name: "B",
				address: "1 St",
				city: "Dhaka",
			} as never),
		).rejects.toBeInstanceOf(NotFoundError);
	});

	it("create: succeeds for the business owner", async () => {
		const { businessId } = await seedChain(db, { ownerId: "owner-1" });
		const result = await makeService(db).create("owner-1", businessId, {
			name: "New Branch",
			address: "1 St",
			city: "Dhaka",
		} as never);
		expect(result).toBeTruthy();
	});

	it("update: rejects a different owner (403)", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeService(db).update("owner-2", branchId, { name: "X" }),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("update: throws 404 for a missing branch", async () => {
		await expect(
			makeService(db).update("owner-1", "missing", { name: "X" }),
		).rejects.toBeInstanceOf(NotFoundError);
	});

	it("delete: rejects a different owner (403)", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeService(db).delete("owner-2", branchId),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("setHours: rejects a different owner (403)", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeService(db).setHours("owner-2", branchId, [
				{ dayOfWeek: 0, isClosed: true, openTime: null, closeTime: null },
			]),
		).rejects.toBeInstanceOf(ForbiddenError);
	});
});
