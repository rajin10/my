import type {
	CustomerSummary,
	CustomerTier,
	CustomerVisit,
} from "@repo/api-client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
	ScrollView,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../context";
import { money } from "../../data";
import { api } from "../../lib/api";
import { Colors, Shadow } from "../../tokens";
import { Avatar, BackHeader, Card, Eyebrow, FilterTabs, Icon } from "../ui";

const TIER_COLORS: Record<
	CustomerTier,
	{ bg: string; fg: string; label: string }
> = {
	VIP: { bg: Colors.gold100, fg: Colors.gold700, label: "VIP" },
	Regular: { bg: Colors.primary100, fg: Colors.primary700, label: "Regular" },
	New: { bg: Colors.infoBg, fg: Colors.infoFg, label: "New" },
	AtRisk: { bg: Colors.dangerBg, fg: Colors.dangerFg, label: "At risk" },
};

function TierBadge({ tier }: { tier: CustomerTier }) {
	const c = TIER_COLORS[tier];
	return (
		<View
			className="rounded-full px-2 py-0.5"
			style={{ backgroundColor: c.bg }}
		>
			<Text className="font-bold" style={{ fontSize: 11.5, color: c.fg }}>
				{c.label}
			</Text>
		</View>
	);
}

function CustomerRow({
	customer,
	onPress,
}: {
	customer: CustomerSummary;
	onPress: () => void;
}) {
	return (
		<TouchableOpacity
			onPress={onPress}
			className="flex-row items-center border-t"
			style={{ gap: 13, padding: 13, borderTopColor: Colors.lineSoft }}
		>
			<Avatar name={customer.name} size={42} />
			<View className="flex-1 min-w-0">
				<Text
					className="font-semibold"
					numberOfLines={1}
					style={{ fontSize: 15, color: Colors.ink900 }}
				>
					{customer.name}
				</Text>
				<Text
					className="mt-0.5"
					style={{ fontSize: 12.5, color: Colors.ink400 }}
				>
					{customer.totalVisits} visit{customer.totalVisits !== 1 ? "s" : ""} ·{" "}
					{money(customer.totalSpend)} total
				</Text>
			</View>
			<TierBadge tier={customer.tier} />
			<Icon name="ChevronRight" size={18} color={Colors.ink300} />
		</TouchableOpacity>
	);
}

function VisitRow({
	visit,
	serviceName,
}: {
	visit: CustomerVisit;
	serviceName: string;
}) {
	const statusColor =
		visit.status === "Completed"
			? Colors.successFg
			: visit.status === "Cancelled"
				? Colors.dangerFg
				: Colors.pendingFg;
	return (
		<View
			className="flex-row items-center gap-3 py-3 border-t"
			style={{ borderTopColor: Colors.lineSoft }}
		>
			<View
				className="rounded-sm items-center justify-center"
				style={{ width: 36, height: 36, backgroundColor: Colors.primary50 }}
			>
				<Icon name="Calendar" size={17} color={Colors.primary600} />
			</View>
			<View className="flex-1 min-w-0">
				<Text
					className="font-semibold"
					style={{ fontSize: 14, color: Colors.ink900 }}
				>
					{visit.slot.slice(0, 10)}
				</Text>
				<Text
					className="mt-0.5"
					numberOfLines={1}
					style={{ fontSize: 12.5, color: Colors.ink400 }}
				>
					{serviceName}
				</Text>
			</View>
			<View className="items-end">
				<Text
					className="font-bold"
					style={{ fontSize: 14, color: Colors.ink900 }}
				>
					{money(visit.price - visit.discount)}
				</Text>
				<Text className="mt-0.5" style={{ fontSize: 11.5, color: statusColor }}>
					{visit.status}
				</Text>
			</View>
		</View>
	);
}

function CustomerDetail({
	customer,
	onBack,
}: {
	customer: CustomerSummary;
	onBack: () => void;
}) {
	const insets = useSafeAreaInsets();
	const { businessId, services } = useApp();

	const visitsQ = useQuery({
		queryKey: ["customer-visits", businessId, customer.userId],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.customers.visits(customer.userId, { businessId: businessId! }),
		enabled: !!businessId,
		staleTime: 30_000,
	});

	const visits = visitsQ.data ?? [];

	return (
		<View className="flex-1 bg-paper">
			<BackHeader title={customer.name} onBack={onBack} topInset={insets.top} />
			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingBottom: 40 }}
			>
				{/* Profile header */}
				<View className="px-4 pt-4 pb-5">
					<Card pad={18}>
						<View className="flex-row items-center" style={{ gap: 14 }}>
							<Avatar
								name={customer.name}
								size={56}
								bg={Colors.primary900}
								fg="#fff"
							/>
							<View className="flex-1 min-w-0">
								<View className="flex-row items-center gap-2">
									<Text
										className="flex-1 font-bold"
										numberOfLines={1}
										style={{ fontSize: 17, color: Colors.ink900 }}
									>
										{customer.name}
									</Text>
									<TierBadge tier={customer.tier} />
								</View>
								{customer.email && (
									<Text
										className="mt-0.5"
										style={{ fontSize: 13, color: Colors.ink500 }}
									>
										{customer.email}
									</Text>
								)}
								{customer.phone && (
									<Text style={{ fontSize: 13, color: Colors.ink500 }}>
										{customer.phone}
									</Text>
								)}
								<Text
									className="mt-0.5"
									style={{ fontSize: 12, color: Colors.ink400 }}
								>
									Since {customer.firstVisit?.slice(0, 7) ?? "—"}
								</Text>
							</View>
						</View>
						{/* Stats row */}
						<View
							className="flex-row mt-4 pt-3.5 border-t"
							style={{ borderTopColor: Colors.lineSoft }}
						>
							{[
								{ label: "Visits", value: String(customer.totalVisits) },
								{ label: "Total spend", value: money(customer.totalSpend) },
								{ label: "Avg spend", value: money(customer.avgSpend) },
							].map((s, i) => (
								<View
									key={s.label}
									className={`flex-1 items-center ${i ? "border-l" : ""}`}
									style={i ? { borderLeftColor: Colors.lineSoft } : undefined}
								>
									<Text
										className="font-light"
										style={{ fontSize: 20, color: Colors.ink900 }}
									>
										{s.value}
									</Text>
									<Text
										className="mt-0.5"
										style={{ fontSize: 11.5, color: Colors.ink500 }}
									>
										{s.label}
									</Text>
								</View>
							))}
						</View>
					</Card>
				</View>

				{/* Visit history */}
				<View className="px-4">
					<Eyebrow color={Colors.ink400} style={{ marginBottom: 10 }}>
						Visit history
					</Eyebrow>
					<Card pad={0}>
						<View className="px-3.5">
							{visits.length === 0 ? (
								<View className="py-5 items-center">
									<Text style={{ fontSize: 14, color: Colors.ink400 }}>
										No visits recorded yet
									</Text>
								</View>
							) : (
								visits.map((v) => (
									<VisitRow
										key={v.id}
										visit={v}
										serviceName={
											services.find((s) => s.id === v.serviceId)?.name ??
											"Service"
										}
									/>
								))
							)}
						</View>
					</Card>
				</View>
			</ScrollView>
		</View>
	);
}

const TIERS: Array<"All" | CustomerTier> = [
	"All",
	"VIP",
	"Regular",
	"New",
	"AtRisk",
];

export default function CustomersScreen() {
	const insets = useSafeAreaInsets();
	const { businessId } = useApp();
	const [search, setSearch] = useState("");
	const [tierFilter, setTierFilter] = useState<"All" | CustomerTier>("All");
	const [selected, setSelected] = useState<CustomerSummary | null>(null);

	const customersQ = useQuery({
		queryKey: ["customers", businessId],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.customers.list({ businessId: businessId! }),
		enabled: !!businessId,
		staleTime: 60_000,
	});

	const all = customersQ.data ?? [];

	const filtered = all.filter((c) => {
		if (tierFilter !== "All" && c.tier !== tierFilter) return false;
		if (search && !c.name.toLowerCase().includes(search.toLowerCase()))
			return false;
		return true;
	});

	const tierCounts = TIERS.reduce<Record<string, number>>((acc, t) => {
		acc[t] = t === "All" ? all.length : all.filter((c) => c.tier === t).length;
		return acc;
	}, {});

	if (selected) {
		return (
			<CustomerDetail customer={selected} onBack={() => setSelected(null)} />
		);
	}

	return (
		<View className="flex-1 bg-paper">
			<BackHeader title="Customers" topInset={insets.top} />

			{/* Summary strip */}
			{all.length > 0 && (
				<View className="px-4 pb-3">
					<View className="flex-row gap-2.5">
						{[
							{ label: "Total", value: all.length, color: Colors.ink900 },
							{
								label: "VIP",
								value: all.filter((c) => c.tier === "VIP").length,
								color: Colors.gold700,
							},
							{
								label: "At risk",
								value: all.filter((c) => c.tier === "AtRisk").length,
								color: Colors.dangerFg,
							},
						].map((s) => (
							<View
								key={s.label}
								className="flex-1 rounded-md border border-line bg-surface p-3 items-center"
								style={{ ...Shadow.xs }}
							>
								<Text
									className="font-light"
									style={{ fontSize: 22, color: s.color }}
								>
									{s.value}
								</Text>
								<Text
									className="mt-0.5"
									style={{ fontSize: 11.5, color: Colors.ink500 }}
								>
									{s.label}
								</Text>
							</View>
						))}
					</View>
				</View>
			)}

			{/* Search */}
			<View className="px-4 mb-2.5">
				<View
					className="flex-row items-center gap-2.5 border rounded-md px-3"
					style={{
						backgroundColor: Colors.surface,
						borderColor: Colors.lineStrong,
					}}
				>
					<Icon name="Search" size={16} color={Colors.ink400} />
					<TextInput
						value={search}
						onChangeText={setSearch}
						placeholder="Search customers…"
						placeholderTextColor={Colors.ink400}
						className="flex-1 py-[11px]"
						style={{ fontSize: 15, color: Colors.ink900 }}
					/>
				</View>
			</View>

			{/* Tier filter */}
			<View className="mb-2.5">
				<FilterTabs
					tabs={TIERS.map((t) => ({
						id: t,
						label:
							t === "All"
								? `All (${tierCounts.All})`
								: t === "AtRisk"
									? `At risk (${tierCounts.AtRisk})`
									: `${t} (${tierCounts[t]})`,
					}))}
					active={tierFilter}
					onPick={(id) => setTierFilter(id as typeof tierFilter)}
				/>
			</View>

			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
			>
				{filtered.length === 0 ? (
					<View className="pt-12 items-center">
						<Icon name="UserX" size={32} color={Colors.ink300} />
						<Text
							className="mt-3"
							style={{ fontSize: 15, color: Colors.ink500 }}
						>
							No customers found
						</Text>
					</View>
				) : (
					<Card pad={0}>
						<View className="px-3.5">
							{filtered.map((c) => (
								<CustomerRow
									key={c.userId}
									customer={c}
									onPress={() => setSelected(c)}
								/>
							))}
						</View>
					</Card>
				)}
			</ScrollView>
		</View>
	);
}
