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
import { bookingsSchema, reviewsSchema } from "@repo/core/src/database/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationService } from "../../../core/authorization";
import { ForbiddenError, NotFoundError } from "../../../core/errors";
import { ReviewsService } from "../../../modules/reviews/reviews.service";
import { seedChain } from "../../helpers/seed";
import { createTestDb } from "../../helpers/test-db";

const TS = "2026-01-01T00:00:00.000Z";

// NOTE: keep in sync with ReviewsService constructor.
// After Task 4 migration the constructor is (repo, bookingsRepo, branchesRepo, authz).
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
	return new ReviewsService(
		new ReviewsRepository(db as never),
		new BookingsRepository(db as never),
		new BranchesRepository(db as never),
		authz,
	);
}

async function seedReview(
	db: ReturnType<typeof createTestDb>,
	ownerId: string,
) {
	const { businessId, branchId, serviceId } = await seedChain(db, { ownerId });
	const bookingId = `booking-${ownerId}`;
	const reviewId = `review-${ownerId}`;
	await db.insert(bookingsSchema).values({
		id: bookingId,
		userId: "cust-1",
		serviceId,
		branchId,
		slot: "2026-02-01T10:00:00",
		status: "Completed",
		price: 1000,
		createdAt: TS,
	} as never);
	await db.insert(reviewsSchema).values({
		id: reviewId,
		businessId,
		userId: "cust-1",
		bookingId,
		serviceId,
		rating: 5,
		text: "Great",
		status: "Pending",
		createdAt: TS,
	} as never);
	return { reviewId, businessId, bookingId };
}

describe("ReviewsService.listMine", () => {
	it("returns the user's reviews (Pending+Published) with business/service names, newest-first, excluding deleted and other users", async () => {
		const db = createTestDb();
		const { businessId, serviceId } = await seedChain(db, {
			ownerId: "owner-1",
		});
		await db.insert(reviewsSchema).values([
			{
				id: "r-old",
				businessId,
				userId: "cust-1",
				serviceId,
				bookingId: "b1",
				rating: 4,
				text: "ok",
				status: "Published",
				createdAt: "2026-01-01T00:00:00.000Z",
			},
			{
				id: "r-new",
				businessId,
				userId: "cust-1",
				serviceId,
				bookingId: "b2",
				rating: 5,
				text: "great",
				status: "Pending",
				createdAt: "2026-02-01T00:00:00.000Z",
			},
			{
				id: "r-del",
				businessId,
				userId: "cust-1",
				serviceId,
				bookingId: "b3",
				rating: 1,
				text: "bad",
				status: "Published",
				createdAt: "2026-03-01T00:00:00.000Z",
				deletedAt: "2026-03-02T00:00:00.000Z",
			},
			{
				id: "r-other",
				businessId,
				userId: "cust-2",
				serviceId,
				bookingId: "b4",
				rating: 3,
				text: "meh",
				status: "Published",
				createdAt: "2026-01-15T00:00:00.000Z",
			},
		] as never);

		const svc = makeService(db);
		const result = await svc.listMine("cust-1");

		expect(result.map((r) => r.id)).toEqual(["r-new", "r-old"]);
		expect(result[0].businessName).toBe("Test Business");
		expect(result[0].serviceName).toBe("Haircut");
		expect(result[0].status).toBe("Pending");
	});

	it("falls back to placeholder names when the business/service rows are missing", async () => {
		const db = createTestDb();
		// FK constraints are disabled in the test DB, so a review can reference a
		// business/service that no longer exists; the left joins then return null.
		await db.insert(reviewsSchema).values([
			{
				id: "r-orphan",
				businessId: "gone-business",
				userId: "cust-1",
				serviceId: "gone-service",
				bookingId: "b1",
				rating: 4,
				text: "ok",
				status: "Published",
				createdAt: "2026-01-01T00:00:00.000Z",
			},
		] as never);

		const svc = makeService(db);
		const result = await svc.listMine("cust-1");

		expect(result).toHaveLength(1);
		expect(result[0].businessName).toBe("Unknown business");
		expect(result[0].serviceName).toBe("Unknown service");
	});
});

describe("ReviewsService authorization (characterization)", () => {
	let db: ReturnType<typeof createTestDb>;
	beforeEach(() => {
		db = createTestDb();
	});

	it("listPending: rejects a different owner (403)", async () => {
		const { businessId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeService(db).listPending("owner-2", businessId),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("listPending: throws 404 for a missing business", async () => {
		await expect(
			makeService(db).listPending("owner-1", "missing"),
		).rejects.toBeInstanceOf(NotFoundError);
	});

	it("listPending: succeeds for the business owner", async () => {
		const { businessId } = await seedChain(db, { ownerId: "owner-1" });
		const result = await makeService(db).listPending("owner-1", businessId);
		expect(result).toBeDefined();
	});

	it("approve: rejects a different owner (403)", async () => {
		const { reviewId } = await seedReview(db, "owner-1");
		await expect(
			makeService(db).approve("owner-2", reviewId),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("approve: throws 404 for a missing review", async () => {
		await expect(
			makeService(db).approve("owner-1", "missing"),
		).rejects.toBeInstanceOf(NotFoundError);
	});

	it("reject: rejects a different owner (403)", async () => {
		const { reviewId } = await seedReview(db, "owner-1");
		await expect(
			makeService(db).reject("owner-2", reviewId),
		).rejects.toBeInstanceOf(ForbiddenError);
	});
});
