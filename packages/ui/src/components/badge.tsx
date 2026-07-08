import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export const badgeVariants = cva(
	"inline-flex items-center gap-1.5 rounded-full text-xs font-semibold font-sans whitespace-nowrap",
	{
		variants: {
			variant: {
				default: "bg-line-soft text-ink-600",
				success: "bg-success-bg text-success-fg",
				pending: "bg-pending-bg text-pending-fg",
				danger: "bg-danger-bg text-danger-fg",
				info: "bg-info-bg text-info-fg",
				// Themeable brand badge — soft fill + strong label repaint per tenant
				// inside a `BrandThemeBoundary` subtree (mirrors ui-native #97 `brand`).
				primary: "bg-primary-soft text-primary-strong",
				outline: "border border-line-strong text-ink-700 bg-transparent",
			},
			size: {
				sm: "px-2 py-0.5",
				md: "px-3 py-1",
			},
			dot: {
				true: "",
				false: "",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "md",
			dot: false,
		},
	},
);

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
	children: ReactNode;
	className?: string;
}

export function Badge({ children, variant, size, dot, className }: BadgeProps) {
	const dotColor: Record<string, string> = {
		default: "bg-ink-400",
		success: "bg-success",
		pending: "bg-pending",
		danger: "bg-danger",
		info: "bg-info",
		primary: "bg-primary",
		outline: "bg-ink-400",
	};

	return (
		<span className={cn(badgeVariants({ variant, size }), className)}>
			{dot && (
				<span
					className={cn(
						"w-1.5 h-1.5 rounded-full shrink-0",
						dotColor[variant ?? "default"],
					)}
				/>
			)}
			{children}
		</span>
	);
}
