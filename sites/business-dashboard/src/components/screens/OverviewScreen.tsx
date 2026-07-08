import { ArrowRight } from "lucide-react";
import { type Booking, money, type Review } from "../data";
import {
	Avatar,
	Button,
	Card,
	Empty,
	Icon,
	PageHeader,
	StatCard,
} from "../primitives";

interface OverviewScreenProps {
	bookings: Booking[];
	reviews: Review[];
	onConfirm: (id: string) => void;
	onDecline: (id: string) => void;
	goto: (screen: string) => void;
	businessName?: string;
	ownerName?: string;
	branchCity?: string;
	businessUrl?: string;
}

function greeting(): string {
	const h = new Date().getHours();
	if (h < 12) return "Good morning";
	if (h < 17) return "Good afternoon";
	return "Good evening";
}

export function OverviewScreen({
	bookings,
	reviews,
	onConfirm,
	onDecline,
	goto,
	businessName,
	ownerName,
	branchCity,
	businessUrl,
}: OverviewScreenProps) {
	const pending = bookings.filter((b) => b.status === "Pending");
	const todayStr = new Date().toDateString();
	const todayConfirmed = bookings.filter(
		(b) =>
			b.status === "Confirmed" && new Date(b.slot).toDateString() === todayStr,
	);
	const todayAll = bookings.filter(
		(b) => new Date(b.slot).toDateString() === todayStr,
	);
	const pendingReviews = reviews.filter((r) => r.status === "Pending");
	const weekAgo = new Date();
	weekAgo.setDate(weekAgo.getDate() - 7);
	const weekRevenue = bookings
		.filter((b) => b.status === "Completed" && new Date(b.slot) >= weekAgo)
		.reduce((s, b) => s + b.price, 0);

	const dateLabel = new Date().toLocaleDateString("en-BD", {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
	});
	const locationLabel = branchCity ?? "";

	return (
		<div>
			<PageHeader
				eyebrow={
					ownerName ? `${greeting()}, ${ownerName.split(" ")[0]}` : greeting()
				}
				title={
					businessName
						? `Here's how ${businessName} is doing`
						: "Here's how you're doing"
				}
				sub={[dateLabel, locationLabel].filter(Boolean).join(" · ")}
				actions={
					businessUrl ? (
						<a
							href={businessUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="no-underline"
						>
							<Button variant="ghost" icon="ExternalLink">
								View public page
							</Button>
						</a>
					) : (
						<Button variant="ghost" icon="ExternalLink" disabled>
							View public page
						</Button>
					)
				}
			/>

			{/* Stats */}
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
				<StatCard
					icon="CalendarCheck"
					label="Bookings today"
					value={String(todayAll.length)}
				/>
				<StatCard
					icon="Clock"
					label="Pending approvals"
					value={String(pending.length)}
					accent="var(--color-pending)"
				/>
				<StatCard
					icon="IndianRupee"
					label="Revenue this week"
					value={money(weekRevenue)}
				/>
				<StatCard
					icon="MessageSquareQuote"
					label="Reviews to moderate"
					value={String(pendingReviews.length)}
					accent="var(--color-gold-600)"
				/>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 items-start">
				{/* Needs attention */}
				<Card padding="none">
					<div className="flex items-center justify-between px-5 py-4 border-b border-line">
						<h3 className="m-0 font-sans text-base font-bold text-ink-900">
							Needs your approval
						</h3>
						<button
							type="button"
							onClick={() => goto("bookings")}
							className="bg-transparent border-none cursor-pointer text-primary-600 text-sm font-semibold inline-flex items-center gap-1"
						>
							All bookings <ArrowRight size={15} />
						</button>
					</div>
					{pending.length === 0 ? (
						<Empty icon="CheckCircle" text="You're all caught up." />
					) : (
						<div>
							{pending.map((b, i) => (
								<div
									key={b.id}
									className={[
										"flex items-center gap-3.5 px-5 py-3.5",
										i ? "border-t border-line-soft" : "",
									].join(" ")}
								>
									<Avatar name={b.customer} size={40} />
									<div className="flex-1 min-w-0">
										<div className="text-sm font-semibold text-ink-900">
											{b.customer}
										</div>
										<div className="text-xs text-ink-500 mt-0.5">
											{b.service} · {b.branch}
										</div>
									</div>
									<div className="text-right mr-1.5">
										<div className="text-sm font-semibold text-ink-800">
											{b.date}, {b.time}
										</div>
										<div className="text-xs text-ink-400">
											{b.duration} min · {money(b.price)}
										</div>
									</div>
									<div className="flex gap-2">
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
									</div>
								</div>
							))}
						</div>
					)}
				</Card>

				{/* Right column */}
				<div className="flex flex-col gap-4">
					<Card padding="none">
						<div className="px-5 pt-4 pb-3">
							<h3 className="m-0 font-sans text-base font-bold text-ink-900">
								Today's schedule
							</h3>
						</div>
						{todayConfirmed.length === 0 ? (
							<Empty icon="Calendar" text="No confirmed visits today yet." />
						) : (
							<div className="px-5 pb-4">
								{todayConfirmed.map((b) => (
									<div
										key={b.id}
										className="flex gap-3 py-2.5 border-t border-line-soft"
									>
										<div className="font-mono text-xs text-primary-700 font-medium pt-px w-11 shrink-0">
											{b.time}
										</div>
										<div>
											<div className="text-sm font-semibold text-ink-900">
												{b.service}
											</div>
											<div className="text-xs text-ink-500 mt-px">
												{b.customer} · {b.branch}
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</Card>

					{/* Reviews nudge */}
					<Card className="bg-primary-900 border-0">
						<div className="flex items-center gap-2.5 mb-2.5 text-white">
							<Icon
								name="MessageSquareQuote"
								size={20}
								className="text-primary-300"
							/>
							<span className="text-base font-bold">
								{pendingReviews.length} reviews to moderate
							</span>
						</div>
						<p className="m-0 mb-4 text-sm leading-snug text-primary-200">
							Approve genuine feedback promptly — it builds trust with new
							customers.
						</p>
						<button
							type="button"
							onClick={() => goto("reviews")}
							className="bg-white text-primary-900 border-none rounded-md px-4 py-2.5 font-sans text-sm font-semibold cursor-pointer inline-flex items-center gap-2"
						>
							Review now <ArrowRight size={15} />
						</button>
					</Card>
				</div>
			</div>
		</div>
	);
}
