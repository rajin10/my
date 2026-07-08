import { beforeEach, describe, expect, it, vi } from "vitest";
import { authHeader, createTestToken, TEST_ENV } from "../../helpers/auth";
import { createTestApp } from "../../helpers/create-test-app";

const mockCustomersService = {
	list: vi.fn().mockResolvedValue([]),
	visits: vi.fn().mockResolvedValue([]),
};

const app = createTestApp({ customersService: mockCustomersService as never });

beforeEach(() => {
	vi.resetAllMocks();
	mockCustomersService.list.mockResolvedValue([]);
	mockCustomersService.visits.mockResolvedValue([]);
});

describe("GET /api/v1/customers (owner only)", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request(
			"/api/v1/customers?businessId=business-1",
			{},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 403 for customer role", async () => {
		const token = await createTestToken({ role: "customer" });
		const res = await app.request(
			"/api/v1/customers?businessId=business-1",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("returns 403 for manager role (owner-only gate)", async () => {
		const token = await createTestToken({ role: "manager", userId: "mgr-1" });
		const res = await app.request(
			"/api/v1/customers?businessId=business-1",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("returns 200 for owner", async () => {
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/customers?businessId=business-1",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body).toEqual([]);
	});
});

describe("GET /api/v1/customers/:userId/visits (owner only)", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request(
			"/api/v1/customers/user-1/visits?businessId=business-1",
			{},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 200 for owner", async () => {
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/customers/user-2/visits?businessId=business-1",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
	});
});
