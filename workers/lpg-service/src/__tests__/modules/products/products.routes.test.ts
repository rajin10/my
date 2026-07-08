import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError } from "../../../core/errors";
import { authHeader, createTestToken, TEST_ENV } from "../../helpers/auth";
import { createTestApp } from "../../helpers/create-test-app";

const mockProductsService = {
	listByBranch: vi.fn(),
	get: vi.fn(),
	create: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
	uploadPhoto: vi.fn(),
	deletePhoto: vi.fn(),
};

const app = createTestApp({ productsService: mockProductsService as never });

const fakeProduct = {
	id: "product-1",
	branchId: "branch-1",
	name: "12kg LPG Cylinder",
	category: "Cylinder",
	price: 1200,
	stock: 10,
	description: null,
	imageUrl: null,
	status: "Active" as const,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: null,
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("GET /api/v1/products (public)", () => {
	it("returns 200 with the branch's products", async () => {
		mockProductsService.listByBranch.mockResolvedValue([fakeProduct]);
		const res = await app.request(
			"/api/v1/products?branchId=branch-1",
			{},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as unknown[];
		expect(body).toHaveLength(1);
		expect(mockProductsService.listByBranch).toHaveBeenCalledWith("branch-1");
	});

	it("returns 422 when branchId is missing", async () => {
		const res = await app.request("/api/v1/products", {}, TEST_ENV);
		expect(res.status).toBe(422);
	});
});

describe("GET /api/v1/products/:id (public)", () => {
	it("returns 200 for an existing product", async () => {
		mockProductsService.get.mockResolvedValue(fakeProduct);
		const res = await app.request("/api/v1/products/product-1", {}, TEST_ENV);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { id: string } };
		expect(body.data.id).toBe("product-1");
	});

	it("returns 404 when not found", async () => {
		mockProductsService.get.mockRejectedValue(
			new NotFoundError("Product not found"),
		);
		const res = await app.request("/api/v1/products/missing", {}, TEST_ENV);
		expect(res.status).toBe(404);
	});
});

describe("POST /api/v1/products (owner/manager only)", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request(
			"/api/v1/products?branchId=branch-1",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "Regulator", price: 350 }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 403 for a customer", async () => {
		const token = await createTestToken({ role: "customer" });
		const res = await app.request(
			"/api/v1/products?branchId=branch-1",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ name: "Regulator", price: 350 }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("returns 201 on creation for an owner", async () => {
		mockProductsService.create.mockResolvedValue(fakeProduct);
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/products?branchId=branch-1",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({
					name: "12kg LPG Cylinder",
					category: "Cylinder",
					price: 1200,
					stock: 10,
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(201);
		expect(mockProductsService.create).toHaveBeenCalled();
		const body = (await res.json()) as { data: { id: string } };
		expect(body.data.id).toBe("product-1");
	});

	it("returns 422 when name is empty", async () => {
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/products?branchId=branch-1",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ name: "", price: 1200 }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(422);
	});

	it("returns 422 when stock is negative", async () => {
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/products?branchId=branch-1",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ name: "Cylinder", price: 1200, stock: -5 }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(422);
	});
});

describe("PATCH /api/v1/products/:id (owner/manager only)", () => {
	it("returns 200 on update for an owner", async () => {
		mockProductsService.update.mockResolvedValue({ ...fakeProduct, stock: 5 });
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/products/product-1",
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ stock: 5 }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { id: string } };
		expect(body.data.id).toBe("product-1");
	});

	it("returns 403 when the owner does not own the product's branch", async () => {
		mockProductsService.update.mockRejectedValue(
			new ForbiddenError("You do not have access to this product"),
		);
		const token = await createTestToken({ role: "owner", userId: "owner-2" });
		const res = await app.request(
			"/api/v1/products/product-1",
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ price: 9999 }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});
});

describe("DELETE /api/v1/products/:id (owner/manager only)", () => {
	it("returns 200 on delete for an owner", async () => {
		mockProductsService.delete.mockResolvedValue(fakeProduct);
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/products/product-1",
			{ method: "DELETE", headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { id: string } };
		expect(body.data.id).toBe("product-1");
	});
});
