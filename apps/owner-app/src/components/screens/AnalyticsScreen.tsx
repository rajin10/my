import type {
	AnalyticsRange,
	CouponStat,
	ReviewStats,
	StaffStat,
} from "@repo/api-client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../context";
import { money } from "../../data";
import { api } from "../../lib/api";
import { Colors, Shadow } from "../../tokens";
import {
	BackHeader,
	Card,
	Eyebrow,
	FilterTabs,
	Icon,
	type IconName,
} from "../ui";

const RANGES: Array<{ id: AnalyticsRange; label: string }> = [
	{ id: "7", label: "7 days" },
	{ id: "30", label: "30 days" },
	{ id: "90", label: "90 days" },
];

function KpiCard({
	label,
	value,
	sub,
	icon,
	accent,
}: {
	label: string;
	value: string;
	sub?: string;
	icon: string;
	accent?: string;
}) {
	return (
		<View
			className="flex-1 min-w-0 border border-line rounded-lg bg-surface"
			style={{ padding: 14, ...Shadow.sm }}
		>
			<View className="flex-row items-center justify-between">
				<Text
					style={{ fontSize: 11.5, fontWeight: "600", color: Colors.ink500 }}
				>
					{label}
				</Text>
				<Icon
					name={icon as IconName}
					size={16}
					color={accent || Colors.primary600}
				/>
			</View>
			<Text
				className="mt-2 font-light"
				style={{ fontSize: 26, letterSpacing: -0.5, color: Colors.ink900 }}
			>
				{value}
			</Text>
			{sub ? (
				<Text className="mt-1" style={{ fontSize: 12, color: Colors.ink400 }}>
					{sub}
				</Text>
			) : null}
		</View>
	);
}

function RevenueBars({
	points,
}: {
	points: { date: string; revenue: number }[];
}) {
	if (points.length === 0) return null;
	const maxRev = Math.max(...points.map((p) => p.revenue), 1);
	const H = 72;
	return (
		<View className="flex-row items-end mt-3" style={{ gap: 3, height: H }}>
			{points.map((p) => {
				const barH = Math.max(4, (p.revenue / maxRev) * H);
				return (
					<View
						key={p.date}
						className="flex-1 rounded-sm"
						style={{ height: barH, backgroundColor: Colors.primary400 }}
					/>
				);
			})}
		</View>
	);
}

function EarningsBars({
	data,
}: {
	data: { id?: string; name: string; revenue: number; bookings: number }[];
}) {
	if (data.length === 0)
		return (
			<Text style={{ fontSize: 13, color: Colors.ink400, paddingVertical: 8 }}>
				No data yet.
			</Text>
		);
	const max = Math.max(...data.map((d) => d.revenue), 1);
	return (
		<View style={{ gap: 12 }}>
			{data.slice(0, 8).map((s) => (
				<View key={s.id ?? s.name}>
					<View
						className="flex-row items-center justify-between"
						style={{ marginBottom: 4 }}
					>
						<Text
							numberOfLines={1}
							style={{
								fontSize: 13,
								color: Colors.ink800,
								flex: 1,
								marginRight: 8,
							}}
						>
							{s.name}
						</Text>
						<Text
							style={{ fontSize: 11, fontWeight: "600", color: Colors.ink500 }}
						>
							{money(s.revenue)} · {s.bookings}
						</Text>
					</View>
					<View
						style={{
							height: 6,
							backgroundColor: Colors.line,
							borderRadius: 999,
							overflow: "hidden",
						}}
					>
						<View
							style={{
								height: 6,
								width: `${(s.revenue / max) * 100}%`,
								backgroundColor: Colors.primary600,
								borderRadius: 999,
							}}
						/>
					</View>
				</View>
			))}
		</View>
	);
}

function PeakHeatmap({
	slots,
}: {
	slots: { day: string; hour: string; count: number }[];
}) {
	const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	const HOURS = ["9", "10", "11", "12", "13", "14", "15", "16", "17", "18"];
	const maxCount = Math.max(...slots.map((s) => s.count), 1);
	const getCount = (d: number, h: number) =>
		slots.find((s) => Number(s.day) === d && Number(s.hour) === h)?.count ?? 0;

	return (
		<View>
			{/* Hour header */}
			<View className="flex-row mb-1" style={{ marginLeft: 32 }}>
				{HOURS.map((h) => (
					<Text
						key={h}
						className="text-center"
						style={{ width: 28, fontSize: 9, color: Colors.ink400 }}
					>
						{h}
					</Text>
				))}
			</View>
			{DAYS.map((day, d) => (
				<View key={day} className="flex-row items-center mb-1">
					<Text
						className="font-semibold"
						style={{ width: 28, fontSize: 10, color: Colors.ink500 }}
					>
						{day}
					</Text>
					{HOURS.map((h) => {
						const count = getCount(d, Number(h));
						const opacity = count > 0 ? 0.2 + (count / maxCount) * 0.8 : 0.06;
						return (
							<View
								key={h}
								style={{
									width: 22,
									height: 20,
									marginHorizontal: 3,
									borderRadius: 4,
									backgroundColor: Colors.primary500,
									opacity,
								}}
							/>
						);
					})}
				</View>
			))}
		</View>
	);
}

export default function AnalyticsScreen() {
	const insets = useSafeAreaInsets();
	const { businessId } = useApp();
	const [range, setRange] = useState<AnalyticsRange>("30");

	const overviewQ = useQuery({
		queryKey: ["analytics", "overview", businessId, range],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.analytics.overview({ businessId: businessId!, range }),
		enabled: !!businessId,
		staleTime: 60_000,
	});

	const revenueQ = useQuery({
		queryKey: ["analytics", "revenue", businessId, range],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.analytics.revenue({ businessId: businessId!, range }),
		enabled: !!businessId,
		staleTime: 60_000,
	});

	const servicesQ = useQuery({
		queryKey: ["analytics", "services", businessId, range],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.analytics.services({ businessId: businessId!, range }),
		enabled: !!businessId,
		staleTime: 60_000,
	});

	const peakQ = useQuery({
		queryKey: ["analytics", "peak", businessId, range],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.analytics.peak({ businessId: businessId!, range }),
		enabled: !!businessId,
		staleTime: 60_000,
	});

	const reviewsQ = useQuery({
		queryKey: ["analytics", "reviews", businessId, range],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.analytics.reviews({ businessId: businessId!, range }),
		enabled: !!businessId,
		staleTime: 60_000,
	});

	const couponsQ = useQuery({
		queryKey: ["analytics", "coupons", businessId, range],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.analytics.coupons({ businessId: businessId!, range }),
		enabled: !!businessId,
		staleTime: 60_000,
	});

	const staffQ = useQuery({
		queryKey: ["analytics", "staff", businessId, range],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.analytics.staff({ businessId: businessId!, range }),
		enabled: !!businessId,
		staleTime: 60_000,
	});

	const earningsQ = useQuery({
		queryKey: ["analytics", "earnings", businessId, range],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.analytics.earnings({ businessId: businessId!, range }),
		enabled: !!businessId,
		staleTime: 60_000,
	});

	const ov = overviewQ.data;
	const rev = revenueQ.data ?? [];
	const svcs = servicesQ.data ?? [];
	const peak = peakQ.data ?? [];
	const reviewStats: ReviewStats | undefined = reviewsQ.data;
	const couponStats: CouponStat[] = couponsQ.data?.coupons ?? [];
	const staffStats: StaffStat[] = staffQ.data?.staff ?? [];
	const earnings = earningsQ.data;

	return (
		<View className="flex-1 bg-paper">
			<BackHeader title="Analytics" topInset={insets.top} />

			<FilterTabs
				tabs={RANGES.map((r) => ({ id: r.id, label: r.label }))}
				active={range}
				onPick={(id) => setRange(id as AnalyticsRange)}
			/>

			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					paddingHorizontal: 16,
					paddingTop: 16,
					paddingBottom: 40,
					gap: 22,
				}}
			>
				{/* KPI row */}
				<View>
					<Eyebrow color={Colors.ink400} style={{ marginBottom: 10 }}>
						Performance
					</Eyebrow>
					<View className="flex-row gap-2.5 mb-2.5">
						<KpiCard
							label="Revenue"
							value={ov ? money(ov.totalRevenue) : "—"}
							sub={ov ? `${ov.completedBookings} completed` : undefined}
							icon="TrendingUp"
						/>
						<KpiCard
							label="Bookings"
							value={ov ? String(ov.totalBookings) : "—"}
							sub={ov ? `${ov.pendingBookings} pending` : undefined}
							icon="Calendar"
							accent={Colors.info}
						/>
					</View>
					<View className="flex-row gap-2.5">
						<KpiCard
							label="Avg booking"
							value={ov ? money(ov.avgBookingValue) : "—"}
							icon="ReceiptText"
						/>
						<KpiCard
							label="Customers"
							value={ov ? String(ov.newCustomers + ov.returningCustomers) : "—"}
							sub={ov ? `${ov.newCustomers} new` : undefined}
							icon="Users"
							accent={Colors.pending}
						/>
					</View>
				</View>

				{/* Revenue trend */}
				{rev.length >= 2 && (
					<Card pad={16}>
						<Text
							className="font-bold"
							style={{ fontSize: 14, color: Colors.ink900 }}
						>
							Revenue trend
						</Text>
						<RevenueBars points={rev} />
						<View className="flex-row justify-between mt-1.5">
							<Text style={{ fontSize: 11, color: Colors.ink400 }}>
								{rev[0]?.date?.slice(5) ?? ""}
							</Text>
							<Text style={{ fontSize: 11, color: Colors.ink400 }}>
								{rev[rev.length - 1]?.date?.slice(5) ?? ""}
							</Text>
						</View>
					</Card>
				)}

				{/* Top services */}
				{svcs.length > 0 && (
					<View>
						<Eyebrow color={Colors.ink400} style={{ marginBottom: 10 }}>
							Top services
						</Eyebrow>
						<Card pad={4}>
							{svcs.slice(0, 6).map((s, i) => {
								const maxCount = svcs[0]?.count ?? 1;
								const barPct = Math.round((s.count / maxCount) * 100);
								return (
									<View
										key={s.serviceId}
										className={i ? "border-t" : ""}
										style={{ padding: 13, borderTopColor: Colors.lineSoft }}
									>
										<View className="flex-row items-center justify-between mb-1.5">
											<Text
												className="flex-1 font-semibold"
												numberOfLines={1}
												style={{ fontSize: 14, color: Colors.ink900 }}
											>
												{s.name}
											</Text>
											<Text
												style={{
													fontSize: 13,
													color: Colors.ink500,
													marginLeft: 8,
												}}
											>
												{s.count} · {money(s.revenue)}
											</Text>
										</View>
										<View
											className="rounded-sm"
											style={{ height: 4, backgroundColor: Colors.lineSoft }}
										>
											<View
												style={{
													width: `${barPct}%`,
													height: "100%",
													borderRadius: 2,
													backgroundColor: Colors.primary400,
												}}
											/>
										</View>
									</View>
								);
							})}
						</Card>
					</View>
				)}

				{/* Peak heatmap */}
				{peak.length > 0 && (
					<View>
						<Eyebrow color={Colors.ink400} style={{ marginBottom: 10 }}>
							Busiest times
						</Eyebrow>
						<Card pad={16}>
							<PeakHeatmap slots={peak} />
						</Card>
					</View>
				)}

				{/* New vs returning */}
				{ov && (ov.newCustomers > 0 || ov.returningCustomers > 0) && (
					<View>
						<Eyebrow color={Colors.ink400} style={{ marginBottom: 10 }}>
							Customers
						</Eyebrow>
						<Card pad={16}>
							<View className="flex-row gap-4">
								<View className="flex-1">
									<Text
										className="font-light"
										style={{
											fontSize: 28,
											letterSpacing: -0.5,
											color: Colors.primary600,
										}}
									>
										{ov.newCustomers}
									</Text>
									<Text
										className="mt-0.5"
										style={{ fontSize: 12.5, color: Colors.ink500 }}
									>
										New customers
									</Text>
								</View>
								<View style={{ width: 1, backgroundColor: Colors.lineSoft }} />
								<View className="flex-1">
									<Text
										className="font-light"
										style={{
											fontSize: 28,
											letterSpacing: -0.5,
											color: Colors.ink900,
										}}
									>
										{ov.returningCustomers}
									</Text>
									<Text
										className="mt-0.5"
										style={{ fontSize: 12.5, color: Colors.ink500 }}
									>
										Returning
									</Text>
								</View>
							</View>
						</Card>
					</View>
				)}

				{/* Review stats */}
				{reviewStats && reviewStats.totalReviews > 0 && (
					<View>
						<Eyebrow color={Colors.ink400} style={{ marginBottom: 10 }}>
							Review stats
						</Eyebrow>
						<Card pad={16}>
							<View className="flex-row justify-between items-baseline mb-3">
								<Text style={{ fontSize: 13, color: Colors.ink500 }}>
									Avg. rating
								</Text>
								<Text
									style={{
										fontSize: 22,
										fontWeight: "300",
										letterSpacing: -0.5,
										color: Colors.ink900,
									}}
								>
									{reviewStats.avgRating.toFixed(1)} ★
								</Text>
							</View>
							{[5, 4, 3, 2, 1].map((r) => {
								const count =
									reviewStats.ratingDistribution.find((d) => d.rating === r)
										?.count ?? 0;
								const pct = reviewStats.totalReviews
									? Math.round((count / reviewStats.totalReviews) * 100)
									: 0;
								return (
									<View
										key={r}
										className="flex-row items-center mb-1.5"
										style={{ gap: 8 }}
									>
										<Text
											style={{
												fontSize: 11,
												color: Colors.ink400,
												width: 20,
												textAlign: "right",
											}}
										>
											{r}★
										</Text>
										<View
											className="flex-1 rounded-sm"
											style={{ height: 6, backgroundColor: Colors.lineSoft }}
										>
											<View
												style={{
													width: `${pct}%`,
													height: "100%",
													borderRadius: 3,
													backgroundColor: Colors.gold500,
												}}
											/>
										</View>
										<Text
											style={{ fontSize: 11, color: Colors.ink400, width: 20 }}
										>
											{count}
										</Text>
									</View>
								);
							})}
						</Card>
					</View>
				)}

				{/* Coupon performance */}
				{couponStats.length > 0 && (
					<View>
						<Eyebrow color={Colors.ink400} style={{ marginBottom: 10 }}>
							Coupon redemptions
						</Eyebrow>
						<Card pad={4}>
							{couponStats.map((c, i) => (
								<View
									key={c.couponId}
									style={{
										flexDirection: "row",
										alignItems: "center",
										justifyContent: "space-between",
										padding: 13,
										borderTopWidth: i ? 1 : 0,
										borderTopColor: Colors.lineSoft,
									}}
								>
									<View>
										<Text
											style={{
												fontSize: 14,
												fontWeight: "600",
												color: Colors.ink900,
											}}
										>
											{c.code}
										</Text>
										<Text
											style={{
												fontSize: 12,
												color: Colors.ink400,
												marginTop: 1,
											}}
										>
											{c.redemptions} use{c.redemptions !== 1 ? "s" : ""}
										</Text>
									</View>
									<Text
										style={{
											fontSize: 14,
											fontWeight: "600",
											color: Colors.ink700,
										}}
									>
										-{money(c.totalDiscount)}
									</Text>
								</View>
							))}
						</Card>
					</View>
				)}

				{/* Staff performance */}
				{staffStats.length > 0 && (
					<View>
						<Eyebrow color={Colors.ink400} style={{ marginBottom: 10 }}>
							Staff performance
						</Eyebrow>
						<Card pad={4}>
							{staffStats.map((s, i) => (
								<View
									key={s.teamMemberId}
									style={{
										flexDirection: "row",
										alignItems: "center",
										justifyContent: "space-between",
										padding: 13,
										borderTopWidth: i ? 1 : 0,
										borderTopColor: Colors.lineSoft,
									}}
								>
									<View>
										<Text
											style={{
												fontSize: 14,
												fontWeight: "600",
												color: Colors.ink900,
											}}
										>
											{s.name}
										</Text>
										<Text
											style={{
												fontSize: 12,
												color: Colors.ink400,
												marginTop: 1,
											}}
										>
											{s.bookings} completed
										</Text>
									</View>
									<Text
										style={{
											fontSize: 14,
											fontWeight: "600",
											color: Colors.ink700,
										}}
									>
										{money(s.revenue)}
									</Text>
								</View>
							))}
						</Card>
					</View>
				)}

				{/* earnings */}
				{(earnings !== undefined || earningsQ.isFetched) && (
					<View>
						<Eyebrow color={Colors.ink400} style={{ marginBottom: 10 }}>
							Earnings
						</Eyebrow>
						<Card pad={16}>
							<Text
								className="font-light"
								style={{
									fontSize: 26,
									letterSpacing: -0.5,
									color: Colors.ink900,
									marginTop: 4,
								}}
							>
								{money(earnings?.total ?? 0)}
							</Text>
							<Text
								style={{
									fontSize: 12,
									color: Colors.ink400,
									marginTop: 8,
									marginBottom: 4,
								}}
							>
								By staff
							</Text>
							<EarningsBars
								data={(earnings?.byStaff ?? []).map((s) => ({
									...s,
									id: s.teamMemberId ?? "unassigned",
								}))}
							/>
							<Text
								style={{
									fontSize: 12,
									color: Colors.ink400,
									marginTop: 12,
									marginBottom: 4,
								}}
							>
								By service
							</Text>
							<EarningsBars
								data={(earnings?.byService ?? []).map((s) => ({
									...s,
									id: s.serviceId,
								}))}
							/>
							<Text
								style={{
									fontSize: 12,
									color: Colors.ink400,
									marginTop: 12,
									marginBottom: 4,
								}}
							>
								By branch
							</Text>
							<EarningsBars
								data={(earnings?.byBranch ?? []).map((s) => ({
									...s,
									id: s.branchId,
								}))}
							/>
							<Text
								style={{
									fontSize: 12,
									color: Colors.ink400,
									marginTop: 12,
									marginBottom: 4,
								}}
							>
								Over time
							</Text>
							{(earnings?.overTime?.length ?? 0) > 0 ? (
								<RevenueBars points={earnings?.overTime ?? []} />
							) : (
								<Text
									style={{
										fontSize: 13,
										color: Colors.ink400,
										paddingVertical: 8,
									}}
								>
									No data yet.
								</Text>
							)}
						</Card>
					</View>
				)}

				{!businessId && (
					<Text
						className="text-center mt-8"
						style={{ fontSize: 14, color: Colors.ink400 }}
					>
						No business data yet.
					</Text>
				)}
			</ScrollView>
		</View>
	);
}
