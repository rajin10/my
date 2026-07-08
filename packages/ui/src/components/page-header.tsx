import type { ReactNode } from "react";

export function PageHeader({
	eyebrow,
	title,
	sub,
	actions,
}: {
	eyebrow?: string;
	title: string;
	sub?: string;
	actions?: ReactNode;
}) {
	return (
		<div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-5 mb-6">
			<div>
				{eyebrow && <div className="t-eyebrow mb-2">{eyebrow}</div>}
				<h1 className="m-0 font-serif font-normal text-3xl md:text-4xl leading-snug tracking-tight text-ink-900">
					{title}
				</h1>
				{sub && <p className="mt-2 mb-0 text-sm text-ink-500">{sub}</p>}
			</div>
			{actions && <div className="flex gap-2.5 shrink-0">{actions}</div>}
		</div>
	);
}
