import type { TalashApi } from "@repo/api-client";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { prefetchBusinessDetail, prefetchHomeDiscovery } from "../prefetch";

function fakeApi() {
	return {
		businesses: {
			get: vi.fn().mockResolvedValue({ data: { id: "v1", name: "Glow" } }),
			listPhotos: vi.fn().mockResolvedValue([{ url: "p.jpg" }]),
		},
		branches: { list: vi.fn().mockResolvedValue({ data: [{ id: "b1" }] }) },
		reviews: { list: vi.fn().mockResolvedValue({ data: [{ id: "r1" }] }) },
	};
}

const asApi = (a: ReturnType<typeof fakeApi>) => a as unknown as TalashApi;

describe("prefetchBusinessDetail", () => {
	it("populates the business/photos/branches/reviews cache entries", async () => {
		const api = fakeApi();
		const qc = new QueryClient();
		await prefetchBusinessDetail(qc, asApi(api), "v1");
		expect(qc.getQueryData(["business", "v1"])).toEqual({
			data: { id: "v1", name: "Glow" },
		});
		expect(qc.getQueryData(["business-photos", "v1"])).toEqual([
			{ url: "p.jpg" },
		]);
		expect(qc.getQueryData(["branches", "v1"])).toEqual({
			data: [{ id: "b1" }],
		});
		expect(qc.getQueryData(["reviews", "v1"])).toEqual({
			data: [{ id: "r1" }],
		});
	});

	it("does not re-fetch a query that is already fresh in the cache (dedup)", async () => {
		const api = fakeApi();
		const qc = new QueryClient();
		qc.setQueryData(["business", "v1"], { data: { id: "v1", name: "Cached" } });
		await prefetchBusinessDetail(qc, asApi(api), "v1");
		expect(api.businesses.get).not.toHaveBeenCalled();
		expect(qc.getQueryData(["business", "v1"])).toEqual({
			data: { id: "v1", name: "Cached" },
		});
	});

	it("does not throw when one query fails; the others still populate", async () => {
		const api = fakeApi();
		api.reviews.list.mockRejectedValueOnce(new Error("api down"));
		const qc = new QueryClient();
		await expect(
			prefetchBusinessDetail(qc, asApi(api), "v1"),
		).resolves.toBeUndefined();
		expect(qc.getQueryData(["business", "v1"])).toBeDefined();
		expect(qc.getQueryData(["reviews", "v1"])).toBeUndefined();
	});
});

describe("prefetchHomeDiscovery", () => {
	it("populates the default grid + featured cache entries with matching keys", async () => {
		const search = vi.fn().mockResolvedValue({ data: [], aiRanked: false });
		const api = { search: { businesses: search } } as unknown as TalashApi;
		const qc = new QueryClient();
		const params = { q: "", category: null, city: null };
		await prefetchHomeDiscovery(qc, api, params);
		expect(qc.getQueryData(["search", "businesses", params])).toEqual([]);
		expect(
			qc.getQueryData(["search", "businesses", { sortBy: "rating", limit: 3 }]),
		).toEqual({ data: [], aiRanked: false });
		expect(search).toHaveBeenCalledWith({
			q: undefined,
			category: undefined,
			city: undefined,
			limit: 30,
		});
		expect(search).toHaveBeenCalledWith({ sortBy: "rating", limit: 3 });
	});

	it("does not throw when the grid query fails (degrades to client fetch)", async () => {
		const search = vi.fn().mockRejectedValue(new Error("down"));
		const api = { search: { businesses: search } } as unknown as TalashApi;
		const qc = new QueryClient();
		await expect(
			prefetchHomeDiscovery(qc, api, { q: "", category: null, city: null }),
		).resolves.toBeUndefined();
	});
});
