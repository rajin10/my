"use client";
import type { CalendarBooking } from "@repo/api-client";
import { useState } from "react";
import { PageHeader, ScreenSkeleton } from "@/components/primitives";
import {
	useBookingCalendar,
	useBranches,
	useMyBusiness,
} from "@/hooks/useOwnerData";

function isoWeekStart(d: Date): string {
	const day = d.getDay();
	const diff = d.getDate() - day + (day === 0 ? -6 : 1);
	const monday = new Date(d);
	monday.setDate(diff);
	return monday.toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
	const d = new Date(iso);
	d.setDate(d.getDate() + n);
	return d.toISOString().slice(0, 10);
}

function fmt(iso: string, opts: Intl.DateTimeFormatOptions): string {
	return new Date(iso).toLocaleDateString("en-IN", opts);
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 08:00–21:00
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function CalendarGrid({
	bookings,
	weekStart,
}: {
	bookings: CalendarBooking[];
	weekStart: string;
}) {
	const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

	function bookingsAt(day: string, hour: number) {
		return bookings.filter((b) => {
			const d = new Date(b.slot);
			return d.toISOString().slice(0, 10) === day && d.getHours() === hour;
		});
	}

	return (
		<div className="overflow-x-auto rounded-xl border border-line bg-surface">
			{/* Header row */}
			<div
				className="grid bg-paper border-b border-line"
				style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}
			>
				<div className="px-2 py-2 text-xs text-ink-400" />
				{days.map((d, i) => (
					<div key={d} className="px-2 py-2 text-center">
						<div className="font-sans text-xs font-semibold text-ink-400">
							{DAYS[i]}
						</div>
						<div className="font-sans text-sm font-medium text-ink-900">
							{fmt(d, { day: "numeric", month: "short" })}
						</div>
					</div>
				))}
			</div>
			{/* Time rows */}
			{HOURS.map((h) => (
				<div
					key={h}
					className="grid border-b border-line-soft last:border-0"
					style={{ gridTemplateColumns: "56px repeat(7, 1fr)", minHeight: 48 }}
				>
					<div className="px-2 py-1 text-xs text-ink-400 font-mono leading-tight pt-2">
						{String(h).padStart(2, "0")}:00
					</div>
					{days.map((d) => {
						const items = bookingsAt(d, h);
						return (
							<div
								key={d}
								className="border-l border-line-soft px-1 py-1 flex flex-col gap-1"
							>
								{items.map((b) => (
									<div
										key={b.id}
										className="rounded bg-primary-100 border border-primary-200 px-1.5 py-0.5 text-xs text-primary-800 truncate"
										title={`${b.customerName} · ${b.serviceName}`}
									>
										<span className="font-semibold">
											{new Date(b.slot).toLocaleTimeString("en-IN", {
												hour: "2-digit",
												minute: "2-digit",
												hour12: false,
											})}
										</span>{" "}
										{b.serviceName}
									</div>
								))}
							</div>
						);
					})}
				</div>
			))}
		</div>
	);
}

export default function CalendarPage() {
	const _today = new Date().toISOString().slice(0, 10);
	const [weekStart, setWeekStart] = useState(() => isoWeekStart(new Date()));
	const [branchId, setBranchId] = useState<string | null>(null);

	const businessQuery = useMyBusiness();
	const businessId = businessQuery.data?.id ?? null;
	const branchesQuery = useBranches(businessId);
	const branches = (branchesQuery.data?.data ?? []) as {
		id: string;
		name: string;
	}[];

	const activeBranchId = branchId ?? branches[0]?.id ?? null;
	const weekEnd = addDays(weekStart, 6);
	const calendarQuery = useBookingCalendar(activeBranchId, weekStart, weekEnd);
	const bookings = calendarQuery.data ?? [];

	if (businessQuery.isLoading || branchesQuery.isLoading)
		return <ScreenSkeleton rows={1} cards={3} />;

	return (
		<div>
			<PageHeader
				eyebrow="Schedule"
				title="Calendar"
				sub="Weekly view of all bookings across your branch."
			/>

			{/* Controls */}
			<div className="flex flex-wrap items-center gap-3 mb-4">
				{/* Branch picker */}
				{branches.length > 1 && (
					<select
						value={activeBranchId ?? ""}
						onChange={(e) => setBranchId(e.target.value)}
						className="font-sans text-sm border border-line rounded-lg px-3 py-2 bg-surface text-ink-900 outline-none cursor-pointer"
					>
						{branches.map((b) => (
							<option key={b.id} value={b.id}>
								{b.name}
							</option>
						))}
					</select>
				)}

				{/* Week navigation */}
				<div className="flex items-center gap-2 ml-auto">
					<button
						type="button"
						onClick={() => setWeekStart(addDays(weekStart, -7))}
						className="w-8 h-8 rounded-lg border border-line bg-surface cursor-pointer flex items-center justify-center font-sans text-sm text-ink-700 hover:bg-line-soft"
					>
						←
					</button>
					<button
						type="button"
						onClick={() => setWeekStart(isoWeekStart(new Date()))}
						className="px-3 h-8 rounded-lg border border-line bg-surface cursor-pointer font-sans text-xs font-medium text-ink-700 hover:bg-line-soft"
					>
						Today
					</button>
					<button
						type="button"
						onClick={() => setWeekStart(addDays(weekStart, 7))}
						className="w-8 h-8 rounded-lg border border-line bg-surface cursor-pointer flex items-center justify-center font-sans text-sm text-ink-700 hover:bg-line-soft"
					>
						→
					</button>
					<span className="font-sans text-sm text-ink-500 ml-1">
						{fmt(weekStart, { day: "numeric", month: "short" })} –{" "}
						{fmt(weekEnd, { day: "numeric", month: "short", year: "numeric" })}
					</span>
				</div>
			</div>

			<CalendarGrid bookings={bookings} weekStart={weekStart} />
		</div>
	);
}
