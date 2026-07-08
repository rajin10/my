import type { TalashApi } from "@repo/api-client";
import { queryOptions } from "@tanstack/react-query";
import { adaptBusiness } from "./adapters";

/**
 * Shared TanStack query-options factories. Both server prefetch (with the
 * token-less `serverApi`) and client `useQuery` (with the browser `api`) import
 * these, so the query keys — and therefore the dehydrated/hydrated cache
 * entries — match exactly. The caller is passed in so the same factory drives
 * both environments. See docs/superpowers/specs/2026-06-12-marketing-site-ssr-data-layer-design.md.
 */

export interface SearchGridParams {
	q?: string;
	category?: string | null;
	city?: string | null;
}

export const businessQuery = (client: TalashApi, id: string) =>
	queryOptions({
		queryKey: ["business", id],
		queryFn: () => client.businesses.get(id),
		staleTime: 300_000,
	});

export const businessPhotosQuery = (client: TalashApi, id: string) =>
	queryOptions({
		queryKey: ["business-photos", id],
		queryFn: () => client.businesses.listPhotos(id),
		staleTime: 300_000,
	});

export const branchesQuery = (client: TalashApi, id: string) =>
	queryOptions({
		queryKey: ["branches", id],
		queryFn: () => client.branches.list(id, { limit: 10 }),
		staleTime: 300_000,
	});

export const reviewsQuery = (client: TalashApi, id: string) =>
	queryOptions({
		queryKey: ["reviews", id],
		queryFn: () => client.reviews.list({ businessId: id, limit: 20 }),
		staleTime: 120_000,
	});

export const featuredBusinessesQuery = (client: TalashApi) =>
	queryOptions({
		queryKey: ["search", "businesses", { sortBy: "rating", limit: 3 }],
		queryFn: () => client.search.businesses({ sortBy: "rating", limit: 3 }),
		staleTime: 600_000,
	});

export const searchBusinessesQuery = (
	client: TalashApi,
	params: SearchGridParams,
) =>
	queryOptions({
		queryKey: ["search", "businesses", params],
		queryFn: async () => {
			const res = await client.search.businesses({
				q: params.q || undefined,
				category: params.category || undefined,
				city: params.city || undefined,
				limit: 30,
			});
			return res.data.map(adaptBusiness);
		},
		staleTime: 60_000,
	});
