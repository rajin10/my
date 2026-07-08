import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	ConflictError,
	ForbiddenError,
	NotFoundError,
	ValidationError,
} from "../../../core/errors";
import { authHeader, createTestToken, TEST_ENV } from "../../helpers/auth";
import { createTestApp } from "../../helpers/create-test-app";

const mockOrdersService = {
	create: vi.fn(),
	listMine: vi.fn(),
	get: vi.fn(),
	listByBranch: vi.fn(),
	updateStatus: vi.fn(),
	cancel: vi.fn(),
};
const app = createTestApp({ ordersService: mockOrdersService as never });
beforeEach(() => vi.clearAllMocks());

const body = {
	branchId: "b1",
	addressId: "a1",
	items: [{ productId: "p1", quantity: 2 }],
};

describe("POST /api/v1/orders", () => {
	it("401 without auth", async () => {
		const res = await app.request(
			"/api/v1/orders",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("201 for a customer", async () => {
		mockOrdersService.create.mockResolvedValue({ id: "o1", total: 2400 });
		const token = await createTestToken({ role: "customer", userId: "u1" });
		const res = await app.request(
			"/api/v1/orders",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify(body),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(201);
		expect(mockOrdersService.create).toHaveBeenCalledWith("u1", body);
	});

	it("409 when out of stock", async () => {
		mockOrdersService.create.mockRejectedValue(
			new ConflictError("out of stock"),
		);
		const token = await createTestToken({ role: "customer", userId: "u1" });
		const res = await app.request(
			"/api/v1/orders",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify(body),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(409);
	});

	it("422 with empty items", async () => {
		const token = await createTestToken({ role: "customer", userId: "u1" });
		const res = await app.request(
			"/api/v1/orders",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ ...body, items: [] }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(422);
	});
});

describe("GET /api/v1/orders", () => {
	it("401 without auth", async () => {
		const res = await app.request("/api/v1/orders", {}, TEST_ENV);
		expect(res.status).toBe(401);
	});

	it("200 returns my orders", async () => {
		mockOrdersService.listMine.mockResolvedValue([]);
		const token = await createTestToken({ role: "customer", userId: "u1" });
		const res = await app.request(
			"/api/v1/orders",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		expect(mockOrdersService.listMine).toHaveBeenCalledWith("u1");
	});
});

describe("GET /api/v1/orders/:id", () => {
	it("401 without auth", async () => {
		const res = await app.request("/api/v1/orders/o1", {}, TEST_ENV);
		expect(res.status).toBe(401);
	});

	it("200 returns the customer's own order including items", async () => {
		const order = {
			id: "o1",
			userId: "u1",
			status: "Pending",
			total: 2400,
			items: [{ productId: "p1", quantity: 2, unitPrice: 1200 }],
		};
		mockOrdersService.get.mockResolvedValue(order);
		const token = await createTestToken({ role: "customer", userId: "u1" });
		const res = await app.request(
			"/api/v1/orders/o1",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const json = (await res.json()) as { items?: unknown };
		expect(Array.isArray(json.items)).toBe(true);
		expect(json.items).toHaveLength(1);
		// Customer path: actorId + orderId, no branch scope, asOwner=false.
		expect(mockOrdersService.get).toHaveBeenCalledWith("u1", "o1", null, false);
	});

	it("403 when requesting a different customer's order (cross-customer isolation)", async () => {
		// Service throws ForbiddenError because the order's userId !== actorId
		// (assertCustomerOwnsOrder). u2 must not be able to read u1's order.
		mockOrdersService.get.mockRejectedValue(new ForbiddenError());
		const token = await createTestToken({ role: "customer", userId: "u2" });
		const res = await app.request(
			"/api/v1/orders/o1",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(403);
		expect(mockOrdersService.get).toHaveBeenCalledWith("u2", "o1", null, false);
	});

	it("404 for a non-existent order", async () => {
		mockOrdersService.get.mockRejectedValue(
			new NotFoundError("Order not found"),
		);
		const token = await createTestToken({ role: "customer", userId: "u1" });
		const res = await app.request(
			"/api/v1/orders/missing",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(404);
	});
});

describe("PATCH /api/v1/orders/:id/cancel", () => {
	it("401 without auth", async () => {
		const res = await app.request(
			"/api/v1/orders/o1/cancel",
			{ method: "PATCH" },
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("204 on customer cancel", async () => {
		mockOrdersService.cancel.mockResolvedValue(undefined);
		const token = await createTestToken({ role: "customer", userId: "u1" });
		const res = await app.request(
			"/api/v1/orders/o1/cancel",
			{ method: "PATCH", headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(204);
	});

	it("422 when not cancellable", async () => {
		mockOrdersService.cancel.mockRejectedValue(
			new ValidationError("bad state"),
		);
		const token = await createTestToken({ role: "customer", userId: "u1" });
		const res = await app.request(
			"/api/v1/orders/o1/cancel",
			{ method: "PATCH", headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(422);
	});
});

describe("PATCH /api/v1/orders/:id/status (owner/manager)", () => {
	it("401 without auth", async () => {
		const res = await app.request(
			"/api/v1/orders/o1/status",
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: "Confirmed" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("403 for a customer", async () => {
		const token = await createTestToken({ role: "customer", userId: "u1" });
		const res = await app.request(
			"/api/v1/orders/o1/status",
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ status: "Confirmed" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("200 for owner on a valid transition", async () => {
		mockOrdersService.updateStatus.mockResolvedValue({
			id: "o1",
			status: "Confirmed",
		});
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/orders/o1/status",
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ status: "Confirmed" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
	});

	it("422 for owner when service rejects the transition", async () => {
		mockOrdersService.updateStatus.mockRejectedValue(
			new ValidationError("bad transition"),
		);
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/orders/o1/status",
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ status: "Delivered" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(422);
	});

	it("200 when an owner cancels via status=Cancelled", async () => {
		mockOrdersService.updateStatus.mockResolvedValue({
			id: "o1",
			status: "Cancelled",
		});
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/orders/o1/status",
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ status: "Cancelled" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		expect(mockOrdersService.updateStatus).toHaveBeenCalledWith(
			"owner-1",
			"o1",
			"Cancelled",
			null,
		);
	});
});

describe("GET /api/v1/orders/branch (owner/manager)", () => {
	it("401 without auth", async () => {
		const res = await app.request(
			"/api/v1/orders/branch?branchId=b1",
			{},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("403 for a customer", async () => {
		const token = await createTestToken({ role: "customer", userId: "u1" });
		const res = await app.request(
			"/api/v1/orders/branch?branchId=b1",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("200 for an owner", async () => {
		mockOrdersService.listByBranch.mockResolvedValue([]);
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/orders/branch?branchId=b1",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
	});
});
