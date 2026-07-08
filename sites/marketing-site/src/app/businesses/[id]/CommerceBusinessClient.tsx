"use client";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { api } from "@/lib/api";

/**
 * Commerce (LPG) business detail — placeholder until the ordering experience
 * lands (Phase 1, #71+). Selected by the per-vertical registry in
 * `businessExperiences.ts` based on `business.vertical`.
 */
export function CommerceBusinessClient({ id }: { id: string }) {
	const { data: result } = useQuery({
		queryKey: ["business", id],
		queryFn: () => api.businesses.get(id),
		staleTime: 300_000,
	});
	const name = result?.data?.name ?? "This business";
	return (
		<>
			<Nav />
			<main className="max-w-[800px] mx-auto px-4 md:px-8 py-20 text-center">
				<ShoppingBag size={48} className="text-ink-300 mx-auto mb-5" />
				<h1 className="font-serif font-normal text-4xl text-ink-900 m-0 mb-3.5">
					{name}
				</h1>
				<p className="font-sans text-base text-ink-500 mb-8">
					Online ordering from this business is coming soon to Talash.
				</p>
				<Link href="/search" className="no-underline">
					<Button icon="ArrowLeft">Browse businesses</Button>
				</Link>
			</main>
			<Footer />
		</>
	);
}
