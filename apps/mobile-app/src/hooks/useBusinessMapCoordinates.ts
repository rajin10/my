import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Business } from "../data";
import { api } from "../lib/api";

export type BusinessMapCoordinate = { lat: number; lng: number };

/** Fetches branch coordinates only for businesses missing lat/lng from search. */
export function useBusinessMapCoordinates(businesses: Business[], enabled: boolean) {
	const missing = useMemo(
		() => businesses.filter((v) => v.mapLat == null || v.mapLng == null),
		[businesses],
	);

	const queries = useQueries({
		queries:
			enabled && missing.length > 0
				? missing.map((business) => ({
						queryKey: ["branches", business.id, "map-pin"],
						queryFn: async (): Promise<{
							businessId: string;
							lat: number | null;
							lng: number | null;
						}> => {
							const res = await api.branches.list(business.id, { limit: 20 });
							const branch = res.data.find(
								(b) => b.lat != null && b.lng != null,
							);
							return {
								businessId: business.id,
								lat: branch?.lat ?? null,
								lng: branch?.lng ?? null,
							};
						},
						staleTime: 300_000,
					}))
				: [],
	});

	const coordMap = useMemo(() => {
		const map = new Map<string, BusinessMapCoordinate>();
		for (const v of businesses) {
			if (v.mapLat != null && v.mapLng != null) {
				map.set(v.id, { lat: v.mapLat, lng: v.mapLng });
			}
		}
		for (const q of queries) {
			const data = q.data;
			if (data?.lat != null && data.lng != null) {
				map.set(data.businessId, { lat: data.lat, lng: data.lng });
			}
		}
		return map;
	}, [businesses, queries]);

	const isLoading =
		enabled && missing.length > 0 && queries.some((q) => q.isLoading);

	return { coordMap, isLoading };
}

export function businessesWithMapCoordinates(
	businesses: Business[],
	coordMap: Map<string, BusinessMapCoordinate>,
): Business[] {
	return businesses.map((v) => {
		const c = coordMap.get(v.id);
		if (!c) return v;
		return { ...v, mapLat: c.lat, mapLng: c.lng };
	});
}
