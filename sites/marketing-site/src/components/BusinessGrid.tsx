"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Heart, MapPin, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { api, tokenStore } from "../lib/api";
import { searchBusinessesQuery } from "../lib/queries";
import { Button } from "./Button";
import type { Business } from "./data";
import { Photo } from "./Photo";
import { QueryError } from "./QueryError";
import { Stars } from "./Stars";

interface BusinessGridProps {
	query: string;
	category: string | null;
	city?: string | null;
}

export function BusinessGrid({ query, category, city }: BusinessGridProps) {
	const isLoggedIn = !!tokenStore.getAccessToken();

	const {
		data: apiBusinesses,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		...searchBusinessesQuery(api, { q: query, category, city }),
		placeholderData: (prev) => prev,
	});

	const { data: favouritesData } = useQuery({
		queryKey: ["favourites"],
		queryFn: () => api.favourites.list(),
		enabled: isLoggedIn,
		staleTime: 60_000,
	});

	const favouritedIds = new Set(favouritesData?.map((f) => f.businessId) ?? []);

	const list = apiBusinesses ?? [];
	const filtering = query.trim() || category;

	return (
		<section
			id="businesses"
			className="max-w-[1200px] mx-auto px-4 md:px-8 pt-8 md:pt-10 pb-14 md:pb-18 scroll-mt-24"
		>
			<div className="flex items-end justify-between mb-7">
				<div>
					<div className="t-eyebrow mb-2.5">
						{filtering ? "Results" : "Curated for you"}
					</div>
					<h2 className="m-0 font-serif font-normal text-4xl leading-tight tracking-tight text-ink-900">
						{filtering
							? `${list.length} ${list.length === 1 ? "business" : "businesses"}${category ? ` · ${category}` : ""}`
							: "Editor's picks"}
					</h2>
				</div>
				<Link
					href="/search"
					className="no-underline font-sans text-sm font-semibold text-primary-600 inline-flex items-center gap-1.5"
				>
					View all
					<ArrowRight size={16} />
				</Link>
			</div>
			{isError ? (
				<QueryError onRetry={() => refetch()} />
			) : isLoading && !apiBusinesses ? (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
					{[1, 2, 3, 4, 5, 6].map((i) => (
						<div
							key={i}
							className="rounded-lg border border-line overflow-hidden bg-surface shadow-sm"
						>
							<div className="bg-line h-[190px] animate-pulse" />
							<div className="p-4 pt-[18px] pb-5 flex flex-col gap-3">
								<div className="h-6 w-3/4 bg-line rounded animate-pulse" />
								<div className="h-4 w-1/2 bg-line rounded animate-pulse" />
								<div className="h-4 w-2/3 bg-line rounded animate-pulse" />
								<div className="h-px bg-line-soft" />
								<div className="flex justify-between">
									<div className="h-5 w-20 bg-line rounded animate-pulse" />
									<div className="h-8 w-16 bg-line rounded animate-pulse" />
								</div>
							</div>
						</div>
					))}
				</div>
			) : list.length === 0 ? (
				<div className="text-center px-16 py-20 text-ink-400 font-sans text-base">
					<Search size={40} className="text-ink-300 mx-auto mb-4" />
					<strong className="block text-xl text-ink-700 mb-2.5 font-serif font-normal">
						{filtering
							? "No businesses match your search"
							: "Businesses coming soon"}
					</strong>
					<span className="text-sm">
						{filtering
							? "Try a different search or browse another category."
							: "We're onboarding our first businesses. Check back soon."}
					</span>
				</div>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
					{list.map((v) => (
						<BusinessCard
							key={v.id}
							business={v}
							isFavourited={favouritedIds.has(v.id)}
							isLoggedIn={isLoggedIn}
						/>
					))}
				</div>
			)}
		</section>
	);
}

function BusinessCard({
	business,
	isFavourited,
	isLoggedIn,
}: {
	business: Business;
	isFavourited: boolean;
	isLoggedIn: boolean;
}) {
	const qc = useQueryClient();

	const toggleFav = useMutation<void>({
		mutationFn: async () => {
			if (isFavourited) {
				await api.favourites.remove(business.id);
			} else {
				await api.favourites.add(business.id);
			}
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["favourites"] });
		},
	});

	return (
		<div className="bg-surface rounded-lg border border-line shadow-sm hover:shadow-md overflow-hidden hover:-translate-y-0.5 transition-all duration-normal">
			<Link
				href={`/businesses/${business.id}`}
				className="block no-underline text-inherit"
			>
				<Photo
					tone={business.tone}
					height={190}
					radius="0"
					uri={business.coverPhotoUrl}
				>
					{isLoggedIn && (
						<button
							type="button"
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								toggleFav.mutate();
							}}
							className="absolute top-3.5 right-3.5 w-9 h-9 rounded-full border-none bg-paper/90 shadow-sm cursor-pointer flex items-center justify-center"
						>
							<Heart
								size={18}
								style={{
									color: isFavourited
										? "var(--color-danger)"
										: "var(--color-ink-700)",
									fill: isFavourited ? "var(--color-danger)" : "transparent",
								}}
							/>
						</button>
					)}
					{business.premium && (
						<span className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-950/55 backdrop-blur-sm text-white text-xs font-semibold">
							<Sparkles size={12} className="text-gold-300" />
							Premium
						</span>
					)}
				</Photo>

				<div className="p-4 pt-[18px]">
					<h3 className="m-0 font-serif font-medium text-2xl leading-snug tracking-tight text-ink-900">
						{business.name}
					</h3>
					<div className="flex items-center gap-1.5 mt-1.5 text-ink-500 text-sm">
						<MapPin size={15} />
						{business.city}
					</div>
					<div className="flex items-center gap-2 mt-3 text-sm text-ink-700">
						<Stars value={business.rating} />
						<strong>
							{business.rating > 0 ? business.rating.toFixed(1) : "New"}
						</strong>
						{business.reviews > 0 && (
							<span className="text-ink-400">({business.reviews})</span>
						)}
						<span className="text-ink-300">·</span>
						<span className="text-ink-500">{business.cat}</span>
					</div>
				</div>
			</Link>
			<div className="flex justify-between items-baseline px-4 pb-5 pt-4 border-t border-line-soft">
				<span className="text-xs text-ink-400">
					From{" "}
					<strong className="text-base font-bold text-ink-900">
						৳{business.from.toLocaleString("en-BD")}
					</strong>
				</span>
				<Link href={`/book/${business.id}`} className="no-underline">
					<Button variant="ghost" size="sm">
						Book
					</Button>
				</Link>
			</div>
		</div>
	);
}
