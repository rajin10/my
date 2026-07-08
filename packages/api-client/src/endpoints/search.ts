import type { ApiClient } from "../client";
import type { BrandPalette, BusinessResult, BusinessVertical } from "../types";

export interface EnrichedSearchResult extends BusinessResult {
	vertical: BusinessVertical;
	minPrice: number | null;
	avgRating: number | null;
	coverPhotoUrl: string | null;
	lat: number | null;
	lng: number | null;
	area: string | null;
	distanceKm: number | null;
	// Venue brand palette (#60) — drives the per-item accent in cross-venue lists.
	brandPalette: BrandPalette | null;
}

export interface SearchResponse {
	data: EnrichedSearchResult[];
	aiRanked: boolean;
}

export type SearchSortBy = "recommended" | "rating" | "price";

export function createSearchEndpoints(client: ApiClient) {
	return {
		businesses: (params: {
			vertical?: BusinessVertical;
			q?: string;
			city?: string;
			area?: string;
			category?: string;
			lat?: number;
			lng?: number;
			minPrice?: number;
			maxPrice?: number;
			minRating?: number;
			sortBy?: SearchSortBy;
			limit?: number;
		}) => client.get<SearchResponse>("/api/v1/search", params),
	};
}
