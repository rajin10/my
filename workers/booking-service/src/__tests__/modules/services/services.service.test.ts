import { BookingsRepository } from "@repo/core/src/database/repositories/bookings.repository";
import { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import { BusinessesRepository } from "@repo/core/src/database/repositories/businesses.repository";
import { CouponsRepository } from "@repo/core/src/database/repositories/coupons.repository";
import { CustomerAddressesRepository } from "@repo/core/src/database/repositories/customer-addresses.repository";
import { OrdersRepository } from "@repo/core/src/database/repositories/orders.repository";
import { ProductsRepository } from "@repo/core/src/database/repositories/products.repository";
import { ReviewsRepository } from "@repo/core/src/database/repositories/reviews.repository";
import { ServicesRepository } from "@repo/core/src/database/repositories/services.repository";
import { TeamRepository } from "@repo/core/src/database/repositories/team.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationService } from "../../../core/authorization";
import { ForbiddenError, NotFoundError } from "../../../core/errors";
import { ServicesService } from "../../../modules/services/services.service";
import { seedChain } from "../../helpers/seed";
import { createTestDb } from "../../helpers/test-db";

const stubStorage = {
	upload: async () => "https://example/x.jpg",
} as never;

function makeService(db: ReturnType<typeof createTestDb>) {
	const authz = new AuthorizationService(
		new BusinessesRepository(db as never),
		new BranchesRepository(db as never),
		new ServicesRepository(db as never),
		new CouponsRepository(db as never),
		new BookingsRepository(db as never),
		new TeamRepository(db as never),
		new ReviewsRepository(db as never),
	);
	return new ServicesService(
		new ServicesRepository(db as never),
		authz,
		stubStorage,
	);
}

describe("ServicesService.get", () => {
	let db: ReturnType<typeof createTestDb>;
	beforeEach(() => {
		db = createTestDb();
	});

	it("returns the service when found", async () => {
		const { serviceId } = await seedChain(db, { ownerId: "owner-1" });
		const svc = await makeService(db).get(serviceId);
		expect(svc.id).toBe(serviceId);
	});

	it("throws NotFoundError when service is missing", async () => {
		await expect(makeService(db).get("missing")).rejects.toBeInstanceOf(
			NotFoundError,
		);
	});
});

describe("ServicesService.listByBranch", () => {
	let db: ReturnType<typeof createTestDb>;
	beforeEach(() => {
		db = createTestDb();
	});

	it("returns services for a branch", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		const result = await makeService(db).listByBranch(branchId);
		expect(result).toBeDefined();
	});
});

describe("ServicesService authorization (characterization)", () => {
	let db: ReturnType<typeof createTestDb>;
	beforeEach(() => {
		db = createTestDb();
	});

	it("create: rejects an owner who does not own the branch's business (403)", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeService(db).create(
				"owner-2",
				branchId,
				{ name: "X", category: "Hair", duration: 30, price: 1000 } as never,
				null,
			),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("create: rejects a manager not assigned to the branch (403)", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeService(db).create(
				"mgr",
				branchId,
				{ name: "X", category: "Hair", duration: 30, price: 1000 } as never,
				["other-branch"],
			),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("create: succeeds for the business owner", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		const result = await makeService(db).create(
			"owner-1",
			branchId,
			{ name: "X", category: "Hair", duration: 30, price: 1000 } as never,
			null,
		);
		expect(result).toBeTruthy();
	});

	it("create: succeeds for a manager assigned to the branch", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		const result = await makeService(db).create(
			"mgr",
			branchId,
			{ name: "X", category: "Hair", duration: 30, price: 1000 } as never,
			[branchId],
		);
		expect(result).toBeTruthy();
	});

	it("update: rejects a different owner (403)", async () => {
		const { serviceId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeService(db).update(
				"owner-2",
				serviceId,
				{ price: 2000 } as never,
				null,
			),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("update: throws 404 when the service is missing", async () => {
		await expect(
			makeService(db).update(
				"owner-1",
				"missing",
				{ price: 2000 } as never,
				null,
			),
		).rejects.toBeInstanceOf(NotFoundError);
	});

	it("delete: rejects a manager not assigned to the branch (403)", async () => {
		const { serviceId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeService(db).delete("mgr", serviceId, ["other-branch"]),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("delete: succeeds for the business owner", async () => {
		const { serviceId } = await seedChain(db, { ownerId: "owner-1" });
		const result = await makeService(db).delete("owner-1", serviceId, null);
		expect(result).toBeTruthy();
	});
});
