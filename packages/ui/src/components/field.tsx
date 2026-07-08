import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export const inputClass =
	"w-full box-border px-[13px] py-[10px] rounded-md border border-line-strong outline-none font-sans text-[14.5px] text-ink-900 bg-surface";

export function Field({
	label,
	children,
	hint,
	className,
}: {
	label?: string;
	children: ReactNode;
	hint?: string;
	className?: string;
}) {
	return (
		<label className={cn("flex flex-col gap-1.5", className)}>
			{label && (
				<span className="text-xs font-semibold text-ink-700">{label}</span>
			)}
			{children}
			{hint && <span className="text-xs text-ink-400">{hint}</span>}
		</label>
	);
}
