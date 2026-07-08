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

describe("GET /api/v1/search dispatcher", () => {
	it("proxies to BOOKING_SERVICE by default", async () => {
		const bookingFetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ data: [], aiRanked: false }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		const lpgFetch = vi.fn();
		const app = createDispatcherApp();
		const env = {
			...TEST_ENV,
			BOOKING_SERVICE: { fetch: bookingFetch },
			LPG_SERVICE: { fetch: lpgFetch },
			AUTH_SERVICE: { fetch: vi.fn() },
		} as unknown as CloudflareBindings;

		const res = await app.request("/api/v1/search?q=salon", {}, env);
		expect(res.status).toBe(200);
		expect(bookingFetch).toHaveBeenCalledOnce();
		expect(lpgFetch).not.toHaveBeenCalled();
	});

	it("proxies vertical=commerce to LPG_SERVICE", async () => {
		const bookingFetch = vi.fn();
		const lpgFetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ data: [], aiRanked: false }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		const app = createDispatcherApp();
		const env = {
			...TEST_ENV,
			BOOKING_SERVICE: { fetch: bookingFetch },
			LPG_SERVICE: { fetch: lpgFetch },
			AUTH_SERVICE: { fetch: vi.fn() },
		} as unknown as CloudflareBindings;

		const res = await app.request(
			"/api/v1/search?vertical=commerce&area=Banani",
			{},
			env,
		);
		expect(res.status).toBe(200);
		expect(lpgFetch).toHaveBeenCalledOnce();
		expect(bookingFetch).not.toHaveBeenCalled();
	});
});
