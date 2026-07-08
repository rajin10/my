"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";

type ThemePreference = "system" | "light" | "dark";

const OPTIONS: {
	value: ThemePreference;
	label: string;
	Icon: typeof Sun;
}[] = [
	{ value: "system", label: "System", Icon: Monitor },
	{ value: "light", label: "Light", Icon: Sun },
	{ value: "dark", label: "Dark", Icon: Moon },
];

function optionFor(theme: string | undefined) {
	return OPTIONS.find((o) => o.value === theme) ?? OPTIONS[0];
}

export function ColorSchemeToggle({ className }: { className?: string }) {
	const { theme, setTheme } = useTheme();
	const [open, setOpen] = useState(false);
	const [mounted, setMounted] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	const active = optionFor(theme);

	useEffect(() => setMounted(true), []);

	useEffect(() => {
		if (!open) return;
		function handle(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node))
				setOpen(false);
		}
		document.addEventListener("mousedown", handle);
		return () => document.removeEventListener("mousedown", handle);
	}, [open]);

	if (!mounted) {
		return <div className={cn("w-9 h-9 shrink-0", className)} aria-hidden />;
	}

	return (
		<div ref={ref} className={cn("relative shrink-0", className)}>
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="w-9 h-9 rounded-full border border-line bg-surface flex items-center justify-center cursor-pointer"
				aria-label={`Theme: ${active.label}. Click to change.`}
				aria-expanded={open}
				aria-haspopup="menu"
			>
				<active.Icon size={16} className="text-ink-700" />
			</button>
			{open && (
				<div
					role="menu"
					className="absolute right-0 top-full mt-2 w-36 bg-surface rounded-xl border border-line shadow-lg z-50 overflow-hidden py-1"
				>
					{OPTIONS.map(({ value, label, Icon }) => (
						<button
							key={value}
							type="button"
							role="menuitemradio"
							aria-checked={theme === value}
							onClick={() => {
								setTheme(value);
								setOpen(false);
							}}
							className={cn(
								"w-full flex items-center gap-2.5 px-3 py-2 text-left font-sans text-sm cursor-pointer border-none",
								theme === value
									? "bg-line-soft text-ink font-semibold"
									: "bg-transparent text-ink-muted hover:bg-line-soft font-medium",
							)}
						>
							<Icon size={15} className="shrink-0" />
							{label}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
