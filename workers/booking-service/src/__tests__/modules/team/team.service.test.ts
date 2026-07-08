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
import { teamMembersSchema } from "@repo/core/src/database/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationService } from "../../../core/authorization";
import { ForbiddenError, NotFoundError } from "../../../core/errors";
import { TeamService } from "../../../modules/team/team.service";
import { seedChain } from "../../helpers/seed";
import { createTestDb } from "../../helpers/test-db";

const TS = "2026-01-01T00:00:00.000Z";

// NOTE: keep in sync with TeamService constructor.
// After Task 3 migration the constructor is (repo, authz).
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
	return new TeamService(new TeamRepository(db as never), authz);
}

async function seedMember(
	db: ReturnType<typeof createTestDb>,
	ownerId: string,
) {
	const { businessId } = await seedChain(db, { ownerId });
	const memberId = `member-${ownerId}`;
	await db.insert(teamMembersSchema).values({
		id: memberId,
		businessId,
		userId: `user-${ownerId}`,
		role: "Staff",
		createdAt: TS,
	} as never);
	return { memberId, businessId };
}

describe("TeamService authorization (characterization)", () => {
	let db: ReturnType<typeof createTestDb>;
	beforeEach(() => {
		db = createTestDb();
	});

	it("listByBusiness: rejects a different owner (403)", async () => {
		const { businessId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeService(db).listByBusiness("owner-2", businessId),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("listByBusiness: throws 404 for a missing business", async () => {
		await expect(
			makeService(db).listByBusiness("owner-1", "missing"),
		).rejects.toBeInstanceOf(NotFoundError);
	});

	it("listByBusiness: succeeds for the business owner", async () => {
		const { businessId } = await seedChain(db, { ownerId: "owner-1" });
		const result = await makeService(db).listByBusiness("owner-1", businessId);
		expect(result).toBeDefined();
	});

	it("add: rejects a different owner (403)", async () => {
		const { businessId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeService(db).add("owner-2", businessId, {
				userId: "u-x",
				role: "Staff",
			} as never),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("update: rejects a different owner (403)", async () => {
		const { memberId } = await seedMember(db, "owner-1");
		await expect(
			makeService(db).update("owner-2", memberId, { role: "Manager" }),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("update: throws 404 for a missing member", async () => {
		await expect(
			makeService(db).update("owner-1", "missing", { role: "Manager" }),
		).rejects.toBeInstanceOf(NotFoundError);
	});

	it("remove: rejects a different owner (403)", async () => {
		const { memberId } = await seedMember(db, "owner-1");
		await expect(
			makeService(db).remove("owner-2", memberId),
		).rejects.toBeInstanceOf(ForbiddenError);
	});
});
