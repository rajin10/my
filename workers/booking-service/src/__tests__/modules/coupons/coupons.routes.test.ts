import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError, ValidationError } from "../../../core/errors";
import { authHeader, createTestToken, TEST_ENV } from "../../helpers/auth";
import { createTestApp } from "../../helpers/create-test-app";

const mockCouponsService = {
	listByBusiness: vi.fn(),
	get: vi.fn(),
	create: vi.fn(),
	delete: vi.fn(),
	validate: vi.fn(),
};

const app = createTestApp({ couponsService: mockCouponsService as never });

const fakeCoupon = {
	id: "coupon-1",
	businessId: "business-1",
	code: "SAVE10",
	type: "Percentage" as const,
	value: 10,
	usedCount: 0,
	maxUses: 100,
	status: "Active" as const,
	expiresAt: "2027-01-01T00:00:00.000Z",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: null,
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("POST /api/v1/coupons/validate (public)", () => {
	it("returns 200 with discount", async () => {
		mockCouponsService.validate.mockResolvedValue({
			couponId: "coupon-1",
			code: "SAVE10",
			discount: 100,
		});
		const res = await app.request(
			"/api/v1/coupons/validate",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					code: "SAVE10",
					businessId: "business-1",
					price: 1000,
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.discount).toBe(100);
	});

	it("returns 422 for invalid coupon", async () => {
		mockCouponsService.validate.mockRejectedValue(
			new ValidationError("Invalid or expired coupon code"),
		);
		const res = await app.request(
			"/api/v1/coupons/validate",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					code: "BAD",
					businessId: "business-1",
					price: 1000,
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(422);
	});
});

describe("GET /api/v1/coupons (owner only)", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request("/api/v1/coupons", {}, TEST_ENV);
		expect(res.status).toBe(401);
	});

	it("returns 403 for non-owner", async () => {
		const token = await createTestToken({ role: "customer" });
		const res = await app.request(
			"/api/v1/coupons",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("returns 200 for owner", async () => {
		mockCouponsService.listByBusiness.mockResolvedValue({
			data: [fakeCoupon],
			query: {
				total: 1,
				page: 1,
				limit: 10,
				totalPages: 1,
				hasNextPage: false,
				hasPrevPage: false,
			},
		});
		const token = await createTestToken({ role: "owner" });
		const res = await app.request(
			"/api/v1/coupons?businessId=business-1",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
	});
});

describe("GET /api/v1/coupons/:id", () => {
	it("returns 200 for owner", async () => {
		mockCouponsService.get.mockResolvedValue(fakeCoupon);
		const token = await createTestToken({ role: "owner" });
		const res = await app.request(
			"/api/v1/coupons/coupon-1",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { id: string } };
		expect(body.data.id).toBe("coupon-1");
	});

	it("returns 404 when not found", async () => {
		mockCouponsService.get.mockRejectedValue(
			new NotFoundError("Coupon not found"),
		);
		const token = await createTestToken({ role: "owner" });
		const res = await app.request(
			"/api/v1/coupons/missing",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(404);
	});
});

describe("POST /api/v1/coupons (owner only)", () => {
	it("returns 201 on creation", async () => {
		mockCouponsService.create.mockResolvedValue(fakeCoupon);
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/coupons",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({
					businessId: "business-1",
					code: "SAVE10",
					type: "Percentage",
					value: 10,
					maxUses: 100,
					expiresAt: "2027-01-01T00:00:00",
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(201);
		const body = (await res.json()) as { data: { id: string } };
		expect(body.data.id).toBe("coupon-1");
	});
});

describe("DELETE /api/v1/coupons/:id", () => {
	it("returns 200 on delete", async () => {
		mockCouponsService.delete.mockResolvedValue(fakeCoupon);
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/coupons/coupon-1",
			{ method: "DELETE", headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { id: string } };
		expect(body.data.id).toBe("coupon-1");
	});
});
