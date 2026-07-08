import { describe, expect, it, vi } from "vitest";
import apiRoutes from "../../modules/routes";

describe("gateway LPG proxy", () => {
	it("forwards GET /api/v1/products to LPG_SERVICE unchanged", async () => {
		const body = [
			{
				id: "p1",
				name: "Cylinder",
				branchId: "b1",
				price: 1200,
				stock: 5,
			},
		];
		const fetchMock = vi.fn(
			async () =>
				new Response(JSON.stringify(body), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
		);

		const env = {
			LPG_SERVICE: { fetch: fetchMock },
			TALASH_DB: {
				prepare: () => ({ first: async () => ({}) }),
			},
			TALASH_KV: undefined,
			TALASH_QUEUE: { send: async () => undefined },
			TALASH_STORAGE: {},
			JWT_SECRET: "test",
			PUBLIC_R2_URL: "https://storage.test",
			ALLOWED_ORIGINS: "",
		} as unknown as CloudflareBindings;

		const res = await apiRoutes.request(
			"http://localhost/v1/products?branchId=b1",
			{ method: "GET" },
			env,
		);

		expect(fetchMock).toHaveBeenCalledOnce();
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(body);
	});
});
