import { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import { BusinessesRepository } from "@repo/core/src/database/repositories/businesses.repository";
import { CustomerAddressesRepository } from "@repo/core/src/database/repositories/customer-addresses.repository";
import { OrdersRepository } from "@repo/core/src/database/repositories/orders.repository";
import { ProductsRepository } from "@repo/core/src/database/repositories/products.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationService } from "../../../core/authorization";
import { ForbiddenError, NotFoundError } from "../../../core/errors";
import { ProductsService } from "../../../modules/products/products.service";
import { seedChain } from "../../helpers/seed";
import { createTestDb } from "../../helpers/test-db";

const stubStorage = {
	upload: async () => "https://example/x.jpg",
} as never;

function makeProducts(db: ReturnType<typeof createTestDb>) {
	const authz = new AuthorizationService(
		new BusinessesRepository(db as never),
		new BranchesRepository(db as never),
		new ProductsRepository(db as never),
		new OrdersRepository(db as never),
		new CustomerAddressesRepository(db as never),
	);
	return new ProductsService(
		new ProductsRepository(db as never),
		authz,
		stubStorage,
	);
}

const cylinder = {
	name: "12kg Cylinder",
	category: "LPG",
	price: 150000,
	stock: 20,
};

describe("ProductsService authorization + CRUD", () => {
	let db: ReturnType<typeof createTestDb>;
	beforeEach(() => {
		db = createTestDb();
	});

	it("create: rejects an owner who does not own the branch's business (403)", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeProducts(db).create("owner-2", branchId, cylinder as never, null),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("create: rejects a manager not assigned to the branch (403)", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeProducts(db).create("mgr", branchId, cylinder as never, [
				"other-branch",
			]),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("create: succeeds for the business owner and persists stock per branch", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		const p = await makeProducts(db).create(
			"owner-1",
			branchId,
			cylinder as never,
			null,
		);
		expect(p.stock).toBe(20);
		expect(p.branchId).toBe(branchId);
	});

	it("get: returns the product, 404 when missing", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		const svc = makeProducts(db);
		const p = await svc.create("owner-1", branchId, cylinder as never, null);
		expect((await svc.get(p.id)).id).toBe(p.id);
		await expect(svc.get("missing")).rejects.toBeInstanceOf(NotFoundError);
	});

	it("update: rejects a different owner (403) and 404s a missing product", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		const svc = makeProducts(db);
		const p = await svc.create("owner-1", branchId, cylinder as never, null);
		await expect(
			svc.update("owner-2", p.id, { price: 160000 } as never, null),
		).rejects.toBeInstanceOf(ForbiddenError);
		await expect(
			svc.update("owner-1", "missing", { price: 1 } as never, null),
		).rejects.toBeInstanceOf(NotFoundError);
	});

	it("delete: succeeds for the business owner", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		const svc = makeProducts(db);
		const p = await svc.create("owner-1", branchId, cylinder as never, null);
		const result = await svc.delete("owner-1", p.id, null);
		expect(result).toBeTruthy();
	});
});
