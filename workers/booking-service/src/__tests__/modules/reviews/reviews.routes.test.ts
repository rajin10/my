import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError } from "../../../core/errors";
import { authHeader, createTestToken, TEST_ENV } from "../../helpers/auth";
import { createTestApp } from "../../helpers/create-test-app";

const mockReviewsService = {
	listPublished: vi.fn(),
	listPending: vi.fn(),
	listMine: vi.fn(),
	submit: vi.fn(),
	approve: vi.fn(),
	reject: vi.fn(),
};

const app = createTestApp({ reviewsService: mockReviewsService as never });

const fakeReview = {
	id: "review-1",
	userId: "user-1",
	businessId: "business-1",
	serviceId: "svc-1",
	bookingId: null,
	rating: 5,
	text: "Great!",
	status: "Pending" as const,
	userName: "Test User",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: null,
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("GET /api/v1/reviews (public)", () => {
	it("returns 200 with published reviews", async () => {
		mockReviewsService.listPublished.mockResolvedValue([
			{ ...fakeReview, status: "Published" },
		]);
		const res = await app.request(
			"/api/v1/reviews?businessId=business-1",
			{},
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

	it("returns 422 when businessId is missing", async () => {
		const res = await app.request("/api/v1/reviews", {}, TEST_ENV);
		expect(res.status).toBe(422);
	});
});

describe("POST /api/v1/reviews (authenticated)", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request(
			"/api/v1/reviews",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					businessId: "business-1",
					serviceId: "svc-1",
					rating: 5,
					text: "Great!",
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 201 on success", async () => {
		mockReviewsService.submit.mockResolvedValue(fakeReview);
		const token = await createTestToken({ userId: "user-1" });
		const res = await app.request(
			"/api/v1/reviews",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({
					businessId: "business-1",
					serviceId: "svc-1",
					bookingId: "booking-1",
					rating: 5,
					text: "Great!",
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(201);
		const body = (await res.json()) as { data: { id: string } };
		expect(body.data.id).toBe("review-1");
	});
});

describe("GET /api/v1/reviews/pending (owner only)", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request(
			"/api/v1/reviews/pending?businessId=business-1",
			{},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 403 for non-owner", async () => {
		const token = await createTestToken({ role: "customer" });
		const res = await app.request(
			"/api/v1/reviews/pending?businessId=business-1",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("returns 200 for owner", async () => {
		mockReviewsService.listPending.mockResolvedValue([fakeReview]);
		const token = await createTestToken({ role: "owner" });
		const res = await app.request(
			"/api/v1/reviews/pending?businessId=business-1",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
	});
});

describe("PATCH /api/v1/reviews/:id/approve (owner only)", () => {
	it("returns 200 on approve", async () => {
		mockReviewsService.approve.mockResolvedValue({
			...fakeReview,
			status: "Published",
		});
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/reviews/review-1/approve",
			{ method: "PATCH", headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { status: string } };
		expect(body.data.status).toBe("Published");
	});

	it("returns 403 when owner does not match", async () => {
		mockReviewsService.approve.mockRejectedValue(
			new ForbiddenError("You do not own this business"),
		);
		const token = await createTestToken({
			role: "owner",
			userId: "other-owner",
		});
		const res = await app.request(
			"/api/v1/reviews/review-1/approve",
			{ method: "PATCH", headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});
});

describe("PATCH /api/v1/reviews/:id/reject (owner only)", () => {
	it("returns 200 on reject", async () => {
		mockReviewsService.reject.mockResolvedValue(fakeReview);
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/reviews/review-1/reject",
			{ method: "PATCH", headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { id: string } };
		expect(body.data.id).toBe("review-1");
	});

	it("returns 404 when not found", async () => {
		mockReviewsService.reject.mockRejectedValue(
			new NotFoundError("Review not found"),
		);
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/reviews/missing/reject",
			{ method: "PATCH", headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(404);
	});
});

describe("GET /api/v1/reviews/mine (authenticated)", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request("/api/v1/reviews/mine", {}, TEST_ENV);
		expect(res.status).toBe(401);
	});

	it("returns 200 with the caller's reviews", async () => {
		mockReviewsService.listMine.mockResolvedValue([
			{
				id: "review-1",
				userId: "user-1",
				businessId: "business-1",
				serviceId: "svc-1",
				bookingId: "b1",
				rating: 5,
				text: "Great!",
				status: "Published",
				businessName: "Glow Spa",
				serviceName: "Facial",
				createdAt: "2026-01-01T00:00:00.000Z",
				updatedAt: null,
			},
		]);
		const token = await createTestToken({ userId: "user-1" });
		const res = await app.request(
			"/api/v1/reviews/mine",
			{ headers: { ...authHeader(token) } },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Array<Record<string, unknown>>;
		expect(body).toHaveLength(1);
		expect(body[0].businessName).toBe("Glow Spa");
		expect(mockReviewsService.listMine).toHaveBeenCalledWith("user-1");
	});
});
