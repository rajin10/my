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
import { bookingsSchema } from "@repo/core/src/database/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationService } from "../../../core/authorization";
import { ForbiddenError } from "../../../core/errors";
import { BookingsService } from "../../../modules/bookings/bookings.service";
import { seedChain } from "../../helpers/seed";
import { createTestDb } from "../../helpers/test-db";

const TS = "2026-01-01T00:00:00.000Z";

const stubQueue = { send: vi.fn().mockResolvedValue(undefined) } as never;
const stubCouponsService = {
	validate: vi.fn(),
	applyUsage: vi.fn(),
	findByCode: vi.fn(),
	findByCodeAndBusiness: vi.fn(),
	revertUsage: vi.fn(),
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
	return new BookingsService(
		new BookingsRepository(db as never),
		new ServicesRepository(db as never),
		new BranchesRepository(db as never),
		stubCouponsService,
		stubQueue,
		authz,
		undefined,
	);
}

async function seedBooking(
	db: ReturnType<typeof createTestDb>,
	ownerId: string,
	userId: string,
) {
	const { branchId, serviceId } = await seedChain(db, { ownerId });
	const bookingId = `booking-${userId}-${ownerId}`;
	await db.insert(bookingsSchema).values({
		id: bookingId,
		userId,
		serviceId,
		branchId,
		slot: "2026-02-01T10:00:00",
		status: "Pending",
		price: 1000,
		createdAt: TS,
	} as never);
	return { bookingId, branchId };
}

describe("BookingsService authorization (characterization)", () => {
	let db: ReturnType<typeof createTestDb>;
	beforeEach(() => {
		db = createTestDb();
		vi.clearAllMocks();
	});

	it("get: rejects a different customer (403)", async () => {
		const { bookingId } = await seedBooking(db, "owner-1", "cust-1");
		await expect(
			makeService(db).get("cust-2", bookingId),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("listByBranch: rejects an owner who does not own the business (403)", async () => {
		const { branchId } = await seedBooking(db, "owner-1", "cust-1");
		await expect(
			makeService(db).listByBranch(branchId, null, "owner-2"),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("listByBranch: rejects a manager not assigned to the branch (403)", async () => {
		const { branchId } = await seedBooking(db, "owner-1", "cust-1");
		await expect(
			makeService(db).listByBranch(branchId, ["other-branch"], "mgr"),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("confirm: rejects an owner who does not own the business (403)", async () => {
		const { bookingId } = await seedBooking(db, "owner-1", "cust-1");
		await expect(
			makeService(db).confirm("owner-2", bookingId, null),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("confirm: rejects a manager not assigned to the branch (403)", async () => {
		const { bookingId } = await seedBooking(db, "owner-1", "cust-1");
		await expect(
			makeService(db).confirm("mgr", bookingId, ["other-branch"]),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("complete: rejects an owner who does not own the business (403)", async () => {
		const { bookingId } = await seedBooking(db, "owner-1", "cust-1");
		// Set to Confirmed first so the status guard doesn't fire before the auth guard
		const repo = new BookingsRepository(db as never);
		await repo.updateStatus(bookingId, "Confirmed");
		await expect(
			makeService(db).complete("owner-2", bookingId, null),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("cancel: rejects a different customer (403)", async () => {
		const { bookingId } = await seedBooking(db, "owner-1", "cust-1");
		await expect(
			makeService(db).cancel("cust-2", bookingId),
		).rejects.toBeInstanceOf(ForbiddenError);
	});
});
