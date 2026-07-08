"use client";
import { useQuery } from "@tanstack/react-query";
import { Check, MapPin, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../lib/api";
import { featuredBusinessesQuery } from "../lib/queries";
import { Button } from "./Button";
import { TONES } from "./data";
import { Photo } from "./Photo";
import { Stars } from "./Stars";

interface HeroProps {
	onSearch: (query: string) => void;
}

const COLLAGE_TONES = [TONES.forest, TONES.clay, TONES.deep];

export function Hero({ onSearch }: HeroProps) {
	const [what, setWhat] = useState("");
	const [where, setWhere] = useState("");
	const router = useRouter();

	const { data: featuredBusinesses } = useQuery(featuredBusinessesQuery(api));
	const collagePhotos =
		featuredBusinesses?.data.map((v) => v.coverPhotoUrl) ?? [];

	function handleSearch() {
		const params = new URLSearchParams();
		if (what.trim()) params.set("q", what.trim());
		if (where.trim()) params.set("city", where.trim());
		router.push(`/search?${params}`);
		onSearch(what);
	}

	return (
		<section className="max-w-[1200px] mx-auto px-4 md:px-8 pt-10 md:pt-12 pb-12 md:pb-16 grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-14 items-center">
			<div>
				<div className="t-eyebrow mb-4">Discover · Book · Unwind</div>
				<h1 className="m-0 font-serif font-normal text-5xl sm:text-6xl md:text-7xl leading-none tracking-tight text-ink-900">
					Find your next
					<br />
					<span className="italic text-primary-600">appointment</span>.
				</h1>
				<p className="mt-5 mb-0 font-sans text-base md:text-lg leading-relaxed text-ink-600 max-w-[460px]">
					The considered way to discover and book salons, spas, studios and
					clinics near you — in seconds, from anywhere.
				</p>

				{/* Search panel */}
				<div className="mt-7 w-full max-w-[36rem] flex flex-col sm:flex-row sm:items-center bg-surface rounded-full border border-line shadow-md p-1.5 gap-1.5 sm:gap-0 overflow-hidden">
					<div className="flex-1 flex items-center gap-2.5 px-3.5 py-1.5 sm:py-0 min-w-0">
						<Search size={19} className="text-primary-600 shrink-0" />
						<input
							value={what}
							onChange={(e) => setWhat(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && handleSearch()}
							placeholder="Service or business"
							className="border-none outline-none flex-1 font-sans text-base text-ink-900 bg-transparent min-w-0"
						/>
					</div>
					<div className="hidden sm:block w-px self-stretch bg-line my-2 shrink-0" />
					<div className="sm:hidden h-px bg-line mx-3.5" />
					<div className="flex-1 flex items-center gap-2.5 px-3.5 py-1.5 sm:py-0 min-w-0">
						<MapPin size={19} className="text-primary-600 shrink-0" />
						<input
							value={where}
							onChange={(e) => setWhere(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && handleSearch()}
							placeholder="City or area"
							className="border-none outline-none flex-1 font-sans text-base text-ink-900 bg-transparent min-w-0"
						/>
					</div>
					<Button
						size="md"
						icon="Search"
						onClick={handleSearch}
						className="shrink-0 w-full sm:w-auto rounded-full"
					>
						Search
					</Button>
				</div>

				<div className="mt-5 flex items-center gap-5 font-sans text-sm text-ink-500">
					<span className="inline-flex items-center gap-2">
						<Stars value={5} size={15} />
						<strong className="text-ink-800">4.8</strong> average rating
					</span>
					<span className="w-1 h-1 rounded-full bg-ink-300" />
					<span>
						<strong className="text-ink-800">10,000+</strong> businesses
					</span>
				</div>
			</div>

			{/* Image collage — only on wide screens where there's room */}
			<div className="hidden lg:block relative h-[460px]">
				<Photo
					tone={COLLAGE_TONES[0]}
					uri={collagePhotos[0]}
					height={300}
					style={{
						position: "absolute",
						top: 0,
						right: 0,
						width: 280,
						boxShadow: "var(--shadow-lg)",
					}}
				/>
				<Photo
					tone={COLLAGE_TONES[1]}
					uri={collagePhotos[1]}
					height={200}
					style={{
						position: "absolute",
						bottom: 0,
						right: 150,
						width: 200,
						boxShadow: "var(--shadow-lg)",
					}}
				/>
				<Photo
					tone={COLLAGE_TONES[2]}
					uri={collagePhotos[2]}
					height={170}
					style={{
						position: "absolute",
						bottom: 40,
						left: 0,
						width: 180,
						boxShadow: "var(--shadow-lg)",
					}}
				/>
				<div className="absolute top-9 left-2 bg-surface rounded-md shadow-lg p-3 px-4 flex items-center gap-2.5">
					<div className="w-9 h-9 rounded-full bg-success-bg flex items-center justify-center">
						<Check size={18} className="text-success-fg" />
					</div>
					<div>
						<div className="text-sm font-bold text-ink-900">
							Booking confirmed
						</div>
						<div className="text-xs text-ink-500">Tomorrow · 11:00</div>
					</div>
				</div>
			</div>
		</section>
	);
}
