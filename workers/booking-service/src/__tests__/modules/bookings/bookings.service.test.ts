import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	ConflictError,
	ForbiddenError,
	NotFoundError,
	ValidationError,
} from "../../../core/errors";
import { BookingsService } from "../../../modules/bookings/bookings.service";

const mockRepo = {
	findByUser: vi.fn(),
	findByBranch: vi.fn(),
	findByBranchInRange: vi.fn(),
	findOne: vi.fn(),
	create: vi.fn(),
	findConflict: vi.fn(),
	countOverlapping: vi.fn().mockResolvedValue(0),
	updateStatus: vi.fn(),
	assignStaff: vi.fn(),
};

const mockServicesRepo = {
	findOne: vi.fn(),
};

const mockBranchesRepo = {
	findOne: vi.fn(),
	findByBusiness: vi.fn(),
	findHoursForSlot: vi.fn().mockResolvedValue(null),
};

const mockCouponsService = {
	validate: vi.fn(),
	applyUsage: vi.fn(),
	findByCode: vi.fn(),
	findByCodeAndBusiness: vi.fn(),
	revertUsage: vi.fn(),
};

const mockQueue = {
	send: vi.fn(),
};

const fakeBooking = {
	id: "booking-1",
	userId: "user-1",
	serviceId: "svc-1",
	branchId: "branch-1",
	slot: "2026-06-01T11:00:00",
	status: "Pending" as const,
	price: 500,
	discount: 0,
	couponCode: null,
	createdAt: "2026-01-01T00:00:00Z",
	updatedAt: null,
};

const mockAuthz = {
	assertBranchAccess: vi.fn().mockResolvedValue(undefined),
	assertBusinessOwner: vi.fn().mockResolvedValue({ id: "business-1" }),
	assertBookingAccess: vi.fn().mockResolvedValue(fakeBooking),
	assertCustomerOwnsBooking: vi.fn().mockResolvedValue(fakeBooking),
} as never;

function makeService() {
	return new BookingsService(
		mockRepo as never,
		mockServicesRepo as never,
		mockBranchesRepo as never,
		mockCouponsService as never,
		mockQueue as never,
		mockAuthz,
	);
}

const fakeSvc = { id: "svc-1", branchId: "branch-1", price: 500, duration: 60 };
const fakeBranch = { id: "branch-1", businessId: "business-1" };

beforeEach(() => {
	vi.clearAllMocks();
	// Re-apply default implementations cleared by clearAllMocks
	(
		mockAuthz as never as { assertBranchAccess: ReturnType<typeof vi.fn> }
	).assertBranchAccess.mockResolvedValue(undefined);
	(
		mockAuthz as never as { assertBusinessOwner: ReturnType<typeof vi.fn> }
	).assertBusinessOwner.mockResolvedValue({ id: "business-1" });
	(
		mockAuthz as never as { assertBookingAccess: ReturnType<typeof vi.fn> }
	).assertBookingAccess.mockResolvedValue(fakeBooking);
	(
		mockAuthz as never as {
			assertCustomerOwnsBooking: ReturnType<typeof vi.fn>;
		}
	).assertCustomerOwnsBooking.mockResolvedValue(fakeBooking);
});

describe("BookingsService.listByUser", () => {
	it("delegates to repository", async () => {
		mockRepo.findByUser.mockResolvedValue([fakeBooking]);
		const svc = makeService();
		const result = await svc.listByUser("user-1");
		expect(result).toEqual([fakeBooking]);
	});
});

describe("BookingsService.listByBranch", () => {
	it("returns bookings for owner (null scoped) when they own the branch's business", async () => {
		mockRepo.findByBranch.mockResolvedValue([fakeBooking]);
		const svc = makeService();
		const result = await svc.listByBranch("branch-1", null, "owner-1");
		expect(result).toEqual([fakeBooking]);
	});

	it("throws ForbiddenError for owner when business is not theirs", async () => {
		(
			mockAuthz as never as { assertBranchAccess: ReturnType<typeof vi.fn> }
		).assertBranchAccess.mockRejectedValueOnce(
			new ForbiddenError("You do not own this business"),
		);
		const svc = makeService();
		await expect(svc.listByBranch("branch-1", null, "owner-1")).rejects.toThrow(
			ForbiddenError,
		);
	});

	it("throws ForbiddenError when branch not in scoped list", async () => {
		(
			mockAuthz as never as { assertBranchAccess: ReturnType<typeof vi.fn> }
		).assertBranchAccess.mockRejectedValueOnce(
			new ForbiddenError("You are not assigned to this branch"),
		);
		const svc = makeService();
		await expect(
			svc.listByBranch("branch-1", ["branch-2"], "mgr-1"),
		).rejects.toThrow(ForbiddenError);
	});
});

describe("BookingsService.get", () => {
	it("returns booking when user matches", async () => {
		const svc = makeService();
		const result = await svc.get("user-1", "booking-1");
		expect(result).toEqual(fakeBooking);
	});

	it("throws NotFoundError when not found", async () => {
		(
			mockAuthz as never as {
				assertCustomerOwnsBooking: ReturnType<typeof vi.fn>;
			}
		).assertCustomerOwnsBooking.mockRejectedValueOnce(
			new NotFoundError("Booking not found"),
		);
		const svc = makeService();
		await expect(svc.get("user-1", "missing")).rejects.toThrow(NotFoundError);
	});

	it("throws ForbiddenError when user does not own booking", async () => {
		(
			mockAuthz as never as {
				assertCustomerOwnsBooking: ReturnType<typeof vi.fn>;
			}
		).assertCustomerOwnsBooking.mockRejectedValueOnce(
			new ForbiddenError("You do not own this booking"),
		);
		const svc = makeService();
		await expect(svc.get("user-1", "booking-1")).rejects.toThrow(
			ForbiddenError,
		);
	});
});

describe("BookingsService.create", () => {
	it("creates booking without coupon", async () => {
		mockServicesRepo.findOne.mockResolvedValue({ data: fakeSvc });
		mockRepo.findConflict.mockResolvedValue(null);
		mockBranchesRepo.findOne.mockResolvedValue({ data: fakeBranch });
		mockRepo.create.mockResolvedValue({ data: fakeBooking });
		mockQueue.send.mockResolvedValue(undefined);

		const svc = makeService();
		const result = await svc.create("user-1", {
			serviceId: "svc-1",
			branchId: "branch-1",
			slot: "2026-06-01T11:00:00",
		});
		expect(result).toEqual(fakeBooking);
		expect(mockQueue.send).toHaveBeenCalledWith(
			expect.objectContaining({ type: "notification.booking_created" }),
		);
	});

	it("throws NotFoundError when service not found", async () => {
		mockServicesRepo.findOne.mockResolvedValue({ data: null });
		const svc = makeService();
		await expect(
			svc.create("user-1", {
				serviceId: "missing",
				branchId: "branch-1",
				slot: "2026-06-01T11:00:00",
			}),
		).rejects.toThrow(NotFoundError);
	});

	it("throws ValidationError when service is in wrong branch", async () => {
		mockServicesRepo.findOne.mockResolvedValue({
			data: { ...fakeSvc, branchId: "branch-99" },
		});
		const svc = makeService();
		await expect(
			svc.create("user-1", {
				serviceId: "svc-1",
				branchId: "branch-1",
				slot: "2026-06-01T11:00:00",
			}),
		).rejects.toThrow(ValidationError);
	});

	it("throws ValidationError for invalid slot format", async () => {
		mockServicesRepo.findOne.mockResolvedValue({ data: fakeSvc });
		const svc = makeService();
		await expect(
			svc.create("user-1", {
				serviceId: "svc-1",
				branchId: "branch-1",
				slot: "not-a-date",
			}),
		).rejects.toThrow(ValidationError);
	});

	it("throws ConflictError when slot is taken", async () => {
		mockServicesRepo.findOne.mockResolvedValue({ data: fakeSvc });
		mockRepo.findConflict.mockResolvedValue({ id: "existing-booking" });
		const svc = makeService();
		await expect(
			svc.create("user-1", {
				serviceId: "svc-1",
				branchId: "branch-1",
				slot: "2026-06-01T11:00:00",
			}),
		).rejects.toThrow(ConflictError);
	});

	it("applies coupon before creating booking", async () => {
		mockServicesRepo.findOne.mockResolvedValue({ data: fakeSvc });
		mockRepo.findConflict.mockResolvedValue(null);
		mockBranchesRepo.findOne.mockResolvedValue({ data: fakeBranch });
		mockCouponsService.validate.mockResolvedValue({
			couponId: "coupon-1",
			code: "SAVE10",
			discount: 50,
		});
		mockCouponsService.applyUsage.mockResolvedValue(undefined);
		mockRepo.create.mockResolvedValue({
			data: { ...fakeBooking, discount: 50 },
		});
		mockQueue.send.mockResolvedValue(undefined);

		const svc = makeService();
		const result = await svc.create("user-1", {
			serviceId: "svc-1",
			branchId: "branch-1",
			slot: "2026-06-01T11:00:00",
			couponCode: "SAVE10",
		});
		expect(result.discount).toBe(50);
		expect(mockCouponsService.applyUsage).toHaveBeenCalledWith("coupon-1");
		// applyUsage must fire before create so an exhausted coupon fails before the booking is written
		const applyOrder =
			mockCouponsService.applyUsage.mock.invocationCallOrder[0];
		const createOrder = mockRepo.create.mock.invocationCallOrder[0];
		expect(applyOrder).toBeLessThan(createOrder);
	});

	it("throws ConflictError when coupon is exhausted at booking time", async () => {
		mockServicesRepo.findOne.mockResolvedValue({ data: fakeSvc });
		mockRepo.findConflict.mockResolvedValue(null);
		mockBranchesRepo.findOne.mockResolvedValue({ data: fakeBranch });
		mockCouponsService.validate.mockResolvedValue({
			couponId: "coupon-1",
			code: "SAVE10",
			discount: 50,
		});
		mockCouponsService.applyUsage.mockRejectedValue(
			new ConflictError("Coupon is no longer available"),
		);

		const svc = makeService();
		await expect(
			svc.create("user-1", {
				serviceId: "svc-1",
				branchId: "branch-1",
				slot: "2026-06-01T11:00:00",
				couponCode: "SAVE10",
			}),
		).rejects.toThrow(ConflictError);
		expect(mockRepo.create).not.toHaveBeenCalled();
	});

	it("maps DB UNIQUE constraint error to ConflictError (slot race)", async () => {
		mockServicesRepo.findOne.mockResolvedValue({ data: fakeSvc });
		mockRepo.findConflict.mockResolvedValue(null);
		mockBranchesRepo.findOne.mockResolvedValue({ data: fakeBranch });
		mockRepo.create.mockRejectedValue(
			new Error(
				"UNIQUE constraint failed: bookings.branch_id, bookings.service_id, bookings.slot",
			),
		);
		mockQueue.send.mockResolvedValue(undefined);

		const svc = makeService();
		await expect(
			svc.create("user-1", {
				serviceId: "svc-1",
				branchId: "branch-1",
				slot: "2026-06-01T11:00:00",
			}),
		).rejects.toThrow(ConflictError);
	});

	it("reverts coupon usage when booking insert fails (slot race with coupon)", async () => {
		mockServicesRepo.findOne.mockResolvedValue({ data: fakeSvc });
		mockRepo.findConflict.mockResolvedValue(null);
		mockBranchesRepo.findOne.mockResolvedValue({ data: fakeBranch });
		mockCouponsService.validate.mockResolvedValue({
			couponId: "coupon-1",
			code: "SAVE10",
			discount: 50,
		});
		mockCouponsService.applyUsage.mockResolvedValue(undefined);
		mockRepo.create.mockRejectedValue(
			new Error(
				"UNIQUE constraint failed: bookings.branch_id, bookings.service_id, bookings.slot",
			),
		);
		mockCouponsService.revertUsage.mockResolvedValue(undefined);

		const svc = makeService();
		await expect(
			svc.create("user-1", {
				serviceId: "svc-1",
				branchId: "branch-1",
				slot: "2026-06-01T11:00:00",
				couponCode: "SAVE10",
			}),
		).rejects.toThrow(ConflictError);
		expect(mockCouponsService.revertUsage).toHaveBeenCalledWith("coupon-1");
	});
});

describe("BookingsService.confirm", () => {
	it("confirms pending booking for owner when they own the business", async () => {
		mockRepo.updateStatus.mockResolvedValue({
			data: { ...fakeBooking, status: "Confirmed" },
		});
		const svc = makeService();
		const result = await svc.confirm("owner-1", "booking-1", null);
		expect(result.status).toBe("Confirmed");
	});

	it("throws ForbiddenError when owner does not own the booking's business", async () => {
		(
			mockAuthz as never as { assertBookingAccess: ReturnType<typeof vi.fn> }
		).assertBookingAccess.mockRejectedValueOnce(
			new ForbiddenError("You do not own this business"),
		);
		const svc = makeService();
		await expect(svc.confirm("owner-1", "booking-1", null)).rejects.toThrow(
			ForbiddenError,
		);
	});

	it("throws ConflictError when booking is not Pending", async () => {
		(
			mockAuthz as never as { assertBookingAccess: ReturnType<typeof vi.fn> }
		).assertBookingAccess.mockResolvedValueOnce({
			...fakeBooking,
			status: "Confirmed",
		});
		const svc = makeService();
		await expect(svc.confirm("owner-1", "booking-1", null)).rejects.toThrow(
			ConflictError,
		);
	});
});

describe("BookingsService.cancel", () => {
	it("cancels booking and reverts coupon usage (scoped to business)", async () => {
		(
			mockAuthz as never as {
				assertCustomerOwnsBooking: ReturnType<typeof vi.fn>;
			}
		).assertCustomerOwnsBooking.mockResolvedValueOnce({
			...fakeBooking,
			couponCode: "SAVE10",
		});
		mockRepo.updateStatus.mockResolvedValue({
			data: { ...fakeBooking, status: "Cancelled" },
		});
		mockBranchesRepo.findOne.mockResolvedValue({ data: fakeBranch }); // fakeBranch has businessId: "business-1"
		mockCouponsService.findByCodeAndBusiness.mockResolvedValue({
			id: "coupon-1",
		});
		mockCouponsService.revertUsage.mockResolvedValue(undefined);
		mockQueue.send.mockResolvedValue(undefined);

		const svc = makeService();
		const result = await svc.cancel("user-1", "booking-1");
		expect(result.status).toBe("Cancelled");
		expect(mockCouponsService.findByCodeAndBusiness).toHaveBeenCalledWith(
			"SAVE10",
			"business-1",
		);
		expect(mockCouponsService.revertUsage).toHaveBeenCalledWith("coupon-1");
	});

	it("throws ConflictError when booking is already cancelled", async () => {
		(
			mockAuthz as never as {
				assertCustomerOwnsBooking: ReturnType<typeof vi.fn>;
			}
		).assertCustomerOwnsBooking.mockResolvedValueOnce({
			...fakeBooking,
			status: "Cancelled",
		});
		const svc = makeService();
		await expect(svc.cancel("user-1", "booking-1")).rejects.toThrow(
			ConflictError,
		);
	});

	it("throws ConflictError when booking is completed", async () => {
		(
			mockAuthz as never as {
				assertCustomerOwnsBooking: ReturnType<typeof vi.fn>;
			}
		).assertCustomerOwnsBooking.mockResolvedValueOnce({
			...fakeBooking,
			status: "Completed",
		});
		const svc = makeService();
		await expect(svc.cancel("user-1", "booking-1")).rejects.toThrow(
			ConflictError,
		);
	});
});

describe("BookingsService.listByBusiness", () => {
	it("fans out across business branches and returns paginated envelope", async () => {
		mockBranchesRepo.findByBusiness.mockResolvedValue([
			{ id: "branch-1" },
			{ id: "branch-2" },
		]);
		mockRepo.findByBranch
			.mockResolvedValueOnce([fakeBooking])
			.mockResolvedValueOnce([]);
		const svc = makeService();
		const result = await svc.listByBusiness("owner-1", "business-1", null);
		expect(result.data).toHaveLength(1);
		expect(result.query.total).toBe(1);
		expect(mockAuthz.assertBusinessOwner).toHaveBeenCalledWith(
			"owner-1",
			"business-1",
		);
	});

	it("filters by status when provided", async () => {
		mockBranchesRepo.findByBusiness.mockResolvedValue([{ id: "branch-1" }]);
		mockRepo.findByBranch.mockResolvedValue([
			{ ...fakeBooking, status: "Pending" },
			{ ...fakeBooking, id: "booking-2", status: "Cancelled" },
		]);
		const svc = makeService();
		const result = await svc.listByBusiness("owner-1", "business-1", null, {
			status: "Pending",
		});
		expect(result.data).toHaveLength(1);
		expect(result.data[0].status).toBe("Pending");
	});
});

describe("BookingsService.exportCsv", () => {
	it("returns RFC 4180 CSV with filename", async () => {
		mockBranchesRepo.findByBusiness.mockResolvedValue([{ id: "branch-1" }]);
		mockRepo.findByBranch.mockResolvedValue([fakeBooking]);
		const svc = makeService();
		const result = await svc.exportCsv(
			"owner-1",
			"business-1",
			undefined,
			null,
		);
		expect(result.filename).toBe("bookings-business-1.csv");
		expect(result.csv).toContain("id,userId,serviceId");
		expect(result.csv).toContain("booking-1");
	});
});

describe("BookingsService.calendar", () => {
	it("asserts branch access then calls findByBranchInRange", async () => {
		mockRepo.findByBranchInRange.mockResolvedValue([fakeBooking]);
		const svc = makeService();
		const result = await svc.calendar(
			"owner-1",
			"branch-1",
			"2026-06-01",
			"2026-06-07",
			null,
		);
		expect(result).toEqual([fakeBooking]);
		expect(mockAuthz.assertBranchAccess).toHaveBeenCalledWith(
			"owner-1",
			"branch-1",
			null,
		);
		expect(mockRepo.findByBranchInRange).toHaveBeenCalledWith(
			"branch-1",
			"2026-06-01",
			"2026-06-07",
		);
	});
});
