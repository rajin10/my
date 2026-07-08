import type { EnrichedSearchResult, TalashApi } from "@repo/api-client";
import { describe, expect, it, vi } from "vitest";
import {
	branchesQuery,
	businessPhotosQuery,
	businessQuery,
	featuredBusinessesQuery,
	reviewsQuery,
	searchBusinessesQuery,
} from "../queries";

const enriched = {
	id: "v1",
	name: "Glow Studio",
	category: "Spa & massage",
	city: "Dhaka",
	status: "Active",
	description: null,
	ownerId: "o1",
	createdAt: "2026-01-01T00:00:00Z",
	updatedAt: null,
	vertical: "booking",
	minPrice: 500,
	avgRating: 4.5,
	coverPhotoUrl: null,
	lat: null,
	lng: null,
	area: null,
	distanceKm: null,
	brandPalette: null,
} satisfies EnrichedSearchResult;

function fakeApi() {
	return {
		businesses: {
			get: vi.fn().mockResolvedValue({ data: { id: "v1" } }),
			listPhotos: vi.fn().mockResolvedValue([{ url: "p.jpg" }]),
		},
		branches: { list: vi.fn().mockResolvedValue({ data: [] }) },
		reviews: { list: vi.fn().mockResolvedValue({ data: [] }) },
		search: {
			businesses: vi
				.fn()
				.mockResolvedValue({ data: [enriched], aiRanked: false }),
		},
	};
}

const call = (fn: unknown) => (fn as () => Promise<unknown>)();

describe("query factories", () => {
	it("businessQuery keys on ['business', id] and calls businesses.get(id)", async () => {
		const api = fakeApi();
		const q = businessQuery(api as unknown as TalashApi, "v1");
		expect(q.queryKey).toEqual(["business", "v1"]);
		await call(q.queryFn);
		expect(api.businesses.get).toHaveBeenCalledWith("v1");
	});

	it("businessPhotosQuery keys on ['business-photos', id]", async () => {
		const api = fakeApi();
		const q = businessPhotosQuery(api as unknown as TalashApi, "v1");
		expect(q.queryKey).toEqual(["business-photos", "v1"]);
		await call(q.queryFn);
		expect(api.businesses.listPhotos).toHaveBeenCalledWith("v1");
	});

	it("branchesQuery keys on ['branches', id] and requests limit 10", async () => {
		const api = fakeApi();
		const q = branchesQuery(api as unknown as TalashApi, "v1");
		expect(q.queryKey).toEqual(["branches", "v1"]);
		await call(q.queryFn);
		expect(api.branches.list).toHaveBeenCalledWith("v1", { limit: 10 });
	});

	it("reviewsQuery keys on ['reviews', id] and requests limit 20", async () => {
		const api = fakeApi();
		const q = reviewsQuery(api as unknown as TalashApi, "v1");
		expect(q.queryKey).toEqual(["reviews", "v1"]);
		await call(q.queryFn);
		expect(api.reviews.list).toHaveBeenCalledWith({
			businessId: "v1",
			limit: 20,
		});
	});

	it("featuredBusinessesQuery keys on the rating/limit-3 query (matches Hero)", async () => {
		const api = fakeApi();
		const q = featuredBusinessesQuery(api as unknown as TalashApi);
		expect(q.queryKey).toEqual([
			"search",
			"businesses",
			{ sortBy: "rating", limit: 3 },
		]);
		await call(q.queryFn);
		expect(api.search.businesses).toHaveBeenCalledWith({
			sortBy: "rating",
			limit: 3,
		});
	});

	it("searchBusinessesQuery keys on the raw params and maps results to the card model", async () => {
		const api = fakeApi();
		const params = { q: "glow", category: null, city: null };
		const q = searchBusinessesQuery(api as unknown as TalashApi, params);
		expect(q.queryKey).toEqual(["search", "businesses", params]);
		const result = await call(q.queryFn);
		expect(api.search.businesses).toHaveBeenCalledWith({
			q: "glow",
			category: undefined,
			city: undefined,
			limit: 30,
		});
		expect(result).toEqual([
			expect.objectContaining({
				id: "v1",
				cat: "Spa & massage",
				rating: 4.5,
				from: 500,
			}),
		]);
	});

	it("searchBusinessesQuery sends undefined for an empty query string", async () => {
		const api = fakeApi();
		const q = searchBusinessesQuery(api as unknown as TalashApi, {
			q: "",
			category: null,
			city: null,
		});
		await call(q.queryFn);
		expect(api.search.businesses).toHaveBeenCalledWith({
			q: undefined,
			category: undefined,
			city: undefined,
			limit: 30,
		});
	});
});
