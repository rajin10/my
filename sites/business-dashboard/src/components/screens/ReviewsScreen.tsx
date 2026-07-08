import type { Review } from "../data";
import {
	Avatar,
	Button,
	Card,
	Empty,
	PageHeader,
	Stars,
	StatusPill,
} from "../primitives";

interface ReviewsScreenProps {
	reviews: Review[];
	onApprove: (id: string) => void;
	onReject: (id: string) => void;
}

export function ReviewsScreen({
	reviews,
	onApprove,
	onReject,
}: ReviewsScreenProps) {
	const pending = reviews.filter((r) => r.status === "Pending");
	const published = reviews.filter((r) => r.status === "Published");

	return (
		<div>
			<PageHeader
				eyebrow="Moderate"
				title="Reviews"
				sub="Approve genuine feedback to publish it on your public profile."
			/>

			<div className="mb-3 flex items-center gap-2">
				<h3 className="m-0 text-base font-bold text-ink-900">
					Awaiting approval
				</h3>
				{pending.length > 0 && (
					<span className="text-xs font-bold text-pending-fg bg-pending-bg rounded-full px-2.5 py-0.5">
						{pending.length}
					</span>
				)}
			</div>

			{pending.length === 0 ? (
				<Card>
					<Empty
						icon="CheckCircle"
						text="No reviews waiting — you're all caught up."
					/>
				</Card>
			) : (
				<div className="flex flex-col gap-3 mb-7">
					{pending.map((r) => (
						<Card key={r.id} className="flex gap-4 items-start">
							<Avatar name={r.name} size={42} />
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2.5 flex-wrap">
									<span className="text-sm font-bold text-ink-900">
										{r.name}
									</span>
									<Stars value={r.rating} size={14} />
									<span className="text-xs text-ink-400">
										· {r.service} · {r.date}
									</span>
								</div>
								<p className="mt-2 mb-0 text-sm leading-relaxed text-ink-700">
									{r.text}
								</p>
							</div>
							<div className="flex gap-2 shrink-0">
								<Button
									size="sm"
									variant="danger"
									icon="X"
									onClick={() => onReject(r.id)}
								>
									Reject
								</Button>
								<Button size="sm" icon="Check" onClick={() => onApprove(r.id)}>
									Approve
								</Button>
							</div>
						</Card>
					))}
				</div>
			)}

			<h3 className="m-0 mb-3 text-base font-bold text-ink-900">Published</h3>
			<div className="flex flex-col gap-3">
				{published.map((r) => (
					<Card key={r.id} className="flex gap-4 items-start">
						<Avatar name={r.name} size={42} />
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2.5 flex-wrap">
								<span className="text-sm font-bold text-ink-900">{r.name}</span>
								<Stars value={r.rating} size={14} />
								<span className="text-xs text-ink-400">
									· {r.service} · {r.date}
								</span>
								<StatusPill status="Published" />
							</div>
							<p className="mt-2 mb-0 text-sm leading-relaxed text-ink-700">
								{r.text}
							</p>
						</div>
					</Card>
				))}
			</div>
		</div>
	);
}
