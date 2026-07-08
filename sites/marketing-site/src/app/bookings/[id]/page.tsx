"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Clock, Tag } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { BrandThemeBoundary } from "@/components/BrandThemeBoundary";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { useAuth } from "@/hooks/useAuth";
import { api, tokenStore } from "@/lib/api";

function StatusBadge({ status }: { status: string }) {
	const map: Record<string, string> = {
		Confirmed: "bg-success-bg text-success-fg",
		Cancelled: "bg-danger-bg text-danger-fg",
		Completed: "bg-primary-100 text-primary-800",
		Pending: "bg-surface border border-line text-ink-500",
	};
	return (
		<span
			className={[
				"text-xs font-semibold px-2.5 py-1 rounded-full",
				map[status] ?? map.Pending,
			].join(" ")}
		>
			{status}
		</span>
	);
}

export default function BookingDetailPage() {
	const { id } = useParams<{ id: string }>();
	const router = useRouter();
	const qc = useQueryClient();
	const { user, isLoading: authLoading } = useAuth();

	useEffect(() => {
		if (!authLoading && !user && !tokenStore.getAccessToken()) {
			router.replace(`/login?next=/bookings/${id}`);
		}
	}, [user, authLoading, id, router]);

	const bookingQuery = useQuery({
		queryKey: ["booking", id],
		queryFn: () => api.bookings.get(id),
		enabled: !!user && !!id,
		staleTime: 30_000,
	});

	const cancelMut = useMutation({
		mutationFn: () => api.bookings.cancel(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["booking", id] });
			qc.invalidateQueries({ queryKey: ["my-bookings"] });
		},
	});

	const booking = bookingQuery.data?.data;

	const businessQuery = useQuery({
		queryKey: ["business", booking?.businessId],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!booking?.businessId
		queryFn: () => api.businesses.get(booking?.businessId!),
		enabled: !!booking?.businessId,
		staleTime: 300_000,
	});

	const serviceQuery = useQuery({
		queryKey: ["service", booking?.serviceId],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!booking?.serviceId
		queryFn: () => api.services.get(booking?.serviceId!),
		enabled: !!booking?.serviceId,
		staleTime: 300_000,
	});

	// Single-tenant: wrap the booking detail in the venue's brand boundary
	// (mirrors the detail page #65). `null` (booking/business not yet loaded) →
	// Talash defaults. Scoped to this route — no cross-venue leak.
	const palette = businessQuery.data?.data?.brandPalette ?? null;

	if (authLoading || bookingQuery.isLoading) {
		return (
			<BrandThemeBoundary palette={palette}>
				<Nav />
				<main className="max-w-150 mx-auto px-4 md:px-8 py-12">
					<div className="h-48 rounded-xl bg-line animate-pulse" />
				</main>
				<Footer />
			</BrandThemeBoundary>
		);
	}

	if (!booking) {
		return (
			<BrandThemeBoundary palette={palette}>
				<Nav />
				<main className="max-w-150 mx-auto px-4 md:px-8 py-12 text-center">
					<p className="font-sans text-ink-500">Booking not found.</p>
					<Link
						href="/account"
						className="font-sans text-sm font-medium text-primary-700 no-underline mt-4 inline-block"
					>
						← Back to account
					</Link>
				</main>
				<Footer />
			</BrandThemeBoundary>
		);
	}

	const slot = new Date(booking.slot);
	const canCancel =
		booking.status === "Pending" || booking.status === "Confirmed";

	return (
		<BrandThemeBoundary palette={palette}>
			<Nav />
			<main className="max-w-150 mx-auto px-4 md:px-8 py-10 md:py-14">
				<Link
					href="/account"
					className="flex items-center gap-1.5 font-sans text-sm text-ink-500 hover:text-ink-900 no-underline mb-6"
				>
					<ArrowLeft size={15} />
					Back to account
				</Link>

				<div className="bg-surface rounded-xl border border-line overflow-hidden">
					<div className="px-6 py-5 border-b border-line flex items-center justify-between gap-4">
						<div>
							<h1 className="m-0 font-serif text-2xl font-medium text-ink-900">
								{serviceQuery.data?.data?.name ?? "Booking"}
							</h1>
							{businessQuery.data?.data && (
								<Link
									href={`/businesses/${booking.businessId}`}
									className="font-sans text-sm text-primary-700 no-underline hover:underline"
								>
									{businessQuery.data.data.name}
								</Link>
							)}
						</div>
						<StatusBadge status={booking.status} />
					</div>

					<div className="px-6 py-5 flex flex-col gap-4">
						<div className="flex items-start gap-3">
							<Calendar
								size={18}
								className="text-primary-700 mt-0.5 shrink-0"
							/>
							<div>
								<div className="font-sans text-sm font-semibold text-ink-900">
									{slot.toLocaleDateString("en-BD", {
										weekday: "long",
										day: "numeric",
										month: "long",
										year: "numeric",
									})}
								</div>
								<div className="font-sans text-xs text-ink-400 mt-0.5">
									Date
								</div>
							</div>
						</div>

						<div className="flex items-start gap-3">
							<Clock size={18} className="text-primary-700 mt-0.5 shrink-0" />
							<div>
								<div className="font-sans text-sm font-semibold text-ink-900">
									{slot.toLocaleTimeString("en-BD", {
										hour: "2-digit",
										minute: "2-digit",
									})}
								</div>
								<div className="font-sans text-xs text-ink-400 mt-0.5">
									Time
								</div>
							</div>
						</div>

						<div className="flex items-start gap-3">
							<Tag size={18} className="text-primary-700 mt-0.5 shrink-0" />
							<div>
								<div className="font-sans text-sm font-semibold text-ink-900">
									৳{booking.price}
									{booking.discount > 0 && (
										<span className="ml-1.5 text-success-fg">
											(-৳{booking.discount})
										</span>
									)}
								</div>
								<div className="font-sans text-xs text-ink-400 mt-0.5">
									Price
								</div>
							</div>
						</div>

						<div className="font-sans text-xs text-ink-400">
							Booking ID: <span className="font-mono">{booking.id}</span>
						</div>
					</div>

					{canCancel && (
						<div className="px-6 py-4 border-t border-line">
							<button
								type="button"
								onClick={() => {
									if (window.confirm("Cancel this booking?"))
										cancelMut.mutate();
								}}
								disabled={cancelMut.isPending}
								className="font-sans text-sm font-medium text-danger-fg bg-transparent border-none cursor-pointer p-0 hover:underline disabled:opacity-50"
							>
								{cancelMut.isPending ? "Cancelling…" : "Cancel booking"}
							</button>
						</div>
					)}
				</div>
			</main>
			<Footer />
		</BrandThemeBoundary>
	);
}
