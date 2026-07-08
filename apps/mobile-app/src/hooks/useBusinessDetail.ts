import { useQuery } from "@tanstack/react-query";
import type { Business } from "../data";
import { adaptBusinessDetail } from "../lib/adapters";
import { api } from "../lib/api";

function unwrap<T extends { id: string }>(res: { data?: T } | T): T {
	return ("data" in res && res.data ? res.data : res) as T;
}

export function useBusinessDetail(businessId: string | null | undefined) {
	return useQuery({
		queryKey: ["business", "detail", businessId],
		queryFn: async (): Promise<Business> => {
			// biome-ignore lint/style/noNonNullAssertion: queryFn only runs when enabled (!!businessId)
			const businessRes = await api.businesses.get(businessId!);
			const business = unwrap(businessRes);
			// biome-ignore lint/style/noNonNullAssertion: queryFn only runs when enabled (!!businessId)
			const branchesRes = await api.branches.list(businessId!, { limit: 50 });
			const branches = branchesRes.data;
			const [serviceResults, photos] = await Promise.all([
				Promise.all(
					branches.map((b) => api.services.list(b.id, { limit: 100 })),
				),
				// biome-ignore lint/style/noNonNullAssertion: queryFn only runs when enabled (!!businessId)
				api.businesses.listPhotos(businessId!),
			]);
			const services = serviceResults.flatMap((r) => r.data);
			return adaptBusinessDetail(
				business,
				branches,
				services,
				undefined,
				photos.map((p) => p.url),
			);
		},
		enabled: !!businessId,
		staleTime: 60_000,
	});
}
