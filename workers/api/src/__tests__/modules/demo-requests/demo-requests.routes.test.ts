import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_ENV } from "../../helpers/auth";
import { createTestApp } from "../../helpers/create-test-app";

const mockDemoRequestsService = {
	create: vi.fn().mockResolvedValue({
		id: "demo-1",
		name: "Alice",
		email: "alice@example.com",
		businessName: "Alice Spa",
		message: "Looking forward to a demo!",
		createdAt: "2026-01-01T00:00:00.000Z",
	}),
};

const app = createTestApp({
	demoRequestsService: mockDemoRequestsService as never,
});

beforeEach(() => {
	vi.resetAllMocks();
	mockDemoRequestsService.create.mockResolvedValue({
		id: "demo-1",
		name: "Alice",
		email: "alice@example.com",
		businessName: "Alice Spa",
		message: "Looking forward to a demo!",
		createdAt: "2026-01-01T00:00:00.000Z",
	});
});

describe("POST /api/v1/demo-requests", () => {
	it("returns 201 with the created request", async () => {
		const res = await app.request(
			"/api/v1/demo-requests",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Alice",
					email: "alice@example.com",
					businessName: "Alice Spa",
					message: "Looking forward to a demo!",
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(201);
		const body = await res.json();
		expect(body).toMatchObject({ id: "demo-1", email: "alice@example.com" });
	});

	it("returns 201 without optional message field", async () => {
		const res = await app.request(
			"/api/v1/demo-requests",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Bob",
					email: "bob@example.com",
					businessName: "Bob Wellness",
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(201);
	});

	it("returns 422 when email is invalid", async () => {
		const res = await app.request(
			"/api/v1/demo-requests",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Bad",
					email: "not-an-email",
					businessName: "Bad Corp",
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(422);
	});

	it("returns 422 when required fields are missing", async () => {
		const res = await app.request(
			"/api/v1/demo-requests",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "Incomplete" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(422);
	});
});
