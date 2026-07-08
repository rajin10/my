"use client";
import type { CustomerSummary, CustomerTier } from "@repo/api-client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { money } from "../data";
import {
	Avatar,
	Card,
	Empty,
	Icon,
	PageHeader,
	StatusPill,
	Tabs,
} from "../primitives";

const TIER_CLASSES: Record<CustomerTier, string> = {
	VIP: "bg-gold-100 text-gold-700",
	Regular: "bg-primary-100 text-primary-700",
	New: "bg-info-bg text-info-fg",
	AtRisk: "bg-danger-bg text-danger-fg",
};

const TIER_LABELS: Record<CustomerTier, string> = {
	VIP: "VIP",
	Regular: "Regular",
	New: "New",
	AtRisk: "At risk",
};

function TierBadge({ tier }: { tier: CustomerTier }) {
	return (
		<span
			className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${TIER_CLASSES[tier]}`}
		>
			{TIER_LABELS[tier]}
		</span>
	);
}

function CustomerDetailDrawer({
	customer,
	businessId,
	onClose,
}: {
	customer: CustomerSummary;
	businessId: string;
	onClose: () => void;
}) {
	const visitsQ = useQuery({
		queryKey: ["customer-visits", businessId, customer.userId],
		queryFn: () => api.customers.visits(customer.userId, { businessId }),
		staleTime: 30_000,
	});
	const visits = visitsQ.data ?? [];

	return (
		<>
			{/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: backdrop click-to-dismiss pattern */}
			<div className="fixed inset-0 z-40 bg-primary-950/40" onClick={onClose} />
			<div className="fixed right-0 top-0 bottom-0 z-50 w-[420px] bg-surface shadow-xl flex flex-col">
				<div className="flex items-center justify-between px-5 py-4 border-b border-line">
					<h3 className="m-0 font-serif font-normal text-2xl tracking-tight text-ink-900">
						{customer.name}
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="w-8 h-8 rounded-full bg-primary-50 border-none cursor-pointer flex items-center justify-center"
					>
						<Icon name="X" size={18} className="text-ink-600" />
					</button>
				</div>

				<div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
					{/* Profile card */}
					<Card padding="sm">
						<div className="flex items-center gap-3 mb-4">
							<Avatar
								name={customer.name}
								size={48}
								tone="var(--color-primary-900)"
								fg="#fff"
							/>
							<div>
								<div className="flex items-center gap-2">
									<span className="font-semibold text-ink-900">
										{customer.name}
									</span>
									<TierBadge tier={customer.tier} />
								</div>
								{customer.email && (
									<div className="text-sm text-ink-500 mt-0.5">
										{customer.email}
									</div>
								)}
								{customer.phone && (
									<div className="text-sm text-ink-500">{customer.phone}</div>
								)}
								<div className="text-xs text-ink-400 mt-1">
									Since {customer.firstVisit?.slice(0, 7) ?? "—"}
								</div>
							</div>
						</div>
						{/* Stats */}
						<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-line-soft">
							{[
								{ label: "Visits", value: String(customer.totalVisits) },
								{ label: "Total spend", value: money(customer.totalSpend) },
								{ label: "Avg spend", value: money(customer.avgSpend) },
							].map((s) => (
								<div key={s.label} className="flex flex-col items-center">
									<span className="font-serif text-2xl font-medium text-ink-900">
										{s.value}
									</span>
									<span className="text-xs text-ink-500 mt-0.5">{s.label}</span>
								</div>
							))}
						</div>
					</Card>

					{/* Visit history */}
					<div>
						<div className="t-eyebrow mb-3">Visit history</div>
						<Card padding="none">
							{visits.length === 0 ? (
								<Empty icon="CalendarX2" text="No visits recorded" />
							) : (
								<div>
									{visits.map((v, i) => (
										<div
											key={v.id}
											className={`flex items-center gap-3 px-4 py-3 ${i ? "border-t border-line-soft" : ""}`}
										>
											<div className="w-9 h-9 rounded-sm bg-primary-50 flex items-center justify-center shrink-0">
												<Icon
													name="Calendar"
													size={16}
													className="text-primary-600"
												/>
											</div>
											<div className="flex-1 min-w-0">
												<div className="text-sm font-semibold text-ink-900">
													{v.slot.slice(0, 10)}
												</div>
												<div className="text-xs text-ink-400 mt-0.5 truncate">
													{v.slot.slice(11, 16)}
												</div>
											</div>
											<div className="text-right">
												<div className="text-sm font-bold text-ink-900">
													{money(v.price - v.discount)}
												</div>
												<div className="mt-0.5">
													<StatusPill status={v.status} />
												</div>
											</div>
										</div>
									))}
								</div>
							)}
						</Card>
					</div>
				</div>
			</div>
		</>
	);
}

interface CustomersScreenProps {
	businessId: string | null;
	initialSearch?: string;
}

export function CustomersScreen({
	businessId,
	initialSearch = "",
}: CustomersScreenProps) {
	const [search, setSearch] = useState(initialSearch);
	const [tierFilter, setTierFilter] = useState("All");
	const [selected, setSelected] = useState<CustomerSummary | null>(null);

	const customersQ = useQuery({
		queryKey: ["customers", businessId],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.customers.list({ businessId: businessId! }),
		enabled: !!businessId,
		staleTime: 60_000,
	});

	const all = customersQ.data ?? [];

	const tierCounts: Record<string, number> = {
		All: all.length,
		VIP: all.filter((c) => c.tier === "VIP").length,
		Regular: all.filter((c) => c.tier === "Regular").length,
		New: all.filter((c) => c.tier === "New").length,
		"At risk": all.filter((c) => c.tier === "AtRisk").length,
	};

	const tierMap: Record<string, CustomerTier | "All"> = {
		All: "All",
		VIP: "VIP",
		Regular: "Regular",
		New: "New",
		"At risk": "AtRisk",
	};

	const filtered = all.filter((c) => {
		const activeTier = tierMap[tierFilter];
		if (activeTier !== "All" && c.tier !== activeTier) return false;
		if (search && !c.name.toLowerCase().includes(search.toLowerCase()))
			return false;
		return true;
	});

	return (
		<div>
			<PageHeader
				eyebrow="Customers"
				title="Your client list"
				sub={`${all.length} customers across all branches`}
			/>

			{/* Summary stats */}
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
				{[
					{
						label: "Total customers",
						value: all.length,
						accentClass: "text-ink-900",
					},
					{
						label: "VIP clients",
						value: tierCounts.VIP,
						accentClass: "text-gold-600",
					},
					{
						label: "New this period",
						value: tierCounts.New,
						accentClass: "text-info",
					},
					{
						label: "At risk",
						value: tierCounts["At risk"],
						accentClass: "text-danger",
					},
				].map((s) => (
					<Card key={s.label} padding="sm" className="flex flex-col gap-2">
						<span className="text-xs font-semibold text-ink-500">
							{s.label}
						</span>
						<span
							className={`font-serif text-[32px] font-medium tracking-tight ${s.accentClass}`}
						>
							{s.value}
						</span>
					</Card>
				))}
			</div>

			{/* Filters */}
			<div className="flex items-center justify-between gap-4 mb-4">
				<Tabs
					tabs={["All", "VIP", "Regular", "New", "At risk"]}
					active={tierFilter}
					onChange={setTierFilter}
					counts={tierCounts}
				/>
				<div className="flex items-center gap-2 px-3 py-2 bg-surface border border-line-strong rounded-md">
					<Icon name="Search" size={15} className="text-ink-400" />
					<input
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search customers…"
						className="border-none outline-none text-sm text-ink-900 bg-transparent placeholder:text-ink-400 w-52"
					/>
				</div>
			</div>

			{/* Table */}
			<Card padding="none">
				<table className="w-full border-collapse text-sm">
					<thead>
						<tr className="border-b border-line">
							<th className="px-5 py-3 text-left text-xs font-semibold text-ink-500">
								Customer
							</th>
							<th className="px-5 py-3 text-left text-xs font-semibold text-ink-500">
								Tier
							</th>
							<th className="px-5 py-3 text-right text-xs font-semibold text-ink-500">
								Visits
							</th>
							<th className="px-5 py-3 text-right text-xs font-semibold text-ink-500">
								Total spend
							</th>
							<th className="px-5 py-3 text-right text-xs font-semibold text-ink-500">
								Avg spend
							</th>
							<th className="px-5 py-3 text-left text-xs font-semibold text-ink-500">
								Last visit
							</th>
							<th className="px-5 py-3" />
						</tr>
					</thead>
					<tbody>
						{filtered.length === 0 ? (
							<tr>
								<td colSpan={7}>
									<Empty icon="UserX" text="No customers found" />
								</td>
							</tr>
						) : (
							filtered.map((c, i) => (
								<tr
									key={c.userId}
									className={`cursor-pointer hover:bg-primary-50 transition-colors ${i ? "border-t border-line-soft" : ""}`}
									onClick={() => setSelected(c)}
								>
									<td className="px-5 py-3">
										<div className="flex items-center gap-3">
											<Avatar name={c.name} size={34} />
											<div>
												<div className="font-semibold text-ink-900">
													{c.name}
												</div>
												{c.email && (
													<div className="text-xs text-ink-400">{c.email}</div>
												)}
											</div>
										</div>
									</td>
									<td className="px-5 py-3">
										<TierBadge tier={c.tier} />
									</td>
									<td className="px-5 py-3 text-right font-medium text-ink-900">
										{c.totalVisits}
									</td>
									<td className="px-5 py-3 text-right font-semibold text-ink-900">
										{money(c.totalSpend)}
									</td>
									<td className="px-5 py-3 text-right text-ink-600">
										{money(c.avgSpend)}
									</td>
									<td className="px-5 py-3 text-ink-500">
										{c.lastVisit?.slice(0, 10) ?? "—"}
									</td>
									<td className="px-5 py-3">
										<Icon
											name="ChevronRight"
											size={16}
											className="text-ink-300"
										/>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</Card>

			{selected && businessId && (
				<CustomerDetailDrawer
					customer={selected}
					businessId={businessId}
					onClose={() => setSelected(null)}
				/>
			)}
		</div>
	);
}
