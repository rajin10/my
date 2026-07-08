import { beforeEach, describe, expect, it, vi } from "vitest";
import { authHeader, createTestToken, TEST_ENV } from "../../helpers/auth";
import { createTestApp } from "../../helpers/create-test-app";

const mockAnalyticsService = {
	overview: vi.fn().mockResolvedValue({
		totalRevenue: 0,
		totalBookings: 0,
		avgBookingValue: 0,
		completedBookings: 0,
		pendingBookings: 0,
		cancelledBookings: 0,
		newCustomers: 0,
		returningCustomers: 0,
	}),
	revenue: vi.fn().mockResolvedValue([]),
	topServices: vi.fn().mockResolvedValue([]),
	peakHours: vi.fn().mockResolvedValue([]),
	reviewStats: vi.fn().mockResolvedValue({}),
	couponStats: vi.fn().mockResolvedValue({}),
	staffStats: vi.fn().mockResolvedValue([]),
	earnings: vi.fn().mockResolvedValue({
		total: 0,
		byStaff: [],
		byService: [],
		byBranch: [],
		overTime: [],
	}),
};

const app = createTestApp({ analyticsService: mockAnalyticsService as never });

beforeEach(() => {
	vi.resetAllMocks();
	mockAnalyticsService.overview.mockResolvedValue({
		totalRevenue: 0,
		totalBookings: 0,
		avgBookingValue: 0,
		completedBookings: 0,
		pendingBookings: 0,
		cancelledBookings: 0,
		newCustomers: 0,
		returningCustomers: 0,
	});
	mockAnalyticsService.revenue.mockResolvedValue([]);
	mockAnalyticsService.topServices.mockResolvedValue([]);
	mockAnalyticsService.peakHours.mockResolvedValue([]);
	mockAnalyticsService.earnings.mockResolvedValue({
		total: 0,
		byStaff: [],
		byService: [],
		byBranch: [],
		overTime: [],
	});
});

describe("GET /api/v1/analytics/overview (owner only)", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request(
			"/api/v1/analytics/overview?businessId=business-1&range=30",
			{},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 403 for non-owner role", async () => {
		const token = await createTestToken({ role: "customer" });
		const res = await app.request(
			"/api/v1/analytics/overview?businessId=business-1&range=30",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("returns 403 for manager role (owner-only gate)", async () => {
		const token = await createTestToken({ role: "manager", userId: "mgr-1" });
		const res = await app.request(
			"/api/v1/analytics/overview?businessId=business-1&range=30",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("returns 200 for owner", async () => {
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/analytics/overview?businessId=business-1&range=30",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
	});
});

describe("GET /api/v1/analytics/revenue", () => {
	it("returns 200 for owner", async () => {
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/analytics/revenue?businessId=business-1&range=30",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
	});
});

describe("GET /api/v1/analytics/services", () => {
	it("returns 200 for owner", async () => {
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/analytics/services?businessId=business-1&range=30",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
	});
});

describe("GET /api/v1/analytics/peak", () => {
	it("returns 200 for owner", async () => {
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/analytics/peak?businessId=business-1&range=30",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
	});
});

describe("GET /api/v1/analytics/earnings", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request(
			"/api/v1/analytics/earnings?businessId=business-1&range=30",
			{},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 403 for non-owner role", async () => {
		const token = await createTestToken({ role: "customer" });
		const res = await app.request(
			"/api/v1/analytics/earnings?businessId=business-1&range=30",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("returns 200 for owner", async () => {
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/analytics/earnings?businessId=business-1&range=30",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
	});
});
