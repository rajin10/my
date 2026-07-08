import { beforeEach, describe, expect, it, vi } from "vitest";
import { authHeader, createTestToken, TEST_ENV } from "../../helpers/auth";
import { createTestApp } from "../../helpers/create-test-app";

const fakeSlot = {
	id: "slot-1",
	teamMemberId: "member-1",
	dayOfWeek: 1,
	isClosed: false,
	startTime: "09:00",
	endTime: "18:00",
	createdAt: "2026-01-01T00:00:00.000Z",
};

const mockStaffAvailabilityService = {
	get: vi.fn().mockResolvedValue([fakeSlot]),
	upsert: vi.fn().mockResolvedValue([fakeSlot]),
};

const app = createTestApp({
	staffAvailabilityService: mockStaffAvailabilityService as never,
});

beforeEach(() => {
	vi.resetAllMocks();
	mockStaffAvailabilityService.get.mockResolvedValue([fakeSlot]);
	mockStaffAvailabilityService.upsert.mockResolvedValue([fakeSlot]);
});

describe("GET /api/v1/team/:id/availability", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request(
			"/api/v1/team/member-1/availability",
			{},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 403 for customer role", async () => {
		const token = await createTestToken({ role: "customer" });
		const res = await app.request(
			"/api/v1/team/member-1/availability",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("returns 200 with availability slots for owner", async () => {
		const token = await createTestToken({ role: "owner" });
		const res = await app.request(
			"/api/v1/team/member-1/availability",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as unknown[];
		expect(body).toHaveLength(1);
	});

	it("returns empty array when no availability set", async () => {
		mockStaffAvailabilityService.get.mockResolvedValue([]);
		const token = await createTestToken({ role: "owner" });
		const res = await app.request(
			"/api/v1/team/member-1/availability",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as unknown[];
		expect(body).toHaveLength(0);
	});
});

describe("PUT /api/v1/team/:id/availability", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request(
			"/api/v1/team/member-1/availability",
			{
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ availability: [] }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 403 for customer role", async () => {
		const token = await createTestToken({ role: "customer" });
		const res = await app.request(
			"/api/v1/team/member-1/availability",
			{
				method: "PUT",
				headers: { ...authHeader(token), "Content-Type": "application/json" },
				body: JSON.stringify({ availability: [] }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("returns 200 with updated slots for owner", async () => {
		const token = await createTestToken({ role: "owner" });
		const res = await app.request(
			"/api/v1/team/member-1/availability",
			{
				method: "PUT",
				headers: { ...authHeader(token), "Content-Type": "application/json" },
				body: JSON.stringify({
					availability: [
						{
							dayOfWeek: 1,
							isClosed: false,
							startTime: "09:00",
							endTime: "18:00",
						},
						{ dayOfWeek: 0, isClosed: true },
					],
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as unknown[];
		expect(Array.isArray(body)).toBe(true);
	});

	it("returns 422 when dayOfWeek is out of range", async () => {
		const token = await createTestToken({ role: "owner" });
		const res = await app.request(
			"/api/v1/team/member-1/availability",
			{
				method: "PUT",
				headers: { ...authHeader(token), "Content-Type": "application/json" },
				body: JSON.stringify({
					availability: [{ dayOfWeek: 8, isClosed: false }],
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(422);
	});
});
