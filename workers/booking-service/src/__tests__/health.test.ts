import { createTestApp } from "./helpers/create-test-app";

function mockDb(available: boolean) {
	return {
		prepare: () => ({
			first: async () => {
				if (!available) throw new Error("db down");
				return 1;
			},
		}),
	} as unknown as D1Database;
}

describe("GET /health", () => {
	it("returns ok when DB is available", async () => {
		const app = createTestApp();

		const res = await app.request(
			"http://localhost/health",
			{},
			{ TALASH_DB: mockDb(true) },
		);

		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toEqual({
			status: "ok",
			service: "booking-service",
			db: "ok",
		});
	});

	it("returns 503 when DB is unavailable", async () => {
		const app = createTestApp();

		const res = await app.request(
			"http://localhost/health",
			{},
			{ TALASH_DB: mockDb(false) },
		);

		expect(res.status).toBe(503);
		await expect(res.json()).resolves.toEqual({
			status: "error",
			service: "booking-service",
			db: "unavailable",
		});
	});
});
