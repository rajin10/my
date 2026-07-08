import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError } from "../../../core/errors";
import { authHeader, createTestToken, TEST_ENV } from "../../helpers/auth";
import { createTestApp } from "../../helpers/create-test-app";

const fakeFav = {
	id: "fav-1",
	userId: "user-1",
	businessId: "business-1",
	createdAt: "2026-01-01T00:00:00.000Z",
};

const mockFavouritesService = {
	list: vi.fn().mockResolvedValue([fakeFav]),
	check: vi.fn().mockResolvedValue({ isFavourited: false }),
	add: vi.fn().mockResolvedValue(fakeFav),
	remove: vi.fn().mockResolvedValue(undefined),
};

const app = createTestApp({
	favouritesService: mockFavouritesService as never,
});

beforeEach(() => {
	vi.resetAllMocks();
	mockFavouritesService.list.mockResolvedValue([fakeFav]);
	mockFavouritesService.check.mockResolvedValue({ isFavourited: false });
	mockFavouritesService.add.mockResolvedValue(fakeFav);
	mockFavouritesService.remove.mockResolvedValue(undefined);
});

describe("GET /api/v1/favourites", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request("/api/v1/favourites", {}, TEST_ENV);
		expect(res.status).toBe(401);
	});

	it("returns 200 with list of favourites", async () => {
		const token = await createTestToken();
		const res = await app.request(
			"/api/v1/favourites",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as unknown[];
		expect(body).toHaveLength(1);
	});
});

describe("GET /api/v1/favourites/:businessId", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request(
			"/api/v1/favourites/business-1",
			{},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns { isFavourited: false } when not saved", async () => {
		const token = await createTestToken();
		const res = await app.request(
			"/api/v1/favourites/business-1",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { isFavourited: boolean };
		expect(body.isFavourited).toBe(false);
	});

	it("returns { isFavourited: true } when saved", async () => {
		mockFavouritesService.check.mockResolvedValue({ isFavourited: true });
		const token = await createTestToken();
		const res = await app.request(
			"/api/v1/favourites/business-1",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { isFavourited: boolean };
		expect(body.isFavourited).toBe(true);
	});
});

describe("POST /api/v1/favourites/:businessId", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request(
			"/api/v1/favourites/business-1",
			{ method: "POST" },
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 201 when added successfully", async () => {
		const token = await createTestToken();
		const res = await app.request(
			"/api/v1/favourites/business-1",
			{ method: "POST", headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(201);
		const body = (await res.json()) as typeof fakeFav;
		expect(body.businessId).toBe("business-1");
	});

	it("returns 409 when already favourited", async () => {
		mockFavouritesService.add.mockRejectedValue(
			new ConflictError("Already favourited"),
		);
		const token = await createTestToken();
		const res = await app.request(
			"/api/v1/favourites/business-1",
			{ method: "POST", headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(409);
	});
});

describe("DELETE /api/v1/favourites/:businessId", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request(
			"/api/v1/favourites/business-1",
			{ method: "DELETE" },
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 204 when removed", async () => {
		const token = await createTestToken();
		const res = await app.request(
			"/api/v1/favourites/business-1",
			{ method: "DELETE", headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(204);
	});

	it("returns 404 when not in favourites", async () => {
		mockFavouritesService.remove.mockRejectedValue(
			new NotFoundError("Not in favourites"),
		);
		const token = await createTestToken();
		const res = await app.request(
			"/api/v1/favourites/business-99",
			{ method: "DELETE", headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(404);
	});
});
