import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError } from "../../../core/errors";
import { authHeader, createTestToken, TEST_ENV } from "../../helpers/auth";
import { createTestApp } from "../../helpers/create-test-app";

const mockBranchesService = {
	listByBusiness: vi.fn(),
	get: vi.fn(),
	getAvailability: vi.fn(),
	create: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
};

const app = createTestApp({ branchesService: mockBranchesService as never });

const fakeBranch = {
	id: "branch-1",
	name: "Main Branch",
	businessId: "business-1",
	address: "123 Main St",
	city: "Dhaka",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: null,
};

beforeEach(() => {
	vi.resetAllMocks();
});

describe("GET /api/v1/branches", () => {
	it("returns 200 with the branches in a data envelope", async () => {
		mockBranchesService.listByBusiness.mockResolvedValue([fakeBranch]);
		const res = await app.request(
			"/api/v1/branches?businessId=business-1",
			{},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: unknown[] };
		expect(body.data).toHaveLength(1);
	});

	it("returns 422 when businessId is missing", async () => {
		const res = await app.request("/api/v1/branches", {}, TEST_ENV);
		expect(res.status).toBe(422);
	});
});

describe("GET /api/v1/branches/:id", () => {
	it("returns 200 with the branch in a data envelope", async () => {
		mockBranchesService.get.mockResolvedValue(fakeBranch);
		const res = await app.request("/api/v1/branches/branch-1", {}, TEST_ENV);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { id: string } };
		expect(body.data.id).toBe("branch-1");
	});

	it("returns 404 when not found", async () => {
		mockBranchesService.get.mockRejectedValue(
			new NotFoundError("Branch not found"),
		);
		const res = await app.request("/api/v1/branches/missing", {}, TEST_ENV);
		expect(res.status).toBe(404);
	});
});

describe("GET /api/v1/branches/:id/availability", () => {
	it("returns 200 with available slots", async () => {
		mockBranchesService.getAvailability.mockResolvedValue({
			date: "2026-06-10",
			serviceId: "svc-1",
			isClosed: false,
			slots: ["2026-06-10T10:00:00"],
		});
		const res = await app.request(
			"/api/v1/branches/branch-1/availability?date=2026-06-10&serviceId=svc-1",
			{},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { slots: string[] };
		expect(body.slots).toHaveLength(1);
	});
});

describe("POST /api/v1/branches", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request(
			"/api/v1/branches?businessId=business-1",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "Test", address: "Addr", city: "Dhaka" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 403 for non-owner", async () => {
		const token = await createTestToken({ role: "customer" });
		const res = await app.request(
			"/api/v1/branches?businessId=business-1",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ name: "Test", address: "Addr", city: "Dhaka" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("returns 201 for owner", async () => {
		mockBranchesService.create.mockResolvedValue(fakeBranch);
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/branches?businessId=business-1",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({
					name: "Main Branch",
					address: "123 Main St",
					city: "Dhaka",
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(201);
		const body = (await res.json()) as { data: { id: string } };
		expect(body.data.id).toBe("branch-1");
	});
});

describe("PATCH /api/v1/branches/:id", () => {
	it("returns 200 on update", async () => {
		mockBranchesService.update.mockResolvedValue({
			...fakeBranch,
			name: "Updated",
		});
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/branches/branch-1",
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ name: "Updated" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { name: string } };
		expect(body.data.name).toBe("Updated");
	});

	it("returns 403 when forbidden", async () => {
		mockBranchesService.update.mockRejectedValue(
			new ForbiddenError("You do not own this business"),
		);
		const token = await createTestToken({
			role: "owner",
			userId: "other-owner",
		});
		const res = await app.request(
			"/api/v1/branches/branch-1",
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ name: "X" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});
});

describe("DELETE /api/v1/branches/:id", () => {
	it("returns 200 on delete", async () => {
		mockBranchesService.delete.mockResolvedValue(fakeBranch);
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/branches/branch-1",
			{ method: "DELETE", headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { id: string } };
		expect(body.data.id).toBe("branch-1");
	});
});
