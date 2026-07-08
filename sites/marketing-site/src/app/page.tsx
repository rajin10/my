import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { BusinessBanner } from "@/components/BusinessBanner";
import { Footer } from "@/components/Footer";
import { HowItWorks } from "@/components/HowItWorks";
import { Nav } from "@/components/Nav";
import { Quote } from "@/components/Quote";
import { SearchSection } from "@/components/SearchSection";
import { serverApi } from "@/lib/api.server";
import { prefetchHomeDiscovery } from "@/lib/prefetch";
import { getServerQueryClient } from "@/lib/query-client.server";

const first = (v: string | string[] | undefined) =>
	Array.isArray(v) ? v[0] : v;

export default async function Home({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const sp = await searchParams;
	const q = first(sp.q) ?? "";
	const category = first(sp.category) ?? null;
	const city = first(sp.city) ?? null;

	// Read filters server-side (the route is already dynamic — the root layout
	// reads cookies) and prefetch the grid + Hero collage so they render in the
	// SSR HTML instead of being excluded by the useSearchParams CSR bailout.
	const qc = getServerQueryClient();
	await prefetchHomeDiscovery(qc, serverApi, { q, category, city });

	return (
		<>
			<Nav />
			<main>
				<HydrationBoundary state={dehydrate(qc)}>
					<SearchSection q={q} category={category} city={city} />
				</HydrationBoundary>
				<HowItWorks />
				<Quote />
				<BusinessBanner />
			</main>
			<Footer />
		</>
	);
}
