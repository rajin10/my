import type { Business as ApiBusiness } from "@repo/api-client";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useApp } from "../context";
import type { Business } from "../data";
import { api } from "../lib/api";

const DEFAULT_TONE: [string, string] = ["#e8f5e9", "#1b5e20"];

function adaptBusinessBasic(v: ApiBusiness, coverPhotoUrl?: string | null): Business {
	return {
		id: v.id,
		name: v.name,
		vertical: v.vertical,
		category: v.category,
		city: v.city,
		rating: 0,
		reviews: 0,
		from: 0,
		tone: DEFAULT_TONE,
		blurb: v.description ?? "",
		coverPhotoUrl: coverPhotoUrl ?? null,
		branches: [],
		services: [],
	};
}

export function useFavouriteBusinesses() {
	const { isAuthed } = useApp();

	const favListQuery = useQuery({
		queryKey: ["favourites", "list"],
		queryFn: () => api.favourites.list(),
		enabled: isAuthed,
		staleTime: 60_000,
	});

	const businessIds = (favListQuery.data ?? []).map((f) => f.businessId);

	const businessQueries = useQueries({
		queries: businessIds.map((id) => ({
			queryKey: ["business", id],
			queryFn: async () => {
				const res = await api.businesses.get(id);
				return ("data" in res && res.data ? res.data : res) as ApiBusiness;
			},
			staleTime: 300_000,
		})),
	});

	const photoQueries = useQueries({
		queries: businessIds.map((id) => ({
			queryKey: ["business-photos", id],
			queryFn: () => api.businesses.listPhotos(id),
			staleTime: 300_000,
		})),
	});

	const businesses: Business[] = businessQueries.flatMap((q, i) => {
		if (q.data == null) return [];
		const photos = photoQueries[i]?.data;
		const coverPhotoUrl = photos?.[0]?.url ?? null;
		return [adaptBusinessBasic(q.data, coverPhotoUrl)];
	});

	return {
		businesses,
		isLoading:
			favListQuery.isLoading ||
			businessQueries.some((q) => q.isLoading && !q.data),
	};
}
