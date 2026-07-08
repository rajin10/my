"use client";
import type { Branch, BranchHours } from "@repo/api-client";
import {
	useMutation,
	useQueries,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { ArrowLeft, Clock, Heart, Lock, MapPin, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Footer } from "@/components/Footer";
import { MapEmbed } from "@/components/MapEmbed";
import { Nav } from "@/components/Nav";
import { Photo } from "@/components/Photo";
import { QueryError } from "@/components/QueryError";
import { Stars } from "@/components/Stars";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import {
	branchesQuery,
	businessPhotosQuery,
	businessQuery,
	reviewsQuery,
} from "@/lib/queries";

export function BookingBusinessClient({ id }: { id: string }) {
	const { user } = useAuth();
	const router = useRouter();

	const {
		data: result,
		isLoading,
		isError,
		refetch,
	} = useQuery(businessQuery(api, id));

	const { data: branchesResult } = useQuery(branchesQuery(api, id));

	const branches = (branchesResult?.data ?? []) as Branch[];

	const servicesResults = useQueries({
		queries: branches.map((b) => ({
			queryKey: ["services", b.id],
			queryFn: () => api.services.list(b.id, { limit: 50 }),
			staleTime: 300_000,
		})),
	});

	const hoursResults = useQueries({
		queries: branches.map((b) => ({
			queryKey: ["branch-hours", b.id],
			queryFn: () => api.branches.getHours(b.id),
			staleTime: 300_000,
		})),
	});

	const { data: reviewsResult } = useQuery(reviewsQuery(api, id));

	const qc = useQueryClient();
	const { data: isFavData } = useQuery({
		queryKey: ["favourites", "check", id],
		queryFn: () => api.favourites.check(id),
		enabled: !!id && !!user,
		staleTime: 60_000,
	});
	const isFavourited = isFavData?.isFavourited ?? false;

	const toggleFavMut = useMutation({
		mutationFn: async () => {
			await (isFavourited ? api.favourites.remove(id) : api.favourites.add(id));
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["favourites", "check", id] });
			qc.invalidateQueries({ queryKey: ["favourites"] });
		},
	});

	const { data: photosResult } = useQuery(businessPhotosQuery(api, id));

	const { data: couponsResult } = useQuery({
		queryKey: ["business-coupons", id],
		queryFn: () => api.coupons.list({ businessId: id, limit: 10 }),
		enabled: !!id,
		staleTime: 120_000,
	});

	const branchServices = branches.map((b, i) => ({
		branch: b,
		services: servicesResults[i]?.data?.data ?? [],
	}));
	const services = branchServices.flatMap((bs) => bs.services);
	const branchHoursMap: Record<string, BranchHours[]> = {};
	for (let i = 0; i < branches.length; i++) {
		branchHoursMap[branches[i].id] = (hoursResults[i]?.data ??
			[]) as BranchHours[];
	}
	const reviews = reviewsResult?.data ?? [];
	const photos = photosResult ?? [];
	const business = result?.data;
	const activeCoupons = (couponsResult?.data ?? []).filter(
		(c) => c.status === "Active",
	);

	const { data: similarData } = useQuery({
		queryKey: [
			"search",
			"businesses",
			"similar",
			id,
			business?.category,
			business?.city,
		],
		queryFn: () =>
			api.search.businesses({
				category: business!.category,
				city: business!.city,
				limit: 4,
			}),
		enabled: !!business?.category && !!business?.city,
		staleTime: 300_000,
	});
	const similarBusinesses = (similarData?.data ?? [])
		.filter((v) => v.id !== id)
		.slice(0, 3);

	const avgRating =
		reviews.length > 0
			? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
			: null;

	if (isError && !result) {
		return (
			<>
				<Nav />
				<main className="max-w-[800px] mx-auto px-4 md:px-8 py-20">
					<QueryError
						title="Couldn't load this business"
						onRetry={() => refetch()}
					/>
				</main>
				<Footer />
			</>
		);
	}

	if (isLoading) {
		return (
			<>
				<Nav />
				<main className="max-w-[1200px] mx-auto px-4 md:px-8 py-12">
					<div className="h-[400px] rounded-xl bg-line animate-pulse mb-8" />
					<div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
						<div className="space-y-3">
							<div className="h-10 w-64 rounded-md bg-line animate-pulse" />
							<div className="h-4 w-40 rounded-md bg-line animate-pulse" />
						</div>
						<div className="h-48 rounded-xl bg-line animate-pulse" />
					</div>
				</main>
				<Footer />
			</>
		);
	}

	if (!business) {
		return (
			<>
				<Nav />
				<main className="max-w-[800px] mx-auto px-4 md:px-8 py-20 text-center">
					<Sparkles size={48} className="text-ink-300 mx-auto mb-5" />
					<h1 className="font-serif font-normal text-4xl text-ink-900 m-0 mb-3.5">
						Business not found
					</h1>
					<p className="font-sans text-base text-ink-500 mb-8">
						This business may no longer be listed on Talash.
					</p>
					<Link href="/" className="no-underline">
						<Button icon="ArrowLeft">Back to search</Button>
					</Link>
				</main>
				<Footer />
			</>
		);
	}

	return (
		<>
			<Nav />
			<main className="max-w-[1200px] mx-auto px-4 md:px-8 pt-8 pb-18">
				{/* Back */}
				<Link
					href="/search"
					className="inline-flex items-center gap-1.5 no-underline font-sans text-sm font-semibold text-primary-700 mb-7"
				>
					<ArrowLeft size={16} />
					Back to search
				</Link>

				{/* Hero photo */}
				{photos.length > 0 ? (
					<div
						className="mb-9 shadow-md overflow-hidden rounded-[var(--radius-xl)]"
						style={{ height: 420 }}
					>
						<img
							src={photos[0].url}
							alt={business.name}
							className="w-full h-full object-cover"
						/>
					</div>
				) : (
					<Photo
						tone="#e8f5e9"
						height={420}
						radius="var(--radius-xl)"
						className="mb-9 shadow-md"
					/>
				)}

				{/* Photo strip (if multiple photos) */}
				{photos.length > 1 && (
					<div className="flex gap-2 mb-9 overflow-x-auto pb-1">
						{photos.slice(1, 6).map((p, i) => (
							<div
								key={p.id}
								className="h-24 w-36 rounded-lg overflow-hidden shrink-0 bg-line"
							>
								<img
									src={p.url}
									alt={`${business.name} ${i + 2}`}
									className="w-full h-full object-cover"
								/>
							</div>
						))}
					</div>
				)}

				<div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 lg:gap-12 items-start">
					{/* Details */}
					<div>
						<div className="flex items-start gap-3 mb-2">
							<h1 className="m-0 font-serif font-normal text-4xl md:text-5xl tracking-tight text-ink-900 leading-tight flex-1">
								{business.name}
							</h1>
							{user && (
								<button
									type="button"
									onClick={() => toggleFavMut.mutate()}
									disabled={toggleFavMut.isPending}
									className="mt-2 p-2 rounded-full border border-line bg-surface cursor-pointer hover:border-primary transition-colors shrink-0"
									aria-label={
										isFavourited ? "Remove from saved" : "Save business"
									}
								>
									<Heart
										size={20}
										className={
											isFavourited
												? "text-red-500 fill-red-500"
												: "text-ink-400"
										}
									/>
								</button>
							)}
						</div>
						<div className="flex items-center gap-1.5 text-ink-500 text-base mb-4">
							<MapPin size={16} />
							{business.city}
							<span className="text-ink-300">·</span>
							<span>{business.category}</span>
						</div>
						<div className="flex items-center gap-2 mb-5">
							<Stars value={avgRating ?? 0} />
							<span className="font-sans text-sm text-ink-500">
								{avgRating != null
									? `${avgRating.toFixed(1)} · ${reviews.length} review${reviews.length !== 1 ? "s" : ""}`
									: "New on Talash"}
							</span>
						</div>
						{business.description && (
							<p className="m-0 mb-7 font-sans text-lg leading-relaxed text-ink-600">
								{business.description}
							</p>
						)}

						{/* Services */}
						{services.length > 0 && (
							<div className="mb-8">
								<h2 className="m-0 mb-4 font-serif font-normal text-2xl text-ink-900">
									Services
								</h2>
								{branches.length > 1
									? branchServices
											.filter((bs) => bs.services.length > 0)
											.map((bs) => (
												<div key={bs.branch.id} className="mb-5">
													<div className="flex items-center gap-1.5 mb-2.5">
														<MapPin size={13} className="text-primary-600" />
														<span className="font-sans text-sm font-semibold text-ink-700">
															{bs.branch.name}
														</span>
													</div>
													<div className="flex flex-col gap-2">
														{bs.services.map((s) => (
															<div
																key={s.id}
																className="flex items-center gap-3 py-3 px-4 bg-surface rounded-lg border border-line"
															>
																{s.photoUrl && (
																	<div className="w-14 h-14 rounded-md overflow-hidden shrink-0 bg-line">
																		<img
																			src={s.photoUrl}
																			alt={s.name}
																			className="w-full h-full object-cover"
																		/>
																	</div>
																)}
																<div className="flex-1 min-w-0">
																	<div className="font-sans font-semibold text-ink-900 text-sm">
																		{s.name}
																	</div>
																	<div className="flex items-center gap-1.5 mt-0.5">
																		<Clock size={12} className="text-ink-400" />
																		<span className="font-sans text-xs text-ink-500">
																			{s.duration} min
																		</span>
																		{s.category && (
																			<>
																				<span className="text-ink-300">·</span>
																				<span className="font-sans text-xs text-ink-500">
																					{s.category}
																				</span>
																			</>
																		)}
																	</div>
																</div>
																<div className="font-sans font-bold text-ink-900 text-sm shrink-0">
																	৳{s.price}
																</div>
															</div>
														))}
													</div>
												</div>
											))
									: (() => {
											const list = branchServices[0]?.services ?? [];
											return (
												<div className="flex flex-col gap-2.5">
													{list.slice(0, 8).map((s) => (
														<div
															key={s.id}
															className="flex items-center gap-3 py-3 px-4 bg-surface rounded-lg border border-line"
														>
															{s.photoUrl && (
																<div className="w-14 h-14 rounded-md overflow-hidden shrink-0 bg-line">
																	<img
																		src={s.photoUrl}
																		alt={s.name}
																		className="w-full h-full object-cover"
																	/>
																</div>
															)}
															<div className="flex-1 min-w-0">
																<div className="font-sans font-semibold text-ink-900 text-sm">
																	{s.name}
																</div>
																<div className="flex items-center gap-1.5 mt-0.5">
																	<Clock size={12} className="text-ink-400" />
																	<span className="font-sans text-xs text-ink-500">
																		{s.duration} min
																	</span>
																	{s.category && (
																		<>
																			<span className="text-ink-300">·</span>
																			<span className="font-sans text-xs text-ink-500">
																				{s.category}
																			</span>
																		</>
																	)}
																</div>
															</div>
															<div className="font-sans font-bold text-ink-900 text-sm shrink-0">
																৳{s.price}
															</div>
														</div>
													))}
													{list.length > 8 && (
														<p className="font-sans text-sm text-ink-500 text-center py-2">
															+{list.length - 8} more services
														</p>
													)}
												</div>
											);
										})()}
							</div>
						)}

						{/* Active offers */}
						{activeCoupons.length > 0 && (
							<div className="mb-8">
								<h2 className="m-0 mb-4 font-serif font-normal text-2xl text-ink-900">
									Active offers
								</h2>
								<div className="flex flex-col gap-2.5">
									{activeCoupons.map((c) => (
										<div
											key={c.id}
											className="flex items-center justify-between py-3 px-4 bg-gold-50 rounded-lg border border-gold-200"
										>
											<div>
												<div className="font-sans font-semibold text-ink-900 text-sm font-mono tracking-wider">
													{c.code}
												</div>
												<div className="font-sans text-xs text-ink-500 mt-0.5">
													Expires{" "}
													{new Date(c.expiresAt).toLocaleDateString("en-BD", {
														dateStyle: "medium",
													})}
												</div>
											</div>
											<div className="font-sans font-bold text-gold-700 text-sm">
												{c.type === "Percentage"
													? `${c.value}% off`
													: `৳${c.value} off`}
											</div>
										</div>
									))}
								</div>
							</div>
						)}

						{/* Reviews */}
						{reviews.length > 0 && (
							<div className="mb-8">
								<h2 className="m-0 mb-4 font-serif font-normal text-2xl text-ink-900">
									Reviews
								</h2>
								<div className="flex flex-col gap-4">
									{reviews.map((r) => (
										<div
											key={r.id}
											className="p-4 bg-surface rounded-lg border border-line"
										>
											<div className="flex items-center justify-between mb-2">
												<div className="flex items-center gap-2">
													<Stars value={r.rating} size={13} />
													<span className="font-sans text-xs font-semibold text-ink-700">
														{r.userName}
													</span>
												</div>
												<span className="font-sans text-xs text-ink-400">
													{new Date(r.createdAt).toLocaleDateString("en-BD", {
														month: "short",
														year: "numeric",
													})}
												</span>
											</div>
											{r.text && (
												<p className="m-0 font-sans text-sm text-ink-700 leading-relaxed">
													{r.text}
												</p>
											)}
										</div>
									))}
								</div>
							</div>
						)}

						{/* Branch hours */}
						{branches.some((b) => (branchHoursMap[b.id]?.length ?? 0) > 0) && (
							<div className="mb-8">
								<h2 className="m-0 mb-4 font-serif font-normal text-2xl text-ink-900">
									Opening hours
								</h2>
								<div className="flex flex-col gap-4">
									{branches.map((b) => {
										const hrs = branchHoursMap[b.id] ?? [];
										if (hrs.length === 0) return null;
										const DAY_SHORT = [
											"Sun",
											"Mon",
											"Tue",
											"Wed",
											"Thu",
											"Fri",
											"Sat",
										];
										return (
											<div key={b.id}>
												{branches.length > 1 && (
													<div className="flex items-center gap-1.5 mb-2">
														<MapPin size={13} className="text-primary-600" />
														<span className="font-sans text-sm font-semibold text-ink-700">
															{b.name}
														</span>
													</div>
												)}
												<div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5">
													{[...hrs]
														.sort((a, c) => a.dayOfWeek - c.dayOfWeek)
														.map((h) => (
															<div
																key={h.dayOfWeek}
																className="flex items-center justify-between gap-2"
															>
																<span className="font-sans text-xs text-ink-500 w-8">
																	{DAY_SHORT[h.dayOfWeek]}
																</span>
																{h.isClosed ? (
																	<span className="font-sans text-xs text-ink-400">
																		Closed
																	</span>
																) : (
																	<span className="font-sans text-xs font-medium text-ink-800">
																		{h.openTime?.slice(0, 5)} –{" "}
																		{h.closeTime?.slice(0, 5)}
																	</span>
																)}
															</div>
														))}
												</div>
											</div>
										);
									})}
								</div>
							</div>
						)}

						{/* Location map */}
						{branches[0] && (
							<div>
								<h2 className="m-0 mb-4 font-serif font-normal text-2xl text-ink-900">
									Location
								</h2>
								<MapEmbed
									address={branches[0].address}
									city={branches[0].city}
									lat={branches[0].lat}
									lng={branches[0].lng}
									name={business.name}
								/>
							</div>
						)}
					</div>

					{/* Booking card */}
					<div className="sticky top-20 bg-surface rounded-xl border border-line p-6 md:p-7 shadow-md">
						<div className="font-serif text-2xl font-medium text-ink-900 mb-1.5">
							Book an appointment
						</div>
						<p className="m-0 mb-6 font-sans text-sm leading-relaxed text-ink-500">
							{user
								? `Book ${business.name} instantly with real-time availability.`
								: "Sign in to see availability and book instantly."}
						</p>

						{user ? (
							<>
								<Button
									size="lg"
									icon="Calendar"
									className="w-full"
									onClick={() => router.push(`/book/${id}`)}
								>
									Choose a time
								</Button>
								<div className="flex items-center gap-1.5 mt-4 justify-center">
									<Clock size={14} className="text-ink-400" />
									<span className="font-sans text-xs text-ink-400">
										Instant confirmation
									</span>
								</div>
							</>
						) : (
							<>
								<Link
									href={`/login?next=/businesses/${id}`}
									className="no-underline"
								>
									<Button size="lg" className="w-full">
										Sign in to book
									</Button>
								</Link>
								<div className="flex items-center gap-1.5 mt-4 justify-center">
									<Lock size={14} className="text-ink-400" />
									<span className="font-sans text-xs text-ink-400">
										Instant confirmation after sign-in
									</span>
								</div>
							</>
						)}

						{services.length > 0 && (
							<div className="mt-4 pt-4 border-t border-line-soft">
								<div className="font-sans text-xs text-ink-400 mb-1">
									Starting from
								</div>
								<div className="font-sans font-bold text-ink-900 text-lg">
									৳{Math.min(...services.map((s) => s.price))}
								</div>
							</div>
						)}
					</div>
				</div>
			</main>

			{/* Similar businesses */}
			{similarBusinesses.length > 0 && (
				<section className="max-w-[1200px] mx-auto px-4 md:px-8 pb-16 border-t border-line pt-12">
					<h2 className="m-0 mb-6 font-serif font-normal text-2xl text-ink-900">
						More in {business.city}
					</h2>
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
						{similarBusinesses.map((v) => (
							<Link
								key={v.id}
								href={`/businesses/${v.id}`}
								className="no-underline group bg-surface rounded-xl border border-line overflow-hidden hover:shadow-md transition-shadow"
							>
								{v.coverPhotoUrl ? (
									<div style={{ height: 150, overflow: "hidden" }}>
										<img
											src={v.coverPhotoUrl}
											alt={v.name}
											className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
										/>
									</div>
								) : (
									<Photo tone="#e8f5e9" height={150} radius="0" />
								)}
								<div className="p-4">
									<div className="font-serif text-base font-medium text-ink-900 group-hover:text-primary-700 transition-colors">
										{v.name}
									</div>
									<div className="flex items-center gap-1.5 text-ink-500 text-xs mt-1">
										<MapPin size={11} />
										{v.city}
										<span className="text-ink-300">·</span>
										{v.category}
									</div>
									<div className="flex items-center gap-1.5 mt-2">
										<Stars value={v.avgRating ?? 0} size={12} />
										<span className="font-sans text-xs text-ink-500">
											{v.avgRating ? v.avgRating.toFixed(1) : "New"}
										</span>
										{v.minPrice != null && (
											<span className="font-sans text-xs text-ink-400 ml-auto">
												from ৳{v.minPrice}
											</span>
										)}
									</div>
								</div>
							</Link>
						))}
					</div>
				</section>
			)}

			<Footer />
		</>
	);
}
