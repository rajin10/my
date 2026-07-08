"use client";
import { cn } from "../lib/cn";

export function Tabs({
	tabs,
	active,
	onChange,
	counts = {},
}: {
	tabs: string[];
	active: string;
	onChange: (t: string) => void;
	counts?: Record<string, number>;
}) {
	return (
		<div className="inline-flex gap-0.5 p-1 bg-primary-50 rounded-md">
			{tabs.map((t) => {
				const on = t === active;
				return (
					<button
						key={t}
						type="button"
						onClick={() => onChange(t)}
						className={cn(
							"inline-flex items-center gap-2 px-4 py-1.5 rounded-sm border-none cursor-pointer",
							"font-sans text-xs font-semibold transition-all duration-fast",
							on
								? "bg-surface text-ink-900 shadow-xs"
								: "bg-transparent text-ink-500",
						)}
					>
						{t}
						{counts[t] != null && (
							<span
								className={cn(
									"text-xs font-bold",
									on ? "text-primary-600" : "text-ink-400",
								)}
							>
								{counts[t]}
							</span>
						)}
					</button>
				);
			})}
		</div>
	);
}
