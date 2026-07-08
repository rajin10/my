import type {
	BusinessVertical,
	EnrichedSearchResult,
	SearchSortBy,
} from "@repo/api-client";
import { useQuery } from "@tanstack/react-query";
import type { Business } from "../data";
import { api } from "../lib/api";

function adaptBusiness(r: EnrichedSearchResult): Business {
	return {
		id: r.id,
		name: r.name,
		vertical: r.vertical,
		category: r.category,
		city: r.city,
		rating: r.avgRating ?? 0,
		reviews: 0,
		from: r.minPrice ?? 0,
		tone: ["#e8f5e9", "#1b5e20"],
		blurb: r.description ?? "",
		coverPhotoUrl: r.coverPhotoUrl,
		mapLat: r.lat ?? null,
		mapLng: r.lng ?? null,
		area: r.area,
		distanceKm: r.distanceKm,
		branches: [],
		services: [],
		brandPalette: r.brandPalette ?? null,
	};
}

export interface BusinessSearchFilters {
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
	/** Commerce mode is suspended until the user picks an area or grants GPS. */
	enabled?: boolean;
}

export function useBusinessSearch(params: BusinessSearchFilters) {
	const { enabled = true, ...filters } = params;
	return useQuery({
		queryKey: ["search", "businesses", filters],
		queryFn: async () => {
			const res = await api.search.businesses({ ...filters, limit: 30 });
			return res.data.map(adaptBusiness);
		},
		enabled,
		staleTime: 60_000,
		placeholderData: (prev) => prev,
	});
}
