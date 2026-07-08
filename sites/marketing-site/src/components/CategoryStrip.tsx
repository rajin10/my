"use client";
import * as Icons from "lucide-react";
import { useState } from "react";
import { CATEGORIES } from "./data";

interface CategoryStripProps {
	active: string | null;
	onPick: (cat: string | null) => void;
}

export function CategoryStrip({ active, onPick }: CategoryStripProps) {
	const [hovered, setHovered] = useState<string | null>(null);

	return (
		<section className="max-w-[1200px] mx-auto px-4 md:px-8 pb-3">
			<div className="grid grid-cols-3 md:grid-cols-6 gap-3">
				{CATEGORIES.map((c) => {
					const on = c.label === active;
					const isHovered = hovered === c.label;
					// biome-ignore lint/suspicious/noExplicitAny: dynamic icon
					const IconComp = (Icons as any)[c.icon] as React.ComponentType<{
						size: number;
						className?: string;
					}>;
					return (
						<button
							key={c.label}
							type="button"
							onClick={() => onPick(on ? null : c.label)}
							onPointerEnter={() => setHovered(c.label)}
							onPointerLeave={() => setHovered(null)}
							className={[
								"flex flex-col items-center gap-3 py-5 px-2.5 cursor-pointer",
								"border rounded-lg shadow-xs transition-all duration-normal",
								on
									? "bg-primary-900 border-primary-900"
									: isHovered
										? "bg-primary-50 border-line"
										: "bg-surface border-line",
							].join(" ")}
						>
							<span
								className="w-12 h-12 rounded-full flex items-center justify-center"
								style={{ background: on ? "rgba(255,255,255,0.12)" : c.tone }}
							>
								{IconComp && (
									<IconComp
										size={22}
										className={on ? "text-white" : "text-primary-700"}
									/>
								)}
							</span>
							<span
								className={[
									"font-sans text-sm font-semibold text-center",
									on ? "text-white" : "text-ink-800",
								].join(" ")}
							>
								{c.label}
							</span>
						</button>
					);
				})}
			</div>
		</section>
	);
}
