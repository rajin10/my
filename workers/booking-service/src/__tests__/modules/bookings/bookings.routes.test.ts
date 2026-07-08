import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	ConflictError,
	ForbiddenError,
	NotFoundError,
} from "../../../core/errors";
import { authHeader, createTestToken, TEST_ENV } from "../../helpers/auth";
import { createTestApp } from "../../helpers/create-test-app";

const mockBookingsService = {
	listByUser: vi.fn(),
	listByBranch: vi.fn(),
	listByBusiness: vi.fn(),
	exportCsv: vi.fn(),
	calendar: vi.fn(),
	get: vi.fn(),
	create: vi.fn(),
	confirm: vi.fn(),
	complete: vi.fn(),
	cancel: vi.fn(),
};

const app = createTestApp({
	bookingsService: mockBookingsService as never,
});

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
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: null,
};

beforeEach(() => {
	vi.resetAllMocks();
	mockBookingsService.exportCsv.mockResolvedValue({
		csv: "id,userId,serviceId,branchId,slot,status,price,discount,couponCode,createdAt\n",
		filename: "bookings-biz-1.csv",
	});
	mockBookingsService.calendar.mockResolvedValue([]);
});

describe("GET /api/v1/bookings", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request("/api/v1/bookings", {}, TEST_ENV);
		expect(res.status).toBe(401);
	});

	it("returns 200 with user's bookings", async () => {
		mockBookingsService.listByUser.mockResolvedValue([fakeBooking]);
		const token = await createTestToken({ userId: "user-1" });
		const res = await app.request(
			"/api/v1/bookings",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			data: unknown[];
			query: { total: number };
		};
		expect(body.data).toHaveLength(1);
		expect(body.query.total).toBe(1);
	});
});

describe("GET /api/v1/bookings/:id", () => {
	it("returns 200 with booking", async () => {
		mockBookingsService.get.mockResolvedValue(fakeBooking);
		const token = await createTestToken({ userId: "user-1" });
		const res = await app.request(
			"/api/v1/bookings/booking-1",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { id: string } };
		expect(body.data.id).toBe("booking-1");
	});

	it("returns 403 when user does not own booking", async () => {
		mockBookingsService.get.mockRejectedValue(new ForbiddenError());
		const token = await createTestToken({ userId: "other-user" });
		const res = await app.request(
			"/api/v1/bookings/booking-1",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("returns 404 when not found", async () => {
		mockBookingsService.get.mockRejectedValue(
			new NotFoundError("Booking not found"),
		);
		const token = await createTestToken({ userId: "user-1" });
		const res = await app.request(
			"/api/v1/bookings/missing",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(404);
	});
});

describe("POST /api/v1/bookings", () => {
	it("returns 201 on successful creation", async () => {
		mockBookingsService.create.mockResolvedValue(fakeBooking);
		const token = await createTestToken({ userId: "user-1" });
		const res = await app.request(
			"/api/v1/bookings",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({
					serviceId: "svc-1",
					branchId: "branch-1",
					slot: "2026-06-01T11:00:00",
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(201);
		const body = (await res.json()) as { data: { id: string } };
		expect(body.data.id).toBe("booking-1");
	});

	it("returns 409 when slot is unavailable", async () => {
		mockBookingsService.create.mockRejectedValue(
			new ConflictError("This slot is no longer available"),
		);
		const token = await createTestToken({ userId: "user-1" });
		const res = await app.request(
			"/api/v1/bookings",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({
					serviceId: "svc-1",
					branchId: "branch-1",
					slot: "2026-06-01T11:00:00",
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(409);
	});
});

describe("PATCH /api/v1/bookings/:id/cancel", () => {
	it("returns 200 on cancel", async () => {
		mockBookingsService.cancel.mockResolvedValue({
			...fakeBooking,
			status: "Cancelled",
		});
		const token = await createTestToken({ userId: "user-1" });
		const res = await app.request(
			"/api/v1/bookings/booking-1/cancel",
			{ method: "PATCH", headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { status: string } };
		expect(body.data.status).toBe("Cancelled");
	});

	it("returns 409 when already cancelled", async () => {
		mockBookingsService.cancel.mockRejectedValue(
			new ConflictError("Booking is already cancelled"),
		);
		const token = await createTestToken({ userId: "user-1" });
		const res = await app.request(
			"/api/v1/bookings/booking-1/cancel",
			{ method: "PATCH", headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(409);
	});
});

describe("PATCH /api/v1/bookings/:id/confirm (staff)", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request(
			"/api/v1/bookings/booking-1/confirm",
			{ method: "PATCH" },
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 403 for customer role", async () => {
		const token = await createTestToken({ role: "customer" });
		const res = await app.request(
			"/api/v1/bookings/booking-1/confirm",
			{ method: "PATCH", headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("returns 200 for owner", async () => {
		mockBookingsService.confirm.mockResolvedValue({
			...fakeBooking,
			status: "Confirmed",
		});
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/bookings/booking-1/confirm",
			{ method: "PATCH", headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { status: string } };
		expect(body.data.status).toBe("Confirmed");
	});
});

describe("GET /api/v1/bookings/branch (staff)", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request(
			"/api/v1/bookings/branch?branchId=branch-1",
			{},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 403 for customer role", async () => {
		const token = await createTestToken({ role: "customer" });
		const res = await app.request(
			"/api/v1/bookings/branch?branchId=branch-1",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("returns 200 for owner", async () => {
		mockBookingsService.listByBranch.mockResolvedValue([fakeBooking]);
		mockBookingsService.get.mockResolvedValue(fakeBooking);
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/bookings/branch?branchId=branch-1",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			data: unknown[];
			query: { total: number };
		};
		expect(body.data).toHaveLength(1);
		expect(body.query.total).toBe(1);
		expect(mockBookingsService.listByBranch).toHaveBeenCalled();
		expect(mockBookingsService.get).not.toHaveBeenCalled();
	});
});

describe("GET /api/v1/bookings/calendar (staff)", () => {
	it("returns 403 for customer role", async () => {
		const token = await createTestToken({ role: "customer" });
		const res = await app.request(
			"/api/v1/bookings/calendar?branchId=branch-1&start=2026-06-01&end=2026-06-07",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("runs the calendar handler, not the customer /:id handler", async () => {
		mockBookingsService.get.mockResolvedValue(fakeBooking);
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/bookings/calendar?branchId=branch-1&start=2026-06-01&end=2026-06-07",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		expect(Array.isArray(await res.json())).toBe(true);
		expect(mockBookingsService.get).not.toHaveBeenCalled();
		expect(mockBookingsService.calendar).toHaveBeenCalled();
	});
});

describe("GET /api/v1/bookings/export (owner/manager)", () => {
	it("returns 403 for customer role", async () => {
		const token = await createTestToken({ role: "customer" });
		const res = await app.request(
			"/api/v1/bookings/export?businessId=biz-1",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("runs the export handler (CSV), not the customer /:id handler", async () => {
		mockBookingsService.get.mockResolvedValue(fakeBooking);
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/bookings/export?businessId=biz-1",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/csv");
		expect(mockBookingsService.get).not.toHaveBeenCalled();
		expect(mockBookingsService.exportCsv).toHaveBeenCalled();
	});
});
