"use client";
import type { ReactNode } from "react";
import { Icon } from "./icon";

export function Modal({
	title,
	sub,
	onClose,
	children,
	footer,
	width = 460,
}: {
	title: string;
	sub?: string;
	onClose: () => void;
	children: ReactNode;
	footer?: ReactNode;
	width?: number;
}) {
	return (
		<div className="fixed inset-0 z-80 flex items-center justify-center p-6">
			{/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: backdrop click-to-dismiss pattern */}
			<div onClick={onClose} className="absolute inset-0 bg-primary-950/40" />
			<div
				style={{ width }}
				className="relative max-w-full max-h-[90vh] overflow-y-auto bg-surface rounded-xl shadow-xl"
			>
				<div className="flex items-start justify-between gap-4 px-6 pt-5">
					<div>
						<h3 className="m-0 font-serif font-normal text-2xl tracking-tight text-ink-900">
							{title}
						</h3>
						{sub && <p className="mt-1.5 mb-0 text-sm text-ink-500">{sub}</p>}
					</div>
					<button
						type="button"
						onClick={onClose}
						className="w-8 h-8 rounded-full border-none bg-primary-50 cursor-pointer flex items-center justify-center shrink-0"
					>
						<Icon name="X" size={18} className="text-ink-600" />
					</button>
				</div>
				<div className="px-6 py-5">{children}</div>
				{footer && (
					<div className="flex justify-end gap-2.5 px-6 py-4 border-t border-line">
						{footer}
					</div>
				)}
			</div>
		</div>
	);
}
