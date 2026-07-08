import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../../../core/errors";
import { authHeader, createTestToken, TEST_ENV } from "../../helpers/auth";
import { createTestApp } from "../../helpers/create-test-app";

const mockNotificationsService = {
	list: vi.fn(),
	markRead: vi.fn(),
	markAllRead: vi.fn(),
};

const app = createTestApp({
	notificationsService: mockNotificationsService as never,
});

const fakeNotif = {
	id: "notif-1",
	type: "booking" as const,
	title: "New booking",
	body: "A new booking was placed.",
	readAt: null,
	businessId: "business-1",
	bookingId: "booking-1",
	reviewId: null,
	go: "bookings" as const,
	createdAt: "2026-01-01T12:00:00.000Z",
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("GET /api/v1/notifications", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request("/api/v1/notifications", {}, TEST_ENV);
		expect(res.status).toBe(401);
	});

	it("returns 200 with list", async () => {
		mockNotificationsService.list.mockResolvedValue([fakeNotif]);
		const token = await createTestToken({ role: "owner" });
		const res = await app.request(
			"/api/v1/notifications",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as unknown[];
		expect(body).toHaveLength(1);
	});
});

describe("PATCH /api/v1/notifications/:id/read", () => {
	it("returns 200 when marked read", async () => {
		mockNotificationsService.markRead.mockResolvedValue({
			...fakeNotif,
			readAt: "2026-01-02T00:00:00.000Z",
		});
		const token = await createTestToken({ role: "owner" });
		const res = await app.request(
			"/api/v1/notifications/notif-1/read",
			{ method: "PATCH", headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
	});

	it("returns 404 when not found", async () => {
		mockNotificationsService.markRead.mockRejectedValue(
			new NotFoundError("Notification not found"),
		);
		const token = await createTestToken({ role: "owner" });
		const res = await app.request(
			"/api/v1/notifications/missing/read",
			{ method: "PATCH", headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(404);
	});
});

describe("POST /api/v1/notifications/read-all", () => {
	it("returns 200 with updated count", async () => {
		mockNotificationsService.markAllRead.mockResolvedValue(3);
		const token = await createTestToken({ role: "owner" });
		const res = await app.request(
			"/api/v1/notifications/read-all",
			{ method: "POST", headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { updated: number };
		expect(body.updated).toBe(3);
	});
});
