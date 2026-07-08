import { beforeEach, describe, expect, it, vi } from "vitest";
import { authHeader, createTestToken, TEST_ENV } from "../../helpers/auth";
import { createTestApp } from "../../helpers/create-test-app";

const fakeCampaign = {
	id: "camp-1",
	name: "Test Campaign",
	businessId: "business-1",
	segment: "All",
	channels: '["Email"]',
	message: "",
	status: "Draft",
	sentAt: null,
	recipientCount: null,
	createdAt: "2026-01-01T00:00:00Z",
	updatedAt: null,
};

const mockCampaignsService = {
	list: vi.fn().mockResolvedValue([]),
	create: vi.fn().mockResolvedValue(fakeCampaign),
	update: vi.fn(),
	send: vi.fn(),
	delete: vi.fn(),
};

const app = createTestApp({ campaignsService: mockCampaignsService as never });

beforeEach(() => {
	vi.resetAllMocks();
	mockCampaignsService.list.mockResolvedValue([]);
	mockCampaignsService.create.mockResolvedValue(fakeCampaign);
});

describe("GET /api/v1/campaigns (owner only)", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request(
			"/api/v1/campaigns?businessId=business-1",
			{},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 403 for customer role", async () => {
		const token = await createTestToken({ role: "customer" });
		const res = await app.request(
			"/api/v1/campaigns?businessId=business-1",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("returns 200 for owner", async () => {
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/campaigns?businessId=business-1",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body).toEqual([]);
	});
});

describe("POST /api/v1/campaigns", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request(
			"/api/v1/campaigns",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					businessId: "business-1",
					name: "Test",
					segment: "All",
					channels: ["Email"],
					message: "",
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 201 for owner", async () => {
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/campaigns",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({
					businessId: "business-1",
					name: "Test Campaign",
					segment: "All",
					channels: ["Email"],
					message: "Hello",
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(201);
	});
});
