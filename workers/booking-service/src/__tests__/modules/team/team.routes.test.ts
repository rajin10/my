import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	ConflictError,
	ForbiddenError,
	NotFoundError,
} from "../../../core/errors";
import { authHeader, createTestToken, TEST_ENV } from "../../helpers/auth";
import { createTestApp } from "../../helpers/create-test-app";

const mockTeamService = {
	listByBusiness: vi.fn(),
	get: vi.fn(),
	add: vi.fn(),
	update: vi.fn(),
	remove: vi.fn(),
};

const app = createTestApp({ teamService: mockTeamService as never });

const fakeMember = {
	id: "member-1",
	userId: "user-2",
	businessId: "business-1",
	branchId: null,
	title: "Staff",
	role: "Staff" as const,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: null,
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("GET /api/v1/team (owner only)", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request(
			"/api/v1/team?businessId=business-1",
			{},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 403 for non-owner", async () => {
		const token = await createTestToken({ role: "customer" });
		const res = await app.request(
			"/api/v1/team?businessId=business-1",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("returns 200 for owner", async () => {
		mockTeamService.listByBusiness.mockResolvedValue([fakeMember]);
		const token = await createTestToken({ role: "owner" });
		const res = await app.request(
			"/api/v1/team?businessId=business-1",
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

describe("POST /api/v1/team", () => {
	it("returns 201 on add", async () => {
		mockTeamService.add.mockResolvedValue(fakeMember);
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/team",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({
					userId: "user-2",
					businessId: "business-1",
					role: "Staff",
					title: "Staff",
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(201);
		const body = (await res.json()) as { data: { id: string } };
		expect(body.data.id).toBe("member-1");
	});

	it("returns 409 when user is already a member", async () => {
		mockTeamService.add.mockRejectedValue(
			new ConflictError("User is already a team member of this business"),
		);
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/team",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({
					userId: "user-2",
					businessId: "business-1",
					role: "Staff",
					title: "Staff",
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(409);
	});
});

describe("PATCH /api/v1/team/:id", () => {
	it("returns 200 on update", async () => {
		mockTeamService.update.mockResolvedValue({
			...fakeMember,
			title: "Manager",
		});
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/team/member-1",
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ title: "Manager" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { title: string } };
		expect(body.data.title).toBe("Manager");
	});

	it("returns 403 when forbidden", async () => {
		mockTeamService.update.mockRejectedValue(
			new ForbiddenError("You do not own this business"),
		);
		const token = await createTestToken({
			role: "owner",
			userId: "other-owner",
		});
		const res = await app.request(
			"/api/v1/team/member-1",
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ title: "X" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});
});

describe("DELETE /api/v1/team/:id", () => {
	it("returns 200 on remove", async () => {
		mockTeamService.remove.mockResolvedValue(fakeMember);
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/team/member-1",
			{ method: "DELETE", headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { id: string } };
		expect(body.data.id).toBe("member-1");
	});

	it("returns 404 when not found", async () => {
		mockTeamService.remove.mockRejectedValue(
			new NotFoundError("Team member not found"),
		);
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/team/missing",
			{ method: "DELETE", headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(404);
	});
});
