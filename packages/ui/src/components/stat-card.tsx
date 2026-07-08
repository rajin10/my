import { cn } from "../lib/cn";
import { Card } from "./card";
import { Icon } from "./icon";

export function StatCard({
	icon,
	label,
	value,
	delta,
	deltaUp = true,
	accent = "var(--color-primary-600)",
}: {
	icon: string;
	label: string;
	value: string;
	delta?: string;
	deltaUp?: boolean;
	accent?: string;
}) {
	return (
		<Card padding="sm" className="flex flex-col gap-3.5">
			<div className="flex items-center justify-between">
				<span className="text-sm font-semibold text-ink-500">{label}</span>
				<span className="w-8 h-8 rounded-sm bg-primary-50 flex items-center justify-center">
					<Icon name={icon} size={18} style={{ color: accent }} />
				</span>
			</div>
			<div className="flex items-baseline gap-2.5">
				<span className="font-serif text-[32px] font-medium tracking-tight text-ink-900">
					{value}
				</span>
				{delta && (
					<span
						className={cn(
							"inline-flex items-center gap-0.5 text-xs font-semibold",
							deltaUp ? "text-success-fg" : "text-danger-fg",
						)}
					>
						<Icon name={deltaUp ? "TrendingUp" : "TrendingDown"} size={14} />
						{delta}
					</span>
				)}
			</div>
		</Card>
	);
}
