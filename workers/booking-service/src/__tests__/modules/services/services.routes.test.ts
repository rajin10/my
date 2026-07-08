import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../../../core/errors";
import { authHeader, createTestToken, TEST_ENV } from "../../helpers/auth";
import { createTestApp } from "../../helpers/create-test-app";

const mockServicesService = {
	listByBranch: vi.fn(),
	get: vi.fn(),
	create: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
	uploadPhoto: vi.fn(),
};

const app = createTestApp({ servicesService: mockServicesService as never });

const fakeSvc = {
	id: "svc-1",
	branchId: "branch-1",
	name: "Haircut",
	category: "Hair",
	duration: 30,
	price: 500,
	description: null,
	imageUrl: null,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: null,
};

beforeEach(() => {
	vi.resetAllMocks();
});

describe("GET /api/v1/services", () => {
	it("returns 200 with the services in a data envelope", async () => {
		mockServicesService.listByBranch.mockResolvedValue([fakeSvc]);
		const res = await app.request(
			"/api/v1/services?branchId=branch-1",
			{},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: unknown[] };
		expect(body.data).toHaveLength(1);
	});
});

describe("GET /api/v1/services/:id", () => {
	it("returns 200 with the service in a data envelope", async () => {
		mockServicesService.get.mockResolvedValue(fakeSvc);
		const res = await app.request("/api/v1/services/svc-1", {}, TEST_ENV);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { id: string } };
		expect(body.data.id).toBe("svc-1");
	});

	it("returns 404 when not found", async () => {
		mockServicesService.get.mockRejectedValue(
			new NotFoundError("Service not found"),
		);
		const res = await app.request("/api/v1/services/missing", {}, TEST_ENV);
		expect(res.status).toBe(404);
	});
});

describe("POST /api/v1/services", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request(
			"/api/v1/services?branchId=branch-1",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Haircut",
					category: "Hair",
					duration: 30,
					price: 500,
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 201 for owner", async () => {
		mockServicesService.create.mockResolvedValue(fakeSvc);
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/services?branchId=branch-1",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({
					name: "Haircut",
					category: "Hair",
					duration: 30,
					price: 500,
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(201);
		const body = (await res.json()) as { data: { id: string } };
		expect(body.data.id).toBe("svc-1");
	});
});

describe("PATCH /api/v1/services/:id", () => {
	it("returns 200 on update", async () => {
		mockServicesService.update.mockResolvedValue({
			...fakeSvc,
			name: "Updated",
		});
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/services/svc-1",
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
});

describe("DELETE /api/v1/services/:id", () => {
	it("returns 200 on delete", async () => {
		mockServicesService.delete.mockResolvedValue(fakeSvc);
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/services/svc-1",
			{ method: "DELETE", headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { id: string } };
		expect(body.data.id).toBe("svc-1");
	});
});
