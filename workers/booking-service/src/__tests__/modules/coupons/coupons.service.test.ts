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
import { couponsSchema } from "@repo/core/src/database/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationService } from "../../../core/authorization";
import { ForbiddenError, NotFoundError } from "../../../core/errors";
import { CouponsService } from "../../../modules/coupons/coupons.service";
import { seedChain } from "../../helpers/seed";
import { createTestDb } from "../../helpers/test-db";

const TS = "2026-01-01T00:00:00.000Z";

// NOTE: keep in sync with CouponsService constructor.
// After Task 2 migration the constructor is (repo, authz).
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
	return new CouponsService(new CouponsRepository(db as never), authz);
}

async function seedCoupon(
	db: ReturnType<typeof createTestDb>,
	ownerId: string,
) {
	const { businessId } = await seedChain(db, { ownerId });
	const couponId = `coupon-${ownerId}`;
	await db.insert(couponsSchema).values({
		id: couponId,
		businessId,
		code: "TEST10",
		type: "Percentage",
		value: 10,
		maxUses: 100,
		expiresAt: "2027-01-01T00:00:00.000Z",
		createdAt: TS,
	} as never);
	return { couponId, businessId };
}

describe("CouponsService authorization (characterization)", () => {
	let db: ReturnType<typeof createTestDb>;
	beforeEach(() => {
		db = createTestDb();
	});

	it("listByBusiness: rejects a different owner (403)", async () => {
		const { businessId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeService(db).listByBusiness("owner-2", businessId, {
				page: 1,
				limit: 10,
			} as never),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("listByBusiness: throws 404 for a missing business", async () => {
		await expect(
			makeService(db).listByBusiness("owner-1", "missing", {
				page: 1,
				limit: 10,
			} as never),
		).rejects.toBeInstanceOf(NotFoundError);
	});

	it("listByBusiness: succeeds for the business owner", async () => {
		const { businessId } = await seedChain(db, { ownerId: "owner-1" });
		const result = await makeService(db).listByBusiness("owner-1", businessId, {
			page: 1,
			limit: 10,
		} as never);
		expect(result).toBeDefined();
	});

	it("get: rejects a different owner (403)", async () => {
		const { couponId } = await seedCoupon(db, "owner-1");
		await expect(
			makeService(db).get("owner-2", couponId),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("get: throws 404 for a missing coupon", async () => {
		await expect(
			makeService(db).get("owner-1", "missing"),
		).rejects.toBeInstanceOf(NotFoundError);
	});

	it("create: rejects a different owner (403)", async () => {
		const { businessId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeService(db).create("owner-2", businessId, {
				code: "OFF10",
				type: "Percentage",
				value: 10,
			} as never),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("update: rejects a different owner (403)", async () => {
		const { couponId } = await seedCoupon(db, "owner-1");
		await expect(
			makeService(db).update("owner-2", couponId, { value: 20 } as never),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("delete: rejects a different owner (403)", async () => {
		const { couponId } = await seedCoupon(db, "owner-1");
		await expect(
			makeService(db).delete("owner-2", couponId),
		).rejects.toBeInstanceOf(ForbiddenError);
	});
});
