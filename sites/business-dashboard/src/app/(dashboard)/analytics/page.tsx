"use client";
import type {
	AnalyticsRange,
	CouponStat,
	PeakSlot,
	ReviewStats,
	StaffStat,
} from "@repo/api-client";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, DollarSign, TrendingUp, Users } from "lucide-react";
import { useState } from "react";
import { money } from "@/components/data";
import { Card, PageHeader, StatCard } from "@/components/primitives";
import { useMyBusiness } from "@/hooks/useOwnerData";
import { api } from "@/lib/api";

// ── simple SVG bar chart ──────────────────────────────────────────────────────

type ChartPoint = { date: string; revenue: number; bookings: number };

function BarChart({
	data,
	valueKey,
	label,
}: {
	data: ChartPoint[];
	valueKey: "revenue" | "bookings";
	label: string;
}) {
	if (!data.length) return null;
	const values = data.map((d) => d[valueKey]);
	const max = Math.max(...values, 1);
	const W = 540;
	const H = 140;
	const barW = Math.max(4, (W / data.length) * 0.6);
	const gap = W / data.length;

	return (
		<svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full" aria-label={label}>
			{data.map((d, i) => {
				const h = Math.max(2, (d[valueKey] / max) * H);
				const x = i * gap + gap / 2 - barW / 2;
				const y = H - h;
				const isLast = i === data.length - 1;
				const isMid = i === Math.floor(data.length / 2);
				return (
					<g key={d.date}>
						<rect
							x={x}
							y={y}
							width={barW}
							height={h}
							rx={2}
							className="fill-primary-600 opacity-80"
						/>
						{(i === 0 || isLast || isMid) && (
							<text
								x={x + barW / 2}
								y={H + 16}
								textAnchor="middle"
								className="fill-ink-400"
								fontSize={9}
							>
								{String(d.date).slice(5)}
							</text>
						)}
					</g>
				);
			})}
		</svg>
	);
}

// ── horizontal bar for earnings breakdowns ───────────────────────────────────

function EarningsBars({
	data,
}: {
	data: { id?: string; name: string; revenue: number; bookings: number }[];
}) {
	if (!data.length)
		return <p className="font-sans text-sm text-ink-400 py-4">No data yet.</p>;
	const max = Math.max(...data.map((d) => d.revenue), 1);
	return (
		<div className="flex flex-col gap-3.5">
			{data.slice(0, 8).map((s) => (
				<div key={s.id ?? s.name}>
					<div className="flex items-center justify-between mb-1">
						<span className="font-sans text-sm text-ink-800 truncate max-w-[60%]">
							{s.name}
						</span>
						<span className="font-sans text-xs font-semibold text-ink-500">
							{money(s.revenue)} · {s.bookings}
						</span>
					</div>
					<div className="h-1.5 bg-line rounded-full overflow-hidden">
						<div
							className="h-full bg-primary-600 rounded-full transition-all duration-500"
							style={{ width: `${(s.revenue / max) * 100}%` }}
						/>
					</div>
				</div>
			))}
		</div>
	);
}

// ── horizontal bar for service stats ─────────────────────────────────────────

function ServiceBars({
	data,
}: {
	data: { name: string; count: number; revenue: number }[];
}) {
	if (!data.length)
		return <p className="font-sans text-sm text-ink-400 py-4">No data yet.</p>;
	const maxCount = Math.max(...data.map((d) => d.count), 1);
	return (
		<div className="flex flex-col gap-3.5">
			{data.slice(0, 6).map((s) => (
				<div key={s.name}>
					<div className="flex items-center justify-between mb-1">
						<span className="font-sans text-sm text-ink-800 truncate max-w-[60%]">
							{s.name}
						</span>
						<span className="font-sans text-xs font-semibold text-ink-500">
							{s.count} · {money(s.revenue)}
						</span>
					</div>
					<div className="h-1.5 bg-line rounded-full overflow-hidden">
						<div
							className="h-full bg-primary-600 rounded-full transition-all duration-500"
							style={{ width: `${(s.count / maxCount) * 100}%` }}
						/>
					</div>
				</div>
			))}
		</div>
	);
}

// ── peak hours heatmap ────────────────────────────────────────────────────────

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function PeakHeatmap({ data }: { data: PeakSlot[] }) {
	if (!data.length)
		return <p className="font-sans text-sm text-ink-400 py-4">No data yet.</p>;
	const maxCount = Math.max(...data.map((d) => d.count), 1);
	// day is "0"=Sun.."6"=Sat, hour is zero-padded "00".."23"
	const byDayHour = new Map(data.map((d) => [`${d.day}-${d.hour}`, d.count]));
	const hours = Array.from({ length: 24 }, (_, i) => i);

	return (
		<div className="overflow-x-auto">
			<div style={{ minWidth: 520 }}>
				{/* Hour axis */}
				<div className="flex mb-1 pl-10">
					{hours.map((h) => (
						<div
							key={h}
							className="flex-1 text-center font-sans text-[9px] text-ink-400"
						>
							{h % 4 === 0 ? `${h}h` : ""}
						</div>
					))}
				</div>
				{DAY_LABELS.map((day, di) => (
					<div key={day} className="flex items-center mb-1">
						<div className="w-10 font-sans text-xs text-ink-500 text-right pr-2 shrink-0">
							{day}
						</div>
						{hours.map((h) => {
							const hStr = String(h).padStart(2, "0");
							const count = byDayHour.get(`${di}-${hStr}`) ?? 0;
							const intensity = count / maxCount;
							return (
								<div
									key={h}
									className="flex-1 aspect-[1.2] rounded-sm mx-px"
									style={{
										background:
											count === 0
												? "var(--color-line-soft)"
												: `rgba(22,101,52,${0.15 + intensity * 0.85})`,
									}}
									title={`${day} ${h}:00 — ${count} bookings`}
								/>
							);
						})}
					</div>
				))}
				<div className="flex items-center gap-2 mt-2 pl-10">
					<span className="font-sans text-xs text-ink-400">Less</span>
					{[0, 0.25, 0.5, 0.75, 1].map((v) => (
						<div
							key={v}
							className="w-4 h-4 rounded-sm"
							style={{
								background:
									v === 0
										? "var(--color-line-soft)"
										: `rgba(22,101,52,${0.15 + v * 0.85})`,
							}}
						/>
					))}
					<span className="font-sans text-xs text-ink-400">More</span>
				</div>
			</div>
		</div>
	);
}

// ── page ──────────────────────────────────────────────────────────────────────

const RANGES: { label: string; value: AnalyticsRange }[] = [
	{ label: "7 days", value: "7" },
	{ label: "30 days", value: "30" },
	{ label: "90 days", value: "90" },
];

export default function AnalyticsPage() {
	const [range, setRange] = useState<AnalyticsRange>("30");
	const businessQ = useMyBusiness();
	const businessId = businessQ.data?.id ?? null;

	const enabled = !!businessId;

	const overviewQ = useQuery({
		queryKey: ["analytics", "overview", businessId, range],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.analytics.overview({ businessId: businessId!, range }),
		enabled,
		staleTime: 60_000,
	});

	const revenueQ = useQuery({
		queryKey: ["analytics", "revenue", businessId, range],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.analytics.revenue({ businessId: businessId!, range }),
		enabled,
		staleTime: 60_000,
	});

	const servicesQ = useQuery({
		queryKey: ["analytics", "services", businessId, range],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.analytics.services({ businessId: businessId!, range }),
		enabled,
		staleTime: 60_000,
	});

	const peakQ = useQuery({
		queryKey: ["analytics", "peak", businessId, range],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.analytics.peak({ businessId: businessId!, range }),
		enabled,
		staleTime: 60_000,
	});

	const reviewsQ = useQuery({
		queryKey: ["analytics", "reviews", businessId, range],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.analytics.reviews({ businessId: businessId!, range }),
		enabled,
		staleTime: 60_000,
	});

	const couponsQ = useQuery({
		queryKey: ["analytics", "coupons", businessId, range],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.analytics.coupons({ businessId: businessId!, range }),
		enabled,
		staleTime: 60_000,
	});

	const staffQ = useQuery({
		queryKey: ["analytics", "staff", businessId, range],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.analytics.staff({ businessId: businessId!, range }),
		enabled,
		staleTime: 60_000,
	});

	const earningsQ = useQuery({
		queryKey: ["analytics", "earnings", businessId, range],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.analytics.earnings({ businessId: businessId!, range }),
		enabled,
		staleTime: 60_000,
	});

	const ov = overviewQ.data;
	const revenueData = revenueQ.data ?? [];
	const serviceStats = servicesQ.data ?? [];
	const peakData: PeakSlot[] = peakQ.data ?? [];
	const reviewStats: ReviewStats | undefined = reviewsQ.data;
	const couponStats: CouponStat[] = couponsQ.data?.coupons ?? [];
	const staffStats: StaffStat[] = staffQ.data?.staff ?? [];

	const isLoading = businessQ.isLoading || overviewQ.isLoading;

	return (
		<div>
			<PageHeader
				eyebrow="Insights"
				title="Analytics"
				sub="Revenue, bookings, and service performance over time."
				actions={
					<div className="inline-flex gap-0.5 p-1 bg-primary-50 rounded-md">
						{RANGES.map((r) => (
							<button
								key={r.value}
								type="button"
								onClick={() => setRange(r.value)}
								className={[
									"px-3 py-1.5 rounded-sm border-none cursor-pointer font-sans text-xs font-semibold transition-all",
									range === r.value
										? "bg-surface shadow-xs text-ink-900"
										: "bg-transparent text-ink-500",
								].join(" ")}
							>
								{r.label}
							</button>
						))}
					</div>
				}
			/>

			{/* Stats row */}
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
				{isLoading ? (
					[1, 2, 3, 4].map((i) => (
						<div key={i} className="h-24 rounded-xl bg-line animate-pulse" />
					))
				) : (
					<>
						<StatCard
							label="Revenue"
							value={money(ov?.totalRevenue ?? 0)}
							icon="TrendingUp"
							delta={undefined}
						/>
						<StatCard
							label="Bookings"
							value={String(ov?.totalBookings ?? 0)}
							icon="Calendar"
							delta={undefined}
						/>
						<StatCard
							label="New customers"
							value={String(ov?.newCustomers ?? 0)}
							icon="UserPlus"
							delta={undefined}
						/>
						<StatCard
							label="Avg. booking"
							value={money(ov?.avgBookingValue ?? 0)}
							icon="DollarSign"
							delta={undefined}
						/>
					</>
				)}
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">
				{/* Revenue chart */}
				<Card>
					<div className="flex items-center justify-between mb-4">
						<h3 className="m-0 font-sans text-base font-bold text-ink-900 flex items-center gap-2">
							<TrendingUp size={16} className="text-primary-600" />
							Revenue over time
						</h3>
					</div>
					{revenueQ.isLoading ? (
						<div className="h-[164px] rounded-lg bg-line animate-pulse" />
					) : revenueData.length === 0 ? (
						<div className="h-[164px] flex items-center justify-center text-ink-400 text-sm">
							No revenue data yet.
						</div>
					) : (
						<BarChart
							data={revenueData}
							valueKey="revenue"
							label="Revenue chart"
						/>
					)}
				</Card>

				{/* Bookings chart */}
				<Card>
					<div className="flex items-center justify-between mb-4">
						<h3 className="m-0 font-sans text-base font-bold text-ink-900 flex items-center gap-2">
							<Calendar size={16} className="text-primary-600" />
							Daily bookings
						</h3>
					</div>
					{revenueQ.isLoading ? (
						<div className="h-[164px] rounded-lg bg-line animate-pulse" />
					) : revenueData.length === 0 ? (
						<div className="h-[164px] flex items-center justify-center text-ink-400 text-sm">
							No bookings data yet.
						</div>
					) : (
						<BarChart
							data={revenueData}
							valueKey="bookings"
							label="Bookings chart"
						/>
					)}
				</Card>

				{/* Top services */}
				<Card>
					<h3 className="m-0 mb-4 font-sans text-base font-bold text-ink-900 flex items-center gap-2">
						<DollarSign size={16} className="text-primary-600" />
						Top services
					</h3>
					{servicesQ.isLoading ? (
						<div className="flex flex-col gap-3">
							{[1, 2, 3].map((i) => (
								<div key={i} className="h-8 rounded-md bg-line animate-pulse" />
							))}
						</div>
					) : (
						<ServiceBars data={serviceStats} />
					)}
				</Card>

				{/* Booking breakdown */}
				<Card>
					<h3 className="m-0 mb-4 font-sans text-base font-bold text-ink-900 flex items-center gap-2">
						<Users size={16} className="text-primary-600" />
						Booking breakdown
					</h3>
					{isLoading ? (
						<div className="flex flex-col gap-3">
							{[1, 2, 3].map((i) => (
								<div key={i} className="h-6 rounded-md bg-line animate-pulse" />
							))}
						</div>
					) : !ov ? (
						<p className="font-sans text-sm text-ink-400">No data yet.</p>
					) : (
						<div className="flex flex-col gap-3">
							{[
								{
									label: "Completed",
									value: ov.completedBookings,
									color: "bg-success",
								},
								{
									label: "Pending",
									value: ov.pendingBookings,
									color: "bg-gold-500",
								},
								{
									label: "Cancelled",
									value: ov.cancelledBookings,
									color: "bg-danger",
								},
							].map(({ label, value, color }) => {
								const pct = ov.totalBookings
									? Math.round((value / ov.totalBookings) * 100)
									: 0;
								return (
									<div key={label}>
										<div className="flex justify-between mb-1">
											<span className="font-sans text-sm text-ink-700">
												{label}
											</span>
											<span className="font-sans text-xs text-ink-500">
												{value} ({pct}%)
											</span>
										</div>
										<div className="h-1.5 bg-line rounded-full overflow-hidden">
											<div
												className={`h-full ${color} rounded-full`}
												style={{ width: `${pct}%` }}
											/>
										</div>
									</div>
								);
							})}
							<div className="pt-1 border-t border-line-soft mt-1 flex justify-between font-sans text-sm">
								<span className="text-ink-500">Returning customers</span>
								<span className="font-semibold text-ink-900">
									{ov.returningCustomers}
								</span>
							</div>
						</div>
					)}
				</Card>
			</div>

			{/* Peak hours heatmap */}
			<Card className="mt-5">
				<h3 className="m-0 mb-4 font-sans text-base font-bold text-ink-900 flex items-center gap-2">
					<Clock size={16} className="text-primary-600" />
					Peak booking hours
				</h3>
				{peakQ.isLoading ? (
					<div className="h-40 rounded-lg bg-line animate-pulse" />
				) : (
					<PeakHeatmap data={peakData} />
				)}
			</Card>

			{/* Reviews, Coupons, Staff row */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-5">
				{/* Review stats */}
				<Card>
					<h3 className="m-0 mb-4 font-sans text-base font-bold text-ink-900 flex items-center gap-2">
						<TrendingUp size={16} className="text-primary-600" />
						Review stats
					</h3>
					{reviewsQ.isLoading ? (
						<div className="h-24 rounded-lg bg-line animate-pulse" />
					) : !reviewStats || reviewStats.totalReviews === 0 ? (
						<p className="font-sans text-sm text-ink-400">No reviews yet.</p>
					) : (
						<div className="flex flex-col gap-3">
							<div className="flex justify-between items-baseline">
								<span className="font-sans text-sm text-ink-500">
									Avg. rating
								</span>
								<span className="font-serif text-2xl font-medium text-ink-900">
									{reviewStats.avgRating.toFixed(1)} ★
								</span>
							</div>
							<div className="flex justify-between">
								<span className="font-sans text-sm text-ink-500">
									Total reviews
								</span>
								<span className="font-sans text-sm font-semibold text-ink-900">
									{reviewStats.totalReviews}
								</span>
							</div>
							<div className="flex flex-col gap-1.5 mt-1">
								{[5, 4, 3, 2, 1].map((r) => {
									const count =
										reviewStats.ratingDistribution.find((d) => d.rating === r)
											?.count ?? 0;
									const pct = reviewStats.totalReviews
										? Math.round((count / reviewStats.totalReviews) * 100)
										: 0;
									return (
										<div key={r} className="flex items-center gap-2">
											<span className="font-sans text-xs text-ink-500 w-4 text-right shrink-0">
												{r}★
											</span>
											<div className="flex-1 h-1.5 bg-line rounded-full overflow-hidden">
												<div
													className="h-full bg-gold-500 rounded-full"
													style={{ width: `${pct}%` }}
												/>
											</div>
											<span className="font-sans text-xs text-ink-400 w-6 text-right shrink-0">
												{count}
											</span>
										</div>
									);
								})}
							</div>
						</div>
					)}
				</Card>

				{/* Coupon stats */}
				<Card>
					<h3 className="m-0 mb-4 font-sans text-base font-bold text-ink-900 flex items-center gap-2">
						<DollarSign size={16} className="text-primary-600" />
						Coupon redemptions
					</h3>
					{couponsQ.isLoading ? (
						<div className="h-24 rounded-lg bg-line animate-pulse" />
					) : couponStats.length === 0 ? (
						<p className="font-sans text-sm text-ink-400">
							No coupon usage yet.
						</p>
					) : (
						<div className="flex flex-col gap-3">
							{couponStats.map((c) => (
								<div
									key={c.couponId}
									className="flex items-center justify-between py-1 border-b border-line-soft last:border-0"
								>
									<div>
										<div className="font-sans text-sm font-semibold text-ink-900">
											{c.code}
										</div>
										<div className="font-sans text-xs text-ink-500">
											{c.redemptions} use{c.redemptions !== 1 ? "s" : ""}
										</div>
									</div>
									<div className="font-sans text-sm font-semibold text-ink-700">
										-{money(c.totalDiscount)}
									</div>
								</div>
							))}
						</div>
					)}
				</Card>

				{/* Staff performance */}
				<Card>
					<h3 className="m-0 mb-4 font-sans text-base font-bold text-ink-900 flex items-center gap-2">
						<Users size={16} className="text-primary-600" />
						Staff performance
					</h3>
					{staffQ.isLoading ? (
						<div className="h-24 rounded-lg bg-line animate-pulse" />
					) : staffStats.length === 0 ? (
						<p className="font-sans text-sm text-ink-400">No staff data yet.</p>
					) : (
						<div className="flex flex-col gap-3">
							{staffStats.map((s) => (
								<div
									key={s.teamMemberId}
									className="flex items-center justify-between py-1 border-b border-line-soft last:border-0"
								>
									<div>
										<div className="font-sans text-sm font-semibold text-ink-900">
											{s.name}
										</div>
										<div className="font-sans text-xs text-ink-500">
											{s.bookings} completed
										</div>
									</div>
									<div className="font-sans text-sm font-semibold text-ink-700">
										{money(s.revenue)}
									</div>
								</div>
							))}
						</div>
					)}
				</Card>
			</div>

			{/* Earnings section */}
			<div className="mt-5">
				<h2 className="font-sans text-lg font-semibold text-ink-900 mb-4">
					Earnings
				</h2>
				<div className="mb-4">
					<StatCard
						label="Total earnings"
						value={money(earningsQ.data?.total ?? 0)}
						icon="DollarSign"
					/>
				</div>
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
					<Card>
						<h3 className="m-0 mb-4 font-sans text-base font-bold text-ink-900 flex items-center gap-2">
							<Users size={16} className="text-primary-600" />
							By staff
						</h3>
						{earningsQ.isLoading ? (
							<div className="flex flex-col gap-3">
								{[1, 2, 3].map((i) => (
									<div
										key={i}
										className="h-8 rounded-md bg-line animate-pulse"
									/>
								))}
							</div>
						) : (
							<EarningsBars
								data={(earningsQ.data?.byStaff ?? []).map((s) => ({
									...s,
									id: s.teamMemberId ?? "unassigned",
								}))}
							/>
						)}
					</Card>
					<Card>
						<h3 className="m-0 mb-4 font-sans text-base font-bold text-ink-900 flex items-center gap-2">
							<DollarSign size={16} className="text-primary-600" />
							By service
						</h3>
						{earningsQ.isLoading ? (
							<div className="flex flex-col gap-3">
								{[1, 2, 3].map((i) => (
									<div
										key={i}
										className="h-8 rounded-md bg-line animate-pulse"
									/>
								))}
							</div>
						) : (
							<EarningsBars
								data={(earningsQ.data?.byService ?? []).map((s) => ({
									...s,
									id: s.serviceId,
								}))}
							/>
						)}
					</Card>
					<Card>
						<h3 className="m-0 mb-4 font-sans text-base font-bold text-ink-900 flex items-center gap-2">
							<TrendingUp size={16} className="text-primary-600" />
							By branch
						</h3>
						{earningsQ.isLoading ? (
							<div className="flex flex-col gap-3">
								{[1, 2, 3].map((i) => (
									<div
										key={i}
										className="h-8 rounded-md bg-line animate-pulse"
									/>
								))}
							</div>
						) : (
							<EarningsBars
								data={(earningsQ.data?.byBranch ?? []).map((s) => ({
									...s,
									id: s.branchId,
								}))}
							/>
						)}
					</Card>
				</div>
				<Card>
					<h3 className="m-0 mb-4 font-sans text-base font-bold text-ink-900 flex items-center gap-2">
						<TrendingUp size={16} className="text-primary-600" />
						Earnings over time
					</h3>
					{earningsQ.isLoading ? (
						<div className="h-[164px] rounded-lg bg-line animate-pulse" />
					) : (earningsQ.data?.overTime ?? []).length === 0 ? (
						<div className="h-[164px] flex items-center justify-center text-ink-400 text-sm">
							No earnings data yet.
						</div>
					) : (
						<BarChart
							data={earningsQ.data?.overTime ?? []}
							valueKey="revenue"
							label="Earnings over time"
						/>
					)}
				</Card>
			</div>
		</div>
	);
}
