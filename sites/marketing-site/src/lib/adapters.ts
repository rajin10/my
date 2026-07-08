import type { EnrichedSearchResult } from "@repo/api-client";
import type { Business } from "@/components/data";

/** Map an enriched search result to the card view-model used across home/search. */
export function adaptBusiness(r: EnrichedSearchResult): Business {
	return {
		id: r.id,
		name: r.name,
		cat: r.category,
		city: r.city,
		rating: r.avgRating ?? 0,
		reviews: 0,
		from: r.minPrice ?? 0,
		tone: "#e8f5e9",
		coverPhotoUrl: r.coverPhotoUrl,
	};
}
