"use client";
import type { MyReview } from "@repo/api-client";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import Link from "next/link";
import { Stars } from "@/components/Stars";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";

export function ReviewsSection() {
	const { user } = useAuth();
	const { data } = useQuery({
		queryKey: ["my-reviews"],
		queryFn: () => api.reviews.listMine(),
		enabled: !!user,
		staleTime: 60_000,
	});
	const reviews: MyReview[] = data ?? [];

	// Mirror the other optional sections (notifications, favourites): render
	// nothing when there's no content.
	if (reviews.length === 0) return null;

	return (
		<div className="bg-surface rounded-xl border border-line overflow-hidden mt-6">
			<div className="flex items-center gap-2.5 px-6 py-4 border-b border-line">
				<Star size={18} className="text-primary-700" />
				<h2 className="m-0 font-serif font-medium text-xl text-ink-900">
					My reviews
				</h2>
			</div>
			<div>
				{reviews.map((r, i) => (
					<div
						key={r.id}
						className={["px-6 py-4", i ? "border-t border-line-soft" : ""].join(
							" ",
						)}
					>
						<div className="flex items-center justify-between gap-3">
							<Link
								href={`/businesses/${r.businessId}`}
								className="font-sans text-sm font-semibold text-ink-900 hover:text-primary-700 no-underline"
							>
								{r.businessName}
							</Link>
							<div className="flex items-center gap-2">
								<Stars value={r.rating} size={14} />
								{r.status === "Pending" && (
									<span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface border border-line text-ink-500">
										Awaiting approval
									</span>
								)}
							</div>
						</div>
						<div className="font-sans text-xs text-ink-400 mt-0.5">
							{r.serviceName}
						</div>
						<p className="font-sans text-sm text-ink-700 mt-1.5 m-0">
							{r.text}
						</p>
						<div className="font-sans text-xs text-ink-400 mt-1">
							{new Date(r.createdAt).toLocaleDateString("en-BD", {
								day: "numeric",
								month: "short",
								year: "numeric",
							})}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
