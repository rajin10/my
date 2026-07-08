import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../../../core/errors";
import { authHeader, createTestToken, TEST_ENV } from "../../helpers/auth";
import { createTestApp } from "../../helpers/create-test-app";

const mockUsersService = {
	list: vi.fn(),
	get: vi.fn(),
	create: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
	uploadPhoto: vi.fn(),
};

const app = createTestApp({ usersService: mockUsersService as never });

const fakeUser = {
	id: "user-1",
	email: "user@example.com",
	name: "Test User",
	role: "customer",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: null,
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("GET /api/v1/users", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request("/api/v1/users", {}, TEST_ENV);
		expect(res.status).toBe(401);
	});

	it("returns 200 with paginated list when authenticated as owner", async () => {
		mockUsersService.list.mockResolvedValue({
			data: [fakeUser],
			query: {
				total: 1,
				page: 1,
				limit: 10,
				totalPages: 1,
				hasNextPage: false,
				hasPrevPage: false,
			},
		});
		const token = await createTestToken({ userId: "user-1", role: "owner" });
		const res = await app.request(
			"/api/v1/users",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, any>;
		expect(body.data).toHaveLength(1);
		expect(body.data[0].id).toBe("user-1");
	});
});

describe("GET /api/v1/users/:id", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request("/api/v1/users/user-1", {}, TEST_ENV);
		expect(res.status).toBe(401);
	});

	it("returns 200 with user when authenticated", async () => {
		mockUsersService.get.mockResolvedValue(fakeUser);
		const token = await createTestToken({ userId: "user-1" });
		const res = await app.request(
			"/api/v1/users/user-1",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, any>;
		expect(body.data.id).toBe("user-1");
	});

	it("returns 404 when user not found", async () => {
		mockUsersService.get.mockRejectedValue(new NotFoundError("User not found"));
		const token = await createTestToken({ userId: "missing" });
		const res = await app.request(
			"/api/v1/users/missing",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(404);
	});
});

describe("POST /api/v1/users", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request(
			"/api/v1/users",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 201 with created user when authenticated as moderator", async () => {
		mockUsersService.create.mockResolvedValue(fakeUser);
		const token = await createTestToken({
			userId: "user-1",
			role: "moderator",
		});
		const res = await app.request(
			"/api/v1/users",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({
					name: "Test User",
					email: "user@example.com",
					role: "user",
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(201);
		const body = (await res.json()) as Record<string, any>;
		expect(body.data.id).toBe("user-1");
	});
});

describe("PATCH /api/v1/users/:id", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request(
			"/api/v1/users/user-1",
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "Updated" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 403 when updating another user's account", async () => {
		const token = await createTestToken({ userId: "other-user" });
		const res = await app.request(
			"/api/v1/users/user-1",
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ name: "Updated" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("returns 200 with updated user", async () => {
		mockUsersService.update.mockResolvedValue({ ...fakeUser, name: "Updated" });
		const token = await createTestToken({ userId: "user-1" });
		const res = await app.request(
			"/api/v1/users/user-1",
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ name: "Updated" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, any>;
		expect(body.data.name).toBe("Updated");
	});

	it("returns 404 when user not found", async () => {
		mockUsersService.update.mockRejectedValue(
			new NotFoundError("User not found"),
		);
		const token = await createTestToken({ userId: "missing" });
		const res = await app.request(
			"/api/v1/users/missing",
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ name: "X" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(404);
	});
});

describe("DELETE /api/v1/users/:id", () => {
	const deleteBody = { password: "secret123" };

	it("returns 401 without auth", async () => {
		const res = await app.request(
			"/api/v1/users/user-1",
			{
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(deleteBody),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 403 when deleting another user's account", async () => {
		const token = await createTestToken({ userId: "other-user" });
		const res = await app.request(
			"/api/v1/users/user-1",
			{
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
					...authHeader(token),
				},
				body: JSON.stringify(deleteBody),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("returns 422 when verification body is missing", async () => {
		const token = await createTestToken({ userId: "user-1" });
		const res = await app.request(
			"/api/v1/users/user-1",
			{ method: "DELETE", headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(422);
	});

	it("returns 200 when deleting own account with verification", async () => {
		mockUsersService.delete.mockResolvedValue(fakeUser);
		const token = await createTestToken({ userId: "user-1" });
		const res = await app.request(
			"/api/v1/users/user-1",
			{
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
					...authHeader(token),
				},
				body: JSON.stringify(deleteBody),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { id: string } };
		expect(body.data.id).toBe("user-1");
		expect(mockUsersService.delete).toHaveBeenCalledWith("user-1", deleteBody);
	});

	it("returns 404 when own account not found", async () => {
		mockUsersService.delete.mockRejectedValue(
			new NotFoundError("User not found"),
		);
		const token = await createTestToken({ userId: "missing" });
		const res = await app.request(
			"/api/v1/users/missing",
			{
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
					...authHeader(token),
				},
				body: JSON.stringify(deleteBody),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(404);
	});
});

describe("POST /api/v1/users/:id/photo", () => {
	function form() {
		const fd = new FormData();
		fd.append(
			"file",
			new File([new Uint8Array(10)], "a.png", { type: "image/png" }),
		);
		return fd;
	}

	it("returns 401 without auth", async () => {
		const res = await app.request(
			"/api/v1/users/user-1/photo",
			{ method: "POST", body: form() },
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 403 uploading to another user's id", async () => {
		const token = await createTestToken({ userId: "user-1" });
		const res = await app.request(
			"/api/v1/users/user-2/photo",
			{ method: "POST", headers: { ...authHeader(token) }, body: form() },
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("returns 200 and the url for a valid self upload", async () => {
		mockUsersService.uploadPhoto.mockResolvedValue({
			url: "https://storage.test/users/user-1/x.png",
		});
		const token = await createTestToken({ userId: "user-1" });
		const res = await app.request(
			"/api/v1/users/user-1/photo",
			{ method: "POST", headers: { ...authHeader(token) }, body: form() },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { url: string };
		expect(body.url).toContain("user-1");
		expect(mockUsersService.uploadPhoto).toHaveBeenCalledWith(
			"user-1",
			expect.any(File),
		);
	});
});
