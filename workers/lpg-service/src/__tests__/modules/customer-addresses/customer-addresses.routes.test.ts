import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "../../../core/errors";
import { authHeader, createTestToken, TEST_ENV } from "../../helpers/auth";
import { createTestApp } from "../../helpers/create-test-app";

const mockSvc = {
	listMine: vi.fn(),
	create: vi.fn(),
	update: vi.fn(),
	remove: vi.fn(),
};
const app = createTestApp({ customerAddressesService: mockSvc as never });
beforeEach(() => vi.clearAllMocks());

const addr = {
	id: "a1",
	userId: "u1",
	label: "Home",
	line: "12 Road",
	area: null,
	city: null,
	lat: null,
	lng: null,
	isDefault: false,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: null,
};

describe("GET /api/v1/customer-addresses", () => {
	it("401 without auth", async () => {
		const res = await app.request("/api/v1/customer-addresses", {}, TEST_ENV);
		expect(res.status).toBe(401);
	});
	it("200 returns my addresses", async () => {
		mockSvc.listMine.mockResolvedValue([addr]);
		const token = await createTestToken({ role: "customer", userId: "u1" });
		const res = await app.request(
			"/api/v1/customer-addresses",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		expect(mockSvc.listMine).toHaveBeenCalledWith("u1");
	});
});

describe("POST /api/v1/customer-addresses", () => {
	it("201 on create", async () => {
		mockSvc.create.mockResolvedValue(addr);
		const token = await createTestToken({ role: "customer", userId: "u1" });
		const res = await app.request(
			"/api/v1/customer-addresses",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ line: "12 Road", isDefault: true }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(201);
	});
	it("422 when line is missing", async () => {
		const token = await createTestToken({ role: "customer", userId: "u1" });
		const res = await app.request(
			"/api/v1/customer-addresses",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ label: "Home" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(422);
	});
});

describe("PATCH /api/v1/customer-addresses/:id", () => {
	it("200 on update", async () => {
		mockSvc.update.mockResolvedValue({ ...addr, label: "Office" });
		const token = await createTestToken({ role: "customer", userId: "u1" });
		const res = await app.request(
			"/api/v1/customer-addresses/a1",
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ label: "Office" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
	});
	it("403 when not owned", async () => {
		mockSvc.update.mockRejectedValue(new ForbiddenError("nope"));
		const token = await createTestToken({ role: "customer", userId: "u2" });
		const res = await app.request(
			"/api/v1/customer-addresses/a1",
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ label: "Office" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});
});

describe("DELETE /api/v1/customer-addresses/:id", () => {
	it("200 on delete", async () => {
		mockSvc.remove.mockResolvedValue(addr);
		const token = await createTestToken({ role: "customer", userId: "u1" });
		const res = await app.request(
			"/api/v1/customer-addresses/a1",
			{ method: "DELETE", headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
	});
});
