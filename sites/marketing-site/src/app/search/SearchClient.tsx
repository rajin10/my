"use client";
import type { EnrichedSearchResult } from "@repo/api-client";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/Button";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { Photo } from "@/components/Photo";
import { QueryError } from "@/components/QueryError";
import { Stars } from "@/components/Stars";
import { api } from "@/lib/api";
import { SEARCH_CATEGORIES } from "@/lib/search-categories";

function ResultCard({ r }: { r: EnrichedSearchResult }) {
	return (
		<Link href={`/businesses/${r.id}`} className="no-underline group">
			<div className="bg-surface rounded-xl border border-line overflow-hidden hover:shadow-md transition-shadow">
				{r.coverPhotoUrl ? (
					<div style={{ height: 180, overflow: "hidden" }}>
						<img
							src={r.coverPhotoUrl}
							alt={r.name}
							className="w-full h-full object-cover"
						/>
					</div>
				) : (
					<Photo tone="#e8f5e9" height={180} radius="0" className="block" />
				)}
				<div className="p-4">
					<div className="font-serif text-lg font-medium text-ink-900 group-hover:text-primary-700 transition-colors">
						{r.name}
					</div>
					<div className="flex items-center gap-1.5 text-ink-500 text-sm mt-1 mb-2">
						<MapPin size={13} />
						<span>{r.city}</span>
						<span className="text-ink-300">·</span>
						<span>{r.category}</span>
					</div>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-1.5">
							<Stars value={r.avgRating ?? 0} size={13} />
							<span className="font-sans text-xs text-ink-500">
								{r.avgRating ? r.avgRating.toFixed(1) : "New"}
							</span>
						</div>
						{r.minPrice != null && (
							<span className="font-sans text-sm font-semibold text-ink-900">
								from ৳{r.minPrice}
							</span>
						)}
					</div>
				</div>
			</div>
		</Link>
	);
}

function SearchResults() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [showFilters, setShowFilters] = useState(false);

	const q = searchParams.get("q") ?? "";
	const category = searchParams.get("category") ?? "";
	const city = searchParams.get("city") ?? "";

	const [inputQ, setInputQ] = useState(q);
	const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") ?? "");
	const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") ?? "");
	const [minRating, setMinRating] = useState(
		searchParams.get("minRating") ?? "",
	);
	const [sortBy, setSortBy] = useState<"recommended" | "rating" | "price">(
		(searchParams.get("sortBy") as "recommended" | "rating" | "price") ||
			"recommended",
	);

	const { data, isLoading, isError, refetch } = useQuery({
		queryKey: [
			"search",
			"businesses",
			{ q, category, city, minPrice, maxPrice, minRating, sortBy },
		],
		queryFn: () =>
			api.search.businesses({
				q: q || undefined,
				category: category || undefined,
				city: city || undefined,
				minPrice: minPrice ? Number(minPrice) : undefined,
				maxPrice: maxPrice ? Number(maxPrice) : undefined,
				minRating: minRating ? Number(minRating) : undefined,
				sortBy,
				limit: 48,
			}),
		staleTime: 60_000,
		placeholderData: (prev) => prev,
	});

	const results = data?.data ?? [];

	function pushParams(overrides: Record<string, string>) {
		const p = new URLSearchParams(searchParams.toString());
		for (const [k, v] of Object.entries(overrides)) {
			if (v) p.set(k, v);
			else p.delete(k);
		}
		router.push(`/search?${p}`);
	}

	function submitSearch(e: React.FormEvent) {
		e.preventDefault();
		pushParams({ q: inputQ.trim() });
	}

	return (
		<>
			{/* Search bar */}
			<form onSubmit={submitSearch} className="flex gap-2 mb-6">
				<div className="flex-1 flex items-center gap-2.5 px-4 py-3 bg-surface border border-line rounded-lg shadow-sm">
					<Search size={18} className="text-primary-600 shrink-0" />
					<input
						value={inputQ}
						onChange={(e) => setInputQ(e.target.value)}
						placeholder="Search businesses or services…"
						className="flex-1 border-none outline-none font-sans text-base text-ink-900 bg-transparent"
					/>
					{inputQ && (
						<button
							type="button"
							onClick={() => {
								setInputQ("");
								pushParams({ q: "" });
							}}
							className="bg-transparent border-none cursor-pointer p-0 text-ink-400"
						>
							<X size={16} />
						</button>
					)}
				</div>
				<Button type="submit" icon="Search">
					Search
				</Button>
				<Button
					type="button"
					variant="ghost"
					icon="SlidersHorizontal"
					onClick={() => setShowFilters((v) => !v)}
				>
					<span className="hidden sm:inline">Filters</span>
				</Button>
			</form>

			{/* Category chips */}
			<div className="flex flex-wrap gap-2 mb-6">
				{SEARCH_CATEGORIES.map((cat) => {
					const active = (cat === "All" && !category) || cat === category;
					return (
						<button
							key={cat}
							type="button"
							onClick={() => pushParams({ category: cat === "All" ? "" : cat })}
							className={[
								"px-3.5 py-1.5 rounded-full border font-sans text-sm font-medium cursor-pointer transition-colors",
								active
									? "bg-primary-700 text-white border-primary-700"
									: "bg-surface border-line text-ink-700 hover:border-primary-600",
							].join(" ")}
						>
							{cat}
						</button>
					);
				})}
			</div>

			{/* Filter panel */}
			{showFilters && (
				<div className="mb-6 p-4 bg-surface border border-line rounded-xl flex flex-wrap gap-5 items-end">
					<div className="flex flex-col gap-1 min-w-[120px]">
						<label className="font-sans text-xs font-semibold text-ink-500">
							Min price (৳)
						</label>
						<input
							type="number"
							min="0"
							value={minPrice}
							onChange={(e) => setMinPrice(e.target.value)}
							placeholder="0"
							className="w-full px-3 py-2 rounded-md border border-line font-sans text-sm text-ink-900 bg-transparent outline-none"
						/>
					</div>
					<div className="flex flex-col gap-1 min-w-[120px]">
						<label className="font-sans text-xs font-semibold text-ink-500">
							Max price (৳)
						</label>
						<input
							type="number"
							min="0"
							value={maxPrice}
							onChange={(e) => setMaxPrice(e.target.value)}
							placeholder="Any"
							className="w-full px-3 py-2 rounded-md border border-line font-sans text-sm text-ink-900 bg-transparent outline-none"
						/>
					</div>
					<div className="flex flex-col gap-1 min-w-[120px]">
						<label className="font-sans text-xs font-semibold text-ink-500">
							Min rating
						</label>
						<select
							value={minRating}
							onChange={(e) => setMinRating(e.target.value)}
							className="w-full px-3 py-2 rounded-md border border-line font-sans text-sm text-ink-900 bg-surface outline-none cursor-pointer"
						>
							<option value="">Any</option>
							{[3, 3.5, 4, 4.5].map((r) => (
								<option key={r} value={r}>
									{r}+ stars
								</option>
							))}
						</select>
					</div>
					<Button
						type="button"
						variant="ghost"
						onClick={() => {
							setMinPrice("");
							setMaxPrice("");
							setMinRating("");
						}}
					>
						Clear filters
					</Button>
				</div>
			)}

			{/* Results header */}
			<div className="flex items-center justify-between mb-5">
				<div className="font-sans text-sm text-ink-500">
					{isLoading
						? "Searching…"
						: `${results.length} business${results.length !== 1 ? "s" : ""} found`}
					{(q || category) && (
						<button
							type="button"
							onClick={() => {
								setInputQ("");
								pushParams({ q: "", category: "" });
							}}
							className="ml-3 text-primary-700 font-semibold bg-transparent border-none cursor-pointer p-0 text-sm"
						>
							Clear filters
						</button>
					)}
				</div>
				<select
					value={sortBy}
					onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
					className="px-3 py-1.5 rounded-md border border-line font-sans text-sm text-ink-700 bg-surface outline-none cursor-pointer"
				>
					<option value="recommended">Recommended</option>
					<option value="rating">Top rated</option>
					<option value="price">Lowest price</option>
				</select>
			</div>

			{/* Grid */}
			{isError ? (
				<QueryError onRetry={() => refetch()} />
			) : isLoading ? (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
					{Array.from({ length: 6 }).map((_, i) => (
						<div key={i} className="h-64 rounded-xl bg-line animate-pulse" />
					))}
				</div>
			) : results.length === 0 ? (
				<div className="py-20 text-center">
					<Search size={48} className="text-ink-300 mx-auto mb-5" />
					<h2 className="font-serif font-normal text-2xl text-ink-900 m-0 mb-2">
						No businesses found
					</h2>
					<p className="font-sans text-base text-ink-500 m-0 mb-6">
						Try a different search term or category.
					</p>
					<Button
						onClick={() => {
							setInputQ("");
							pushParams({ q: "", category: "" });
						}}
					>
						Show all businesses
					</Button>
				</div>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
					{results.map((r) => (
						<ResultCard key={r.id} r={r} />
					))}
				</div>
			)}
		</>
	);
}

export default function SearchClient() {
	return (
		<>
			<Nav />
			<main className="max-w-[1200px] mx-auto px-4 md:px-8 py-8 pb-16">
				<h1 className="m-0 mb-6 font-serif font-normal text-3xl md:text-4xl text-ink-900">
					Find a business
				</h1>
				<Suspense
					fallback={<div className="h-64 rounded-xl bg-line animate-pulse" />}
				>
					<SearchResults />
				</Suspense>
			</main>
			<Footer />
		</>
	);
}
