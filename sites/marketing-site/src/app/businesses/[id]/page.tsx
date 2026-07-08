import { ApiError } from "@repo/api-client";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/api.server";
import { prefetchBusinessDetail } from "@/lib/prefetch";
import { businessPhotosQuery, businessQuery } from "@/lib/queries";
import { getServerQueryClient } from "@/lib/query-client.server";
import { BusinessClient } from "./BusinessClient";

// Intended ISR window. NOTE: serverApi calls go through ApiClient's plain
// fetch (uncached), and ApiClient can't yet forward `next: { revalidate }`, so
// the route currently renders ON DEMAND (server-rendered + indexable, but not
// edge-cached). Wiring fetch-level revalidate to make ISR effective — and
// restoring the cache directive the old generateMetadata had — is a follow-up.
export const revalidate = 300;

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const { id } = await params;
	const qc = getServerQueryClient();
	try {
		// Shares the per-request QueryClient with the page body, so these reads are
		// the prefetch — no double-fetch (review #3).
		const [businessRes, photos] = await Promise.all([
			qc.ensureQueryData(businessQuery(serverApi, id)),
			qc.ensureQueryData(businessPhotosQuery(serverApi, id)),
		]);
		const business = businessRes.data;
		if (!business) return {};
		const title = `${business.name} — Talash`;
		const description =
			business.description?.slice(0, 160) ??
			`Book ${business.category} services at ${business.name} in ${business.city} on Talash.`;
		const cover = photos[0]?.url;
		return {
			title,
			description,
			openGraph: {
				title,
				description,
				images: cover ? [{ url: cover }] : [],
				type: "website",
			},
			twitter: {
				card: cover ? "summary_large_image" : "summary",
				title,
				description,
				images: cover ? [cover] : [],
			},
		};
	} catch {
		return {};
	}
}

export default async function BusinessPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const qc = getServerQueryClient();

	// A genuine 404 should be a 404 (for crawlers); any other failure degrades to
	// a client-side fetch + QueryError rather than blocking the page.
	try {
		await qc.ensureQueryData(businessQuery(serverApi, id));
	} catch (err) {
		if (err instanceof ApiError && err.status === 404) notFound();
	}

	await prefetchBusinessDetail(qc, serverApi, id);

	return (
		<HydrationBoundary state={dehydrate(qc)}>
			<BusinessClient id={id} />
		</HydrationBoundary>
	);
}
