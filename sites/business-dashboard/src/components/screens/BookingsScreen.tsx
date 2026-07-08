"use client";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { type Booking, money, type TeamMember } from "../data";
import {
	Avatar,
	Button,
	Card,
	Empty,
	PageHeader,
	StatusPill,
	Tabs,
} from "../primitives";

interface BookingsScreenProps {
	bookings: Booking[];
	branches?: string[];
	team?: TeamMember[];
	onConfirm: (id: string) => void;
	onDecline: (id: string) => void;
	onCancel: (id: string) => void;
	onComplete: (id: string) => void;
	onAssign: (bookingId: string, staffId: string) => void;
	onExport?: () => void;
	exporting?: boolean;
}

export function BookingsScreen({
	bookings,
	branches = [],
	team = [],
	onConfirm,
	onDecline,
	onCancel,
	onComplete,
	onAssign,
	onExport,
	exporting,
}: BookingsScreenProps) {
	const [tab, setTab] = useState("All");
	const [branch, setBranch] = useState("All branches");

	const tabs = ["All", "Pending", "Confirmed", "Completed", "Cancelled"];
	const counts = {
		Pending: bookings.filter((b) => b.status === "Pending").length,
	};

	let rows =
		tab === "All" ? bookings : bookings.filter((b) => b.status === tab);
	if (branch !== "All branches") rows = rows.filter((b) => b.branch === branch);

	const staffOptions = team.filter((m) => m.role !== "Owner");

	return (
		<div>
			<PageHeader
				eyebrow="Manage"
				title="Bookings"
				sub="Confirm pending requests, view your schedule, and handle cancellations."
				actions={
					<Button
						variant="ghost"
						icon="Download"
						onClick={onExport}
						disabled={exporting}
					>
						{exporting ? "Exporting…" : "Export"}
					</Button>
				}
			/>

			<div className="flex items-center justify-between gap-3.5 mb-4">
				<Tabs tabs={tabs} active={tab} onChange={setTab} counts={counts} />
				<div className="relative">
					<select
						value={branch}
						onChange={(e) => setBranch(e.target.value)}
						className="box-border pr-9 pl-3 py-2.5 rounded-md border border-line-strong outline-none font-sans text-sm font-semibold text-ink-900 bg-surface cursor-pointer appearance-none"
					>
						<option>All branches</option>
						{branches.map((b) => (
							<option key={b}>{b}</option>
						))}
					</select>
					<ChevronDown
						size={16}
						className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
					/>
				</div>
			</div>

			<Card padding="none" className="overflow-hidden">
				<div className="overflow-x-auto">
					<div style={{ minWidth: 780 }}>
						{/* Header row */}
						<div
							className="grid gap-3.5 px-5 py-3 border-b border-line bg-paper text-xs font-bold tracking-[0.04em] uppercase text-ink-400"
							style={{ gridTemplateColumns: "1.4fr 1.6fr 1fr 1.2fr 1fr 1.6fr" }}
						>
							<span>Customer</span>
							<span>Service</span>
							<span>Branch</span>
							<span>Date &amp; time</span>
							<span>Status</span>
							<span className="text-right">Actions</span>
						</div>

						{rows.length === 0 ? (
							<Empty icon="CalendarX" text="No bookings here." />
						) : (
							rows.map((b, i) => (
								<div
									key={b.id}
									className={[
										"grid gap-3.5 px-5 py-3.5 items-center",
										i ? "border-t border-line-soft" : "",
									].join(" ")}
									style={{
										gridTemplateColumns: "1.4fr 1.6fr 1fr 1.2fr 1fr 1.6fr",
									}}
								>
									<div className="flex items-center gap-2.5 min-w-0">
										<Avatar name={b.customer} size={32} />
										<span className="text-sm font-semibold text-ink-900 truncate">
											{b.customer}
										</span>
									</div>
									<div className="min-w-0">
										<div className="text-sm text-ink-800 truncate">
											{b.service}
										</div>
										<div className="text-xs text-ink-400">
											{b.duration} min · {money(b.price)}
										</div>
									</div>
									<span className="text-sm text-ink-600">{b.branch}</span>
									<div>
										<div className="text-sm font-semibold text-ink-800">
											{b.date}
										</div>
										<div className="text-xs text-ink-400">{b.time}</div>
									</div>
									<StatusPill status={b.status} />
									<div className="flex gap-2 justify-end flex-wrap">
										{b.status === "Pending" && (
											<>
												<Button
													size="sm"
													variant="danger"
													onClick={() => onDecline(b.id)}
												>
													Decline
												</Button>
												<Button
													size="sm"
													icon="Check"
													onClick={() => onConfirm(b.id)}
												>
													Confirm
												</Button>
											</>
										)}
										{b.status === "Confirmed" && (
											<>
												{staffOptions.length > 0 && (
													<select
														defaultValue=""
														onChange={(e) => {
															if (e.target.value)
																onAssign(b.id, e.target.value);
														}}
														className="text-xs rounded-md border border-line px-2 py-1 bg-surface outline-none cursor-pointer"
														title="Assign staff"
													>
														<option value="" disabled>
															Assign…
														</option>
														{staffOptions.map((m) => (
															<option key={m.id} value={m.id}>
																{m.name}
															</option>
														))}
													</select>
												)}
												<Button
													size="sm"
													icon="CheckCheck"
													onClick={() => onComplete(b.id)}
												>
													Complete
												</Button>
												<Button
													size="sm"
													variant="quiet"
													onClick={() => onCancel(b.id)}
												>
													Cancel
												</Button>
											</>
										)}
										{(b.status === "Cancelled" || b.status === "Completed") && (
											<span className="text-sm text-ink-300">—</span>
										)}
									</div>
								</div>
							))
						)}
					</div>
				</div>
			</Card>
		</div>
	);
}
