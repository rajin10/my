import { useQueries } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useMyOrders } from "./useOrders";

export interface RecentSeller {
	id: string;
	name: string;
}

/**
 * Distinct sellers from the customer's past orders (most-recent first), resolved
 * to a name via businesses.get. Backs the "Order again" row on commerce discovery.
 */
export function useRecentSellers(): RecentSeller[] {
	const { data: orders } = useMyOrders();

	// Distinct businessIds preserving recency order (useMyOrders is newest-first).
	const ids: string[] = [];
	for (const o of orders ?? []) {
		if (!ids.includes(o.businessId)) ids.push(o.businessId);
	}

	const results = useQueries({
		queries: ids.map((id) => ({
			queryKey: ["business", id],
			queryFn: () => api.businesses.get(id),
			staleTime: 5 * 60_000,
		})),
	});

	return results
		.map((r, i) =>
			r.data ? { id: ids[i] as string, name: r.data.data.name } : null,
		)
		.filter((s): s is RecentSeller => s !== null);
}
