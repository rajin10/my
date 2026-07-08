import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError } from "../../../core/errors";
import { authHeader, createTestToken, TEST_ENV } from "../../helpers/auth";
import { createTestApp } from "../../helpers/create-test-app";

const mockBusinessesService = {
	list: vi.fn(),
	get: vi.fn(),
	create: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
	uploadPhoto: vi.fn(),
	listPhotos: vi.fn(),
};

const app = createTestApp({
	businessesService: mockBusinessesService as never,
});

const fakeBusiness = {
	id: "business-1",
	name: "Test Business",
	ownerId: "owner-1",
	category: "Beauty",
	city: "Dhaka",
	vertical: "booking",
	status: "Active",
	description: null,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: null,
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("GET /api/v1/businesses", () => {
	it("returns 200 with list", async () => {
		mockBusinessesService.list.mockResolvedValue({
			data: [fakeBusiness],
			query: {
				total: 1,
				page: 1,
				limit: 10,
				totalPages: 1,
				hasNextPage: false,
				hasPrevPage: false,
			},
		});
		const res = await app.request("/api/v1/businesses", {}, TEST_ENV);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, any>;
		expect(body.data[0].id).toBe("business-1");
	});

	it("passes a cursor query param through and surfaces nextCursor", async () => {
		mockBusinessesService.list.mockResolvedValue({
			data: [fakeBusiness],
			query: {
				page: 1,
				limit: 10,
				total: 0,
				totalPages: 0,
				hasNextPage: true,
				hasPrevPage: false,
				mode: "cursor",
				nextCursor: "abc123",
			},
		});

		const res = await app.request(
			"/api/v1/businesses?cursor=abc123&limit=10",
			{},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			query: { mode: string; nextCursor: string };
		};
		expect(body.query.mode).toBe("cursor");
		expect(body.query.nextCursor).toBe("abc123");
		expect(mockBusinessesService.list).toHaveBeenCalledWith(
			expect.objectContaining({ cursor: "abc123" }),
		);
	});
});

describe("GET /api/v1/businesses/:id", () => {
	it("returns 200 with the business in a data envelope", async () => {
		mockBusinessesService.get.mockResolvedValue(fakeBusiness);
		const res = await app.request(
			"/api/v1/businesses/business-1",
			{},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { id: string } };
		expect(body.data.id).toBe("business-1");
	});

	it("returns 404 when not found", async () => {
		mockBusinessesService.get.mockRejectedValue(
			new NotFoundError("Business not found"),
		);
		const res = await app.request("/api/v1/businesses/missing", {}, TEST_ENV);
		expect(res.status).toBe(404);
	});

	it("surfaces the brand palette on the public read", async () => {
		const palette = {
			primary: "#5B2A86",
			accent: "#C9A063",
			foreground: "#1A1320",
			surface: "#FDFBFF",
		};
		mockBusinessesService.get.mockResolvedValue({
			...fakeBusiness,
			brandPalette: palette,
		});
		const res = await app.request(
			"/api/v1/businesses/business-1",
			{},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { brandPalette: unknown } };
		expect(body.data.brandPalette).toEqual(palette);
	});
});

describe("GET /api/v1/businesses/:id/photos", () => {
	it("returns 200 with photo list", async () => {
		mockBusinessesService.listPhotos.mockResolvedValue([
			{
				id: "photo-1",
				businessId: "business-1",
				url: "https://cdn.example/1.jpg",
				order: 0,
			},
		]);
		const res = await app.request(
			"/api/v1/businesses/business-1/photos",
			{},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as unknown[];
		expect(body).toHaveLength(1);
		expect((body[0] as { url: string }).url).toContain("cdn.example");
	});

	it("returns 404 when business not found", async () => {
		mockBusinessesService.listPhotos.mockRejectedValue(
			new NotFoundError("Business not found"),
		);
		const res = await app.request(
			"/api/v1/businesses/missing/photos",
			{},
			TEST_ENV,
		);
		expect(res.status).toBe(404);
	});
});

describe("POST /api/v1/businesses", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request(
			"/api/v1/businesses",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Test",
					category: "Beauty",
					city: "Dhaka",
					status: "Active",
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 403 for non-owner role", async () => {
		const token = await createTestToken({ role: "customer" });
		const res = await app.request(
			"/api/v1/businesses",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({
					name: "Test",
					category: "Beauty",
					city: "Dhaka",
					status: "Active",
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("returns 201 for owner", async () => {
		mockBusinessesService.create.mockResolvedValue(fakeBusiness);
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/businesses",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({
					name: "Test Business",
					category: "Beauty",
					city: "Dhaka",
					vertical: "booking",
					status: "Active",
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(201);
		const body = (await res.json()) as { data: { id: string } };
		expect(body.data.id).toBe("business-1");
	});

	it("returns 422 when vertical is missing (no silent default)", async () => {
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/businesses",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				// `vertical` is intentionally omitted — it must be required.
				body: JSON.stringify({
					name: "Test Business",
					category: "Beauty",
					city: "Dhaka",
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(422);
		expect(mockBusinessesService.create).not.toHaveBeenCalled();
	});
});

describe("PATCH /api/v1/businesses/:id", () => {
	it("returns 403 when owner does not match", async () => {
		mockBusinessesService.update.mockRejectedValue(
			new ForbiddenError("You do not own this business"),
		);
		const token = await createTestToken({
			role: "owner",
			userId: "other-owner",
		});
		const res = await app.request(
			"/api/v1/businesses/business-1",
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ name: "Updated" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("returns 200 on successful update", async () => {
		mockBusinessesService.update.mockResolvedValue({
			...fakeBusiness,
			name: "Updated",
		});
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/businesses/business-1",
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ name: "Updated" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
	});

	it("strips an attempted vertical change before it reaches the service (immutable)", async () => {
		mockBusinessesService.update.mockResolvedValue(fakeBusiness);
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/businesses/business-1",
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ name: "Updated", vertical: "commerce" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		// The update body schema omits `vertical`, so it never reaches the service.
		const passed = mockBusinessesService.update.mock.calls[0]?.[2] as Record<
			string,
			unknown
		>;
		expect(passed).not.toHaveProperty("vertical");
	});

	it("persists a valid brand palette through to the service", async () => {
		const palette = {
			primary: "#5B2A86",
			accent: "#C9A063",
			foreground: "#1A1320",
			surface: "#FDFBFF",
		};
		mockBusinessesService.update.mockResolvedValue({
			...fakeBusiness,
			brandPalette: palette,
		});
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/businesses/business-1",
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ brandPalette: palette }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const passed = mockBusinessesService.update.mock.calls[0]?.[2] as Record<
			string,
			unknown
		>;
		expect(passed.brandPalette).toEqual(palette);
		const body = (await res.json()) as { data: { brandPalette: unknown } };
		expect(body.data.brandPalette).toEqual(palette);
	});

	it("accepts brandPalette: null to clear a palette (revert to defaults)", async () => {
		mockBusinessesService.update.mockResolvedValue({
			...fakeBusiness,
			brandPalette: null,
		});
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/businesses/business-1",
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ brandPalette: null }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const passed = mockBusinessesService.update.mock.calls[0]?.[2] as Record<
			string,
			unknown
		>;
		expect(passed.brandPalette).toBeNull();
	});

	it("returns 422 for a malformed palette color before reaching the service", async () => {
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/businesses/business-1",
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				// `primary` is not a valid 6-digit hex color.
				body: JSON.stringify({
					brandPalette: {
						primary: "purple",
						accent: "#C9A063",
						foreground: "#1A1320",
						surface: "#FDFBFF",
					},
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(422);
		expect(mockBusinessesService.update).not.toHaveBeenCalled();
	});
});

describe("DELETE /api/v1/businesses/:id", () => {
	it("returns 200 on successful delete", async () => {
		mockBusinessesService.delete.mockResolvedValue(fakeBusiness);
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/businesses/business-1",
			{ method: "DELETE", headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { id: string } };
		expect(body.data.id).toBe("business-1");
	});
});

describe("POST /api/v1/businesses — validation error shape", () => {
	it("returns 422 with { ok: false, code: VALIDATION_ERROR, message } for invalid body", async () => {
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/businesses",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...authHeader(token),
				},
				// name is required and must be min(1); sending empty string triggers validation
				body: JSON.stringify({ name: "", category: "Beauty", city: "Dhaka" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(422);
		const body = (await res.json()) as {
			ok: boolean;
			code: string;
			message: string;
		};
		expect(body.ok).toBe(false);
		expect(body.code).toBe("VALIDATION_ERROR");
		expect(typeof body.message).toBe("string");
		expect(body.message.length).toBeGreaterThan(0);
	});
});
