import { beforeEach, describe, expect, it, vi } from "vitest";
import { authHeader, createTestToken, TEST_ENV } from "../../helpers/auth";
import { createTestApp } from "../../helpers/create-test-app";

const mockPaymentsService = { record: vi.fn(), void: vi.fn() };
const app = createTestApp({ paymentsService: mockPaymentsService as never });
beforeEach(() => vi.clearAllMocks());

const body = { businessId: "biz1", userId: "u1", amount: 500 };

describe("POST /api/v1/payments", () => {
	it("401 without auth", async () => {
		const res = await app.request(
			"/api/v1/payments",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("201 for an owner", async () => {
		mockPaymentsService.record.mockResolvedValue({ id: "pay1", amount: 500 });
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/payments",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify(body),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(201);
		expect(mockPaymentsService.record).toHaveBeenCalledWith(
			"owner-1",
			expect.objectContaining({
				businessId: "biz1",
				userId: "u1",
				amount: 500,
			}),
		);
	});

	it("422 when amount is not a positive integer (zod)", async () => {
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/payments",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ ...body, amount: 0 }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(422);
	});
});

describe("DELETE /api/v1/payments/:id", () => {
	it("204 when the owner voids", async () => {
		mockPaymentsService.void.mockResolvedValue(undefined);
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/payments/pay1",
			{
				method: "DELETE",
				headers: { ...authHeader(token) },
			},
			TEST_ENV,
		);
		expect(res.status).toBe(204);
		expect(mockPaymentsService.void).toHaveBeenCalledWith("owner-1", "pay1");
	});
});
