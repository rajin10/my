import { beforeEach, describe, expect, it, vi } from "vitest";
import { authHeader, createTestToken, TEST_ENV } from "../../helpers/auth";
import { createTestApp } from "../../helpers/create-test-app";

const mockKhataService = { dues: vi.fn(), customerLedger: vi.fn() };
const app = createTestApp({ khataService: mockKhataService as never });
beforeEach(() => vi.clearAllMocks());

describe("GET /api/v1/khata/dues", () => {
	it("401 without auth", async () => {
		const res = await app.request(
			"/api/v1/khata/dues?businessId=biz1",
			{},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("200 with the dues list for an owner", async () => {
		mockKhataService.dues.mockResolvedValue([
			{ userId: "u1", name: "Karim", due: 1200 },
		]);
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/khata/dues?businessId=biz1",
			{
				headers: { ...authHeader(token) },
			},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual([
			{ userId: "u1", name: "Karim", due: 1200 },
		]);
		expect(mockKhataService.dues).toHaveBeenCalledWith("owner-1", "biz1");
	});
});

describe("GET /api/v1/khata/customers/:userId", () => {
	it("200 with the customer ledger", async () => {
		mockKhataService.customerLedger.mockResolvedValue({
			userId: "u1",
			name: "Karim",
			due: 700,
			totalDelivered: 1200,
			totalPaid: 500,
			deliveredOrders: [],
			payments: [],
		});
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/khata/customers/u1?businessId=biz1",
			{
				headers: { ...authHeader(token) },
			},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		expect(mockKhataService.customerLedger).toHaveBeenCalledWith(
			"owner-1",
			"biz1",
			"u1",
		);
	});
});
