"use client";
import { cva, type VariantProps } from "class-variance-authority";
import * as Icons from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export const buttonVariants = cva(
	cn(
		"font-sans font-semibold border-none cursor-pointer rounded-md",
		"inline-flex items-center justify-center gap-2 whitespace-nowrap leading-none",
		"transition-all duration-fast no-underline",
		"disabled:cursor-not-allowed",
	),
	{
		variants: {
			variant: {
				// Brand variants paint with the THEMEABLE role tokens (primary /
				// primary-soft / primary-muted / primary-strong / primary-deep /
				// on-primary) so they repaint per tenant inside a `BrandThemeBoundary`
				// subtree — mirrors ui-native #97. Status/neutral variants stay static.
				primary: cn(
					"bg-primary hover:bg-primary-strong text-on-primary shadow-xs disabled:bg-line disabled:text-ink-300",
				),
				ghost: cn(
					"bg-surface hover:bg-primary-soft text-ink-800 ring-1 ring-inset ring-line-strong",
				),
				subtle: cn(
					"bg-primary-soft hover:bg-primary-muted text-primary-strong",
				),
				danger: cn(
					"bg-surface hover:bg-danger-bg text-danger-fg ring-1 ring-inset ring-line-strong",
				),
				quiet: cn("bg-transparent hover:bg-line-soft text-ink-600"),
				// Marketing palette
				light: cn("bg-white/90 hover:bg-white text-primary-deep"),
				// Deep is the darkest brand role; hover dims it (themed) instead of
				// jumping to a static black, so it stays on-brand under a tenant palette.
				dark: cn("bg-primary-deep hover:bg-primary-deep/90 text-on-primary"),
			},
			size: {
				sm: "text-xs px-3.5 py-2",
				md: "text-sm px-4 py-2.5",
				lg: "text-base px-5 py-3",
			},
		},
		defaultVariants: {
			variant: "primary",
			size: "md",
		},
	},
);

export interface ButtonProps extends VariantProps<typeof buttonVariants> {
	children?: ReactNode;
	icon?: string;
	iconRight?: string;
	onClick?: () => void;
	disabled?: boolean;
	className?: string;
	type?: "button" | "submit";
}

export function Button({
	children,
	variant,
	size,
	icon,
	iconRight,
	onClick,
	disabled,
	className,
	type = "button",
}: ButtonProps) {
	const iconSize = size === "sm" ? 16 : size === "lg" ? 20 : 18;
	// biome-ignore lint/suspicious/noExplicitAny: dynamic icon lookup
	const LeftIcon = icon ? (Icons as any)[icon] : null;
	// biome-ignore lint/suspicious/noExplicitAny: dynamic icon lookup
	const RightIcon = iconRight ? (Icons as any)[iconRight] : null;

	return (
		<button
			type={type}
			onClick={disabled ? undefined : onClick}
			disabled={disabled}
			className={cn(buttonVariants({ variant, size }), className)}
		>
			{LeftIcon && <LeftIcon size={iconSize} />}
			{children}
			{RightIcon && <RightIcon size={iconSize} />}
		</button>
	);
}
