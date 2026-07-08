import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../../core/create-app";
import { corsMiddleware } from "../../../middleware/cors";
import { errorHandler, notFoundHandler } from "../../../middleware/exceptions";
import { queryParserMiddleware } from "../../../middleware/query-parser";
import apiRoutes from "../../../modules/routes";
import { TEST_ENV } from "../../helpers/auth";

function createDispatcherApp() {
	const app = createApp({ strict: false });
	app.use("*", corsMiddleware);
	app.use("*", queryParserMiddleware);
	app.route("/api", apiRoutes);
	app.notFound(notFoundHandler);
	app.onError(errorHandler);
	return app;
}

describe("walk-in gateway dispatcher", () => {
	it("routes GET /context to BOOKING_SERVICE for booking branches", async () => {
		const bookingFetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ vertical: "booking", services: [] }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		const lpgFetch = vi.fn();
		const app = createDispatcherApp();
		const kvStore = new Map<string, string>();
		const kv = {
			get: async (key: string) => kvStore.get(key) ?? null,
			put: async (key: string, value: string) => {
				kvStore.set(key, value);
			},
		} as unknown as KVNamespace;
		await kv.put("branch:branch-booking:vertical", "booking");

		const env = {
			...TEST_ENV,
			TALASH_KV: kv,
			BOOKING_SERVICE: { fetch: bookingFetch },
			LPG_SERVICE: { fetch: lpgFetch },
			AUTH_SERVICE: { fetch: vi.fn() },
		} as unknown as CloudflareBindings;

		const res = await app.request(
			"/api/v1/walk-in/context?branchId=branch-booking&session=test",
			{},
			env,
		);
		expect(res.status).toBe(200);
		expect(bookingFetch).toHaveBeenCalledOnce();
		expect(lpgFetch).not.toHaveBeenCalled();
	});

	it("returns 422 when submit vertical mismatches branch vertical", async () => {
		const app = createDispatcherApp();
		const kvStore = new Map<string, string>();
		const kv = {
			get: async (key: string) => kvStore.get(key) ?? null,
			put: async (key: string, value: string) => {
				kvStore.set(key, value);
			},
		} as unknown as KVNamespace;

		const env = {
			...TEST_ENV,
			TALASH_KV: kv,
			BOOKING_SERVICE: { fetch: vi.fn() },
			LPG_SERVICE: { fetch: vi.fn() },
			AUTH_SERVICE: { fetch: vi.fn() },
		} as unknown as CloudflareBindings;

		// Prime cache: branch is booking
		await kv.put("branch:branch-1:vertical", "booking");

		const res = await app.request(
			"/api/v1/walk-in/submit",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					localId: "local-1",
					branchId: "branch-1",
					vertical: "commerce",
					customer: { userId: "user-1" },
					order: { items: [{ productId: "p1", qty: 1 }] },
					total: 100,
					submittedAt: Date.now(),
				}),
			},
			env,
		);

		expect(res.status).toBe(422);
		const body = (await res.json()) as { message: string };
		expect(body.message).toContain("does not match branch vertical");
	});

	it("fans out POST /sync entries by vertical and merges synced maps", async () => {
		const bookingFetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ synced: { "local-b": "booking-1" } }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		const lpgFetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ synced: { "local-c": "order-1" } }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		const app = createDispatcherApp();
		const env = {
			...TEST_ENV,
			BOOKING_SERVICE: { fetch: bookingFetch },
			LPG_SERVICE: { fetch: lpgFetch },
			AUTH_SERVICE: {
				fetch: async () =>
					new Response(JSON.stringify({ scopedBranchIds: null }), {
						status: 200,
						headers: { "content-type": "application/json" },
					}),
			},
		} as unknown as CloudflareBindings;

		const token = await import("../../helpers/auth").then((m) =>
			m.createTestToken({ role: "owner" }),
		);

		const res = await app.request(
			"/api/v1/walk-in/sync",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${await token}`,
				},
				body: JSON.stringify({
					entries: [
						{
							localId: "local-b",
							branchId: "branch-1",
							vertical: "booking",
							customer: { userId: "user-1" },
							booking: { serviceId: "x", slot: "2026-06-01T11:00:00" },
							total: 500,
							submittedAt: Date.now(),
						},
						{
							localId: "local-c",
							branchId: "branch-2",
							vertical: "commerce",
							customer: { userId: "user-1" },
							order: { items: [{ productId: "p1", qty: 1 }] },
							total: 100,
							submittedAt: Date.now(),
						},
					],
				}),
			},
			env,
		);

		expect(res.status).toBe(200);
		expect(bookingFetch).toHaveBeenCalledOnce();
		expect(lpgFetch).toHaveBeenCalledOnce();
		const body = (await res.json()) as { synced: Record<string, string> };
		expect(body.synced).toEqual({
			"local-b": "booking-1",
			"local-c": "order-1",
		});
	});

	it("fans in GET /receipts from both workers", async () => {
		const bookingFetch = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					bookings: [{ localId: "b1", serverId: "bk-1" }],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			),
		);
		const lpgFetch = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					orders: [{ localId: "o1", serverId: "ord-1" }],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			),
		);
		const app = createDispatcherApp();
		const env = {
			...TEST_ENV,
			BOOKING_SERVICE: { fetch: bookingFetch },
			LPG_SERVICE: { fetch: lpgFetch },
			AUTH_SERVICE: { fetch: vi.fn() },
		} as unknown as CloudflareBindings;

		const token = await import("../../helpers/auth").then((m) =>
			m.createTestToken({ role: "user" }),
		);

		const res = await app.request(
			"/api/v1/walk-in/receipts",
			{
				method: "GET",
				headers: { Authorization: `Bearer ${await token}` },
			},
			env,
		);

		expect(res.status).toBe(200);
		expect(bookingFetch).toHaveBeenCalledOnce();
		expect(lpgFetch).toHaveBeenCalledOnce();
		const body = (await res.json()) as {
			bookings: unknown[];
			orders: unknown[];
		};
		expect(body.bookings).toHaveLength(1);
		expect(body.orders).toHaveLength(1);
	});
});
