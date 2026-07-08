import { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import { BusinessesRepository } from "@repo/core/src/database/repositories/businesses.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationService } from "../../core/authorization";
import { ForbiddenError, NotFoundError } from "../../core/errors";
import { seedChain } from "../helpers/seed";
import { createTestDb } from "../helpers/test-db";

function makeGuard(db: ReturnType<typeof createTestDb>) {
	return new AuthorizationService(
		new BusinessesRepository(db as never),
		new BranchesRepository(db as never),
	);
}

describe("AuthorizationService.assertBusinessOwner", () => {
	let db: ReturnType<typeof createTestDb>;
	beforeEach(() => {
		db = createTestDb();
	});

	it("returns the business when the actor owns it", async () => {
		const { businessId } = await seedChain(db, { ownerId: "owner-1" });
		const business = await makeGuard(db).assertBusinessOwner(
			"owner-1",
			businessId,
		);
		expect(business.id).toBe(businessId);
	});

	it("throws 403 when the actor does not own it", async () => {
		const { businessId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeGuard(db).assertBusinessOwner("owner-2", businessId),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("throws 404 when the business does not exist", async () => {
		await expect(
			makeGuard(db).assertBusinessOwner("owner-1", "missing"),
		).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe("AuthorizationService.assertBranchAccess", () => {
	let db: ReturnType<typeof createTestDb>;
	beforeEach(() => {
		db = createTestDb();
	});

	it("allows the owner (scopedBranchIds null) who owns the business", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeGuard(db).assertBranchAccess("owner-1", branchId, null),
		).resolves.toBeUndefined();
	});

	it("throws 403 for an owner who does not own the business", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeGuard(db).assertBranchAccess("owner-2", branchId, null),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("allows a manager assigned to the branch (scopedBranchIds includes it)", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeGuard(db).assertBranchAccess("manager-1", branchId, [branchId]),
		).resolves.toBeUndefined();
	});

	it("throws 403 for a manager not assigned to the branch", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeGuard(db).assertBranchAccess("manager-1", branchId, ["other-branch"]),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("throws 404 for an owner when the branch does not exist", async () => {
		await expect(
			makeGuard(db).assertBranchAccess("owner-1", "missing", null),
		).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe("AuthorizationService.assertBranchOwner", () => {
	let db: ReturnType<typeof createTestDb>;
	beforeEach(() => {
		db = createTestDb();
	});

	it("returns the branch for the owning actor", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		const branch = await makeGuard(db).assertBranchOwner("owner-1", branchId);
		expect(branch.id).toBe(branchId);
	});

	it("throws 403 for a different owner", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeGuard(db).assertBranchOwner("owner-2", branchId),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("throws 404 when the branch does not exist", async () => {
		await expect(
			makeGuard(db).assertBranchOwner("owner-1", "missing"),
		).rejects.toBeInstanceOf(NotFoundError);
	});
});
