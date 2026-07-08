import type { TalashApi } from "@repo/api-client";
import type { QueryClient } from "@tanstack/react-query";
import {
	branchesQuery,
	businessPhotosQuery,
	businessQuery,
	featuredBusinessesQuery,
	reviewsQuery,
	type SearchGridParams,
	searchBusinessesQuery,
} from "./queries";

/**
 * Server-side prefetch for the business-detail route.
 *
 * Uses `ensureQueryData` so it dedupes against anything `generateMetadata`
 * already loaded into the same per-request QueryClient, and `allSettled` so an
 * upstream failure degrades to a client-side fetch (+ QueryError) rather than
 * crashing the page. Public reads only — auth-gated queries (favourites) stay
 * client-only.
 */
export async function prefetchBusinessDetail(
	qc: QueryClient,
	client: TalashApi,
	id: string,
): Promise<void> {
	await Promise.allSettled([
		qc.ensureQueryData(businessQuery(client, id)),
		qc.ensureQueryData(businessPhotosQuery(client, id)),
		qc.ensureQueryData(branchesQuery(client, id)),
		qc.ensureQueryData(reviewsQuery(client, id)),
	]);
}

/**
 * Server-side prefetch for the homepage discovery surface: the result grid for
 * the current URL filters, plus the Hero featured collage. Same keys as the
 * client `useQuery` calls (via the shared factories), so the dehydrated state
 * hydrates without a refetch. `allSettled` so an API failure degrades to a
 * client fetch. Public reads only.
 */
export async function prefetchHomeDiscovery(
	qc: QueryClient,
	client: TalashApi,
	params: SearchGridParams,
): Promise<void> {
	await Promise.allSettled([
		qc.ensureQueryData(searchBusinessesQuery(client, params)),
		qc.ensureQueryData(featuredBusinessesQuery(client)),
	]);
}
