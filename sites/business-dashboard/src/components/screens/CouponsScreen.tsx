"use client";
import { useQuery } from "@tanstack/react-query";
import { type ChangeEvent, useState } from "react";
import { api } from "../../lib/api";
import { cn } from "../../lib/cn";
import { type Coupon, money } from "../data";
import {
	Button,
	Card,
	Field,
	inputClass,
	Modal,
	PageHeader,
	StatusPill,
} from "../primitives";

interface CouponsScreenProps {
	coupons: Coupon[];
	onCreate: (c: Coupon) => void;
	onDeactivate: (id: string) => void;
}

function CouponDetailModal({
	coupon,
	onClose,
	onDeactivate,
}: {
	coupon: Coupon;
	onClose: () => void;
	onDeactivate: (id: string) => void;
}) {
	const detailQuery = useQuery({
		queryKey: ["coupon", coupon.id],
		queryFn: () => api.coupons.get(coupon.id),
		staleTime: 30_000,
	});
	const c = detailQuery.data?.data;
	const used = c?.usedCount ?? coupon.used;
	const max = c?.maxUses ?? coupon.max;
	const pct = Math.min(100, max > 0 ? Math.round((used / max) * 100) : 0);

	return (
		<Modal
			title={coupon.code}
			sub="Coupon details and redemption progress."
			onClose={onClose}
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Close
					</Button>
					{coupon.status === "Active" && (
						<Button
							variant="ghost"
							onClick={() => {
								onDeactivate(coupon.id);
								onClose();
							}}
						>
							Deactivate
						</Button>
					)}
				</>
			}
		>
			<div className="flex flex-col gap-3">
				{[
					[
						"Discount",
						coupon.type === "Percentage"
							? `${coupon.value}% off`
							: `${money(coupon.value)} off`,
					],
					["Status", coupon.status],
					["Max uses", String(max)],
					["Expires", coupon.expires],
				].map(([label, value]) => (
					<div
						key={label}
						className="flex items-center justify-between py-2 border-b border-line-soft last:border-0"
					>
						<span className="font-sans text-sm text-ink-500">{label}</span>
						<span className="font-sans text-sm font-semibold text-ink-900">
							{value}
						</span>
					</div>
				))}
				<div>
					<div className="flex justify-between mb-1.5">
						<span className="font-sans text-sm text-ink-500">Redemptions</span>
						<span className="font-sans text-sm font-semibold text-ink-900">
							{used} / {max} ({pct}%)
						</span>
					</div>
					<div className="h-2 rounded bg-line overflow-hidden">
						<div
							className="h-full bg-primary-500 rounded"
							style={{ width: `${pct}%` }}
						/>
					</div>
				</div>
			</div>
		</Modal>
	);
}

export function CouponsScreen({
	coupons,
	onCreate,
	onDeactivate,
}: CouponsScreenProps) {
	const [creating, setCreating] = useState(false);
	const [selected, setSelected] = useState<Coupon | null>(null);

	return (
		<div>
			<PageHeader
				eyebrow="Grow"
				title="Coupons"
				sub="Attract new customers and reward regulars with discount codes."
				actions={
					<Button icon="Plus" onClick={() => setCreating(true)}>
						Create coupon
					</Button>
				}
			/>

			<Card padding="none" className="overflow-hidden">
				<div
					className="grid gap-3.5 px-5 py-3 border-b border-line bg-paper text-xs font-bold tracking-[0.04em] uppercase text-ink-400"
					style={{ gridTemplateColumns: "1.4fr 1fr 1fr 1.4fr 1fr 0.8fr" }}
				>
					<span>Code</span>
					<span>Discount</span>
					<span>Used</span>
					<span>Expires</span>
					<span>Status</span>
					<span />
				</div>
				{coupons.map((c, i) => (
					<div
						key={c.id}
						role="button"
						tabIndex={0}
						onClick={() => setSelected(c)}
						onKeyDown={(e) => e.key === "Enter" && setSelected(c)}
						className={[
							"grid gap-3.5 px-5 py-3.5 items-center cursor-pointer hover:bg-line-soft/50 transition-colors",
							i ? "border-t border-line-soft" : "",
						].join(" ")}
						style={{ gridTemplateColumns: "1.4fr 1fr 1fr 1.4fr 1fr 0.8fr" }}
					>
						<span className="font-mono text-sm font-medium text-ink-900 bg-primary-50 rounded-sm px-2.5 py-1 justify-self-start">
							{c.code}
						</span>
						<span className="text-sm text-ink-800">
							{c.type === "Percentage"
								? `${c.value}% off`
								: `${money(c.value)} off`}
						</span>
						<div className="min-w-0">
							<div className="text-sm text-ink-700">
								{c.used} / {c.max}
							</div>
							<div className="h-1 rounded bg-line mt-1 overflow-hidden">
								<div
									className="h-full bg-primary-500"
									style={{ width: `${Math.min(100, (c.used / c.max) * 100)}%` }}
								/>
							</div>
						</div>
						<span className="text-sm text-ink-600">{c.expires}</span>
						<StatusPill status={c.status} />
						<div className="text-right">
							{c.status === "Active" && (
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										onDeactivate(c.id);
									}}
									className="bg-transparent border-none cursor-pointer text-sm font-semibold text-ink-500"
								>
									Deactivate
								</button>
							)}
						</div>
					</div>
				))}
			</Card>

			{creating && (
				<CreateCouponModal
					onClose={() => setCreating(false)}
					onCreate={(c) => {
						onCreate(c);
						setCreating(false);
					}}
				/>
			)}

			{selected && (
				<CouponDetailModal
					coupon={selected}
					onClose={() => setSelected(null)}
					onDeactivate={(id) => {
						onDeactivate(id);
						setSelected(null);
					}}
				/>
			)}
		</div>
	);
}

function CreateCouponModal({
	onClose,
	onCreate,
}: {
	onClose: () => void;
	onCreate: (c: Coupon) => void;
}) {
	const todayIso = new Date().toISOString().slice(0, 10);
	const [f, setF] = useState({
		code: "",
		type: "Percentage",
		value: "",
		max: "",
		expires: "",
	});
	const set =
		(k: string) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
			setF({ ...f, [k]: e.target.value });
	const valid = Boolean(f.code.trim() && f.value);

	return (
		<Modal
			title="Create a coupon"
			sub="Share the code with your customers — it applies at checkout."
			onClose={onClose}
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={!valid}
						onClick={() =>
							onCreate({
								id: `cx${Date.now()}`,
								code: f.code.trim().toUpperCase(),
								type: f.type as "Percentage" | "Fixed",
								value: Number(f.value) || 0,
								used: 0,
								max: f.max.trim() === "" ? 100 : Number(f.max),
								status: "Active",
								expires: f.expires || "No expiry",
							})
						}
					>
						Create &amp; activate
					</Button>
				</>
			}
		>
			<div className="flex flex-col gap-4">
				<Field label="Code" hint="What customers type at checkout.">
					<input
						value={f.code}
						onChange={set("code")}
						placeholder="WELCOME20"
						className={cn(inputClass, "font-mono uppercase")}
					/>
				</Field>
				<div className="grid grid-cols-2 gap-3.5">
					<Field label="Discount type">
						<select
							value={f.type}
							onChange={set("type")}
							className={cn(inputClass, "cursor-pointer")}
						>
							<option>Percentage</option>
							<option>Fixed</option>
						</select>
					</Field>
					<Field label={f.type === "Percentage" ? "Value (%)" : "Value (₹)"}>
						<input
							value={f.value}
							onChange={set("value")}
							inputMode="numeric"
							placeholder={f.type === "Percentage" ? "20" : "500"}
							className={inputClass}
						/>
					</Field>
				</div>
				<div className="grid grid-cols-2 gap-3.5">
					<Field label="Max uses" hint="Optional">
						<input
							value={f.max}
							onChange={set("max")}
							inputMode="numeric"
							placeholder="100"
							className={inputClass}
						/>
					</Field>
					<Field label="Expiry date" hint="Optional">
						<input
							type="date"
							value={f.expires}
							min={todayIso}
							onChange={set("expires")}
							className={inputClass}
						/>
					</Field>
				</div>
			</div>
		</Modal>
	);
}
