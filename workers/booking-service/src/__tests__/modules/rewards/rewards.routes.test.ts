import { beforeEach, describe, expect, it, vi } from "vitest";
import { authHeader, createTestToken, TEST_ENV } from "../../helpers/auth";
import { createTestApp } from "../../helpers/create-test-app";

const mockRewardsService = {
	getBalance: vi.fn(),
	getHistory: vi.fn(),
	redeem: vi.fn(),
};

const app = createTestApp({ rewardsService: mockRewardsService as never });

beforeEach(() => {
	vi.clearAllMocks();
});

describe("GET /api/v1/rewards/balance", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request("/api/v1/rewards/balance", {}, TEST_ENV);
		expect(res.status).toBe(401);
	});

	it("returns 200 with balance", async () => {
		mockRewardsService.getBalance.mockResolvedValue({
			userId: "user-1",
			balance: 250,
		});
		const token = await createTestToken({ userId: "user-1" });
		const res = await app.request(
			"/api/v1/rewards/balance",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.balance).toBe(250);
	});
});

describe("GET /api/v1/rewards/history", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request("/api/v1/rewards/history", {}, TEST_ENV);
		expect(res.status).toBe(401);
	});

	it("returns 200 with history", async () => {
		mockRewardsService.getHistory.mockResolvedValue([
			{
				id: "tx-1",
				userId: "user-1",
				bookingId: "b-1",
				type: "credit",
				points: 50,
				description: "Booking completed",
				createdAt: "2026-01-01T00:00:00.000Z",
			},
		]);
		const token = await createTestToken({ userId: "user-1" });
		const res = await app.request(
			"/api/v1/rewards/history",
			{ headers: authHeader(token) },
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
});

describe("POST /api/v1/rewards/redeem", () => {
	async function post(token: string, points: number) {
		return app.request(
			"/api/v1/rewards/redeem",
			{
				method: "POST",
				headers: { ...authHeader(token), "Content-Type": "application/json" },
				body: JSON.stringify({ points }),
			},
			TEST_ENV,
		);
	}

	it("returns 401 without auth", async () => {
		const res = await app.request(
			"/api/v1/rewards/redeem",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ points: 10 }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 200 with the new balance on success", async () => {
		mockRewardsService.redeem.mockResolvedValue({ newBalance: 150 });
		const token = await createTestToken({ userId: "user-1" });
		const res = await post(token, 50);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.newBalance).toBe(150);
	});

	it("maps the insufficient-points business error to a clean 422", async () => {
		// The core service leaks balance detail in its message; the route must not
		// echo it — it returns the documented fixed message instead.
		mockRewardsService.redeem.mockRejectedValue(
			new Error("Insufficient reward points. Available: 10, requested: 50"),
		);
		const token = await createTestToken({ userId: "user-1" });
		const res = await post(token, 50);
		expect(res.status).toBe(422);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.code).toBe("VALIDATION_ERROR");
		expect(body.message).toBe("Insufficient reward points");
		// Internal detail must not leak through.
		expect(String(body.message)).not.toMatch(/Available|requested/i);
	});

	it("does not leak an unexpected internal error — returns a generic 500", async () => {
		mockRewardsService.redeem.mockRejectedValue(
			new Error("D1_ERROR: database connection lost: SQLITE_BUSY"),
		);
		const token = await createTestToken({ userId: "user-1" });
		const res = await post(token, 50);
		expect(res.status).toBe(500);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.code).toBe("INTERNAL_ERROR");
		expect(String(body.message)).not.toMatch(/D1_ERROR|SQLITE/i);
	});
});
