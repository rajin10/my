"use client";
import type { Booking } from "@repo/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Star, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { partitionBookings } from "./partition-bookings";

type Tab = "upcoming" | "past";

export function BookingsSection() {
	const qc = useQueryClient();
	const { user } = useAuth();
	const [tab, setTab] = useState<Tab>("upcoming");
	const [reviewingId, setReviewingId] = useState<string | null>(null);
	const [reviewRating, setReviewRating] = useState(0);
	const [reviewText, setReviewText] = useState("");

	const { data: bookingsResult } = useQuery({
		queryKey: ["my-bookings"],
		queryFn: () => api.bookings.list(),
		enabled: !!user,
		staleTime: 60_000,
	});

	const cancelMut = useMutation({
		mutationFn: (id: string) => api.bookings.cancel(id),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["my-bookings"] }),
	});

	const reviewMut = useMutation({
		mutationFn: (b: Booking) =>
			api.reviews.create({
				businessId: b.businessId,
				serviceId: b.serviceId,
				bookingId: b.id,
				rating: reviewRating,
				text: reviewText,
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["my-bookings"] });
			// also refresh the "My reviews" section so a just-submitted review shows
			qc.invalidateQueries({ queryKey: ["my-reviews"] });
			setReviewingId(null);
			setReviewRating(0);
			setReviewText("");
		},
	});

	const bookings: Booking[] = bookingsResult?.data ?? [];
	const { upcoming, past } = partitionBookings(bookings);
	const shown = tab === "upcoming" ? upcoming : past;

	return (
		<div className="bg-surface rounded-xl border border-line overflow-hidden">
			<div className="flex items-center gap-2.5 px-6 py-4 border-b border-line">
				<Calendar size={18} className="text-primary-700" />
				<h2 className="m-0 font-serif font-medium text-xl text-ink-900">
					My bookings
				</h2>
				<div className="ml-auto flex items-center gap-1">
					{(["upcoming", "past"] as const).map((t) => (
						<button
							key={t}
							type="button"
							onClick={() => setTab(t)}
							className={[
								"font-sans text-xs font-semibold px-3 py-1 rounded-full cursor-pointer border",
								tab === t
									? "bg-primary-700 text-white border-primary-700"
									: "bg-surface text-ink-500 border-line hover:text-ink-900",
							].join(" ")}
						>
							{t === "upcoming" ? "Upcoming" : "Past"}
						</button>
					))}
				</div>
			</div>

			{shown.length === 0 ? (
				<div className="px-6 py-12 text-center">
					<div className="text-4xl mb-4">📅</div>
					<p className="font-sans text-ink-500 text-sm m-0 mb-4">
						{tab === "upcoming"
							? "You have no upcoming bookings."
							: "You have no past bookings."}
					</p>
					<Link
						href="/"
						className="no-underline font-sans text-sm font-semibold text-primary-700"
					>
						Find a business →
					</Link>
				</div>
			) : (
				<div>
					{shown.map((b, i) => (
						<div
							key={b.id}
							className={[
								"px-6 py-4",
								i ? "border-t border-line-soft" : "",
							].join(" ")}
						>
							<div className="flex items-center justify-between gap-4">
								<div>
									<Link
										href={`/bookings/${b.id}`}
										className="font-sans text-sm font-semibold text-ink-900 hover:text-primary-700 no-underline"
									>
										{new Date(b.slot).toLocaleString("en-BD", {
											dateStyle: "medium",
											timeStyle: "short",
										})}
									</Link>
									<div className="font-sans text-xs text-ink-500 mt-0.5">
										৳{b.price}
										{b.discount > 0 && (
											<span className="ml-1 text-success-fg">
												(-৳{b.discount})
											</span>
										)}
									</div>
								</div>
								<div className="flex items-center gap-3">
									{(b.status === "Pending" || b.status === "Confirmed") && (
										<button
											type="button"
											onClick={() => cancelMut.mutate(b.id)}
											disabled={cancelMut.isPending}
											className="font-sans text-xs font-medium text-danger-fg bg-danger-bg border border-danger-fg/20 rounded-md px-2.5 py-1 cursor-pointer hover:bg-danger-fg/10 disabled:opacity-50"
										>
											Cancel
										</button>
									)}
									<span
										className={[
											"text-xs font-semibold px-2.5 py-0.5 rounded-full",
											b.status === "Confirmed"
												? "bg-success-bg text-success-fg"
												: b.status === "Cancelled"
													? "bg-danger-bg text-danger-fg"
													: b.status === "Completed"
														? "bg-primary-100 text-primary-800"
														: "bg-surface border border-line text-ink-500",
										].join(" ")}
									>
										{b.status}
									</span>
								</div>
							</div>

							{b.status === "Completed" && reviewingId !== b.id && (
								<button
									type="button"
									onClick={() => {
										setReviewingId(b.id);
										setReviewRating(0);
										setReviewText("");
									}}
									className="mt-2 font-sans text-xs font-medium text-primary-700 bg-transparent border-none cursor-pointer p-0 flex items-center gap-1"
								>
									<Star size={12} />
									Leave a review
								</button>
							)}

							{reviewingId === b.id && (
								<div className="mt-3 bg-primary-50 border border-primary-200 rounded-lg p-4">
									<div className="flex items-center justify-between mb-3">
										<span className="font-sans text-sm font-semibold text-ink-900">
											Rate your experience
										</span>
										<button
											type="button"
											onClick={() => setReviewingId(null)}
											className="text-ink-400 bg-transparent border-none cursor-pointer p-0"
										>
											<X size={16} />
										</button>
									</div>
									<div className="flex gap-1 mb-3">
										{[1, 2, 3, 4, 5].map((n) => (
											<button
												key={n}
												type="button"
												onClick={() => setReviewRating(n)}
												className="bg-transparent border-none cursor-pointer p-0"
											>
												<Star
													size={24}
													className={
														n <= reviewRating
															? "fill-yellow-400 text-yellow-400"
															: "text-ink-300"
													}
												/>
											</button>
										))}
									</div>
									<textarea
										rows={3}
										value={reviewText}
										onChange={(e) => setReviewText(e.target.value)}
										placeholder="Tell us about your visit…"
										className="w-full px-3 py-2 border border-line rounded-md font-sans text-sm text-ink-900 bg-surface resize-none outline-none focus:border-primary-500"
									/>
									{reviewMut.isError && (
										<p className="font-sans text-xs text-danger-fg mt-1 m-0">
											{(reviewMut.error as Error).message}
										</p>
									)}
									<button
										type="button"
										onClick={() => reviewMut.mutate(b)}
										disabled={reviewRating === 0 || reviewMut.isPending}
										className="mt-2 w-full font-sans text-sm font-semibold text-white bg-primary-700 rounded-md px-4 py-2 cursor-pointer border-none hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										{reviewMut.isPending ? "Submitting…" : "Submit review"}
									</button>
								</div>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
