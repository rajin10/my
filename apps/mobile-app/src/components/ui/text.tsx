/**
 * Typography primitive with semantic variants.
 *
 * Font sizes remain as inline styles because the design system uses
 * non-standard values (13.5, 14.5, 15.5…) that don't map to Tailwind's
 * default scale. Everything else (color, weight, alignment, transform)
 * goes through CVA → className.
 */

import { cva, type VariantProps } from "class-variance-authority";
import {
	Text as RNText,
	type TextProps as RNTextProps,
	type TextStyle,
} from "react-native";
import { cn } from "../../lib/cn";

const textVariants = cva("", {
	variants: {
		variant: {
			display: "font-normal",
			title: "font-normal",
			heading: "font-medium",
			subhead: "font-semibold",
			body: "",
			bodySmall: "",
			caption: "",
			label: "font-semibold uppercase",
			mono: "font-normal",
		},
		color: {
			default: "text-ink-900",
			muted: "text-ink-500",
			subtle: "text-ink-400",
			brand: "text-primary-600",
			success: "text-success-fg",
			danger: "text-danger-fg",
			pending: "text-pending-fg",
			white: "text-white",
			inherit: "",
		},
		align: {
			left: "text-left",
			center: "text-center",
			right: "text-right",
		},
		weight: {
			normal: "font-normal",
			medium: "font-medium",
			semibold: "font-semibold",
			bold: "font-bold",
		},
	},
	defaultVariants: {
		variant: "body",
		color: "default",
		align: "left",
	},
});

/** Font sizes for each named variant — override with `sizePx` if needed. */
const VARIANT_SIZE: Record<string, number> = {
	display: 32,
	title: 26,
	heading: 22,
	subhead: 17,
	body: 15,
	bodySmall: 14,
	caption: 12,
	label: 12,
	mono: 15,
};

export type TextVariant =
	| "display"
	| "title"
	| "heading"
	| "subhead"
	| "body"
	| "bodySmall"
	| "caption"
	| "label"
	| "mono";
export type TextColor =
	| "default"
	| "muted"
	| "subtle"
	| "brand"
	| "success"
	| "danger"
	| "pending"
	| "white"
	| "inherit";

export type AppTextProps = VariantProps<typeof textVariants> &
	Omit<RNTextProps, "style"> & {
		/** Explicit font size — overrides the variant default. */
		sizePx?: number;
		/** Explicit letter spacing — no Tailwind equivalent for negative values. */
		tracking?: number;
		/** Line height in pixels. */
		leading?: number;
		style?: TextStyle;
	};

export function AppText({
	variant = "body",
	color = "default",
	align = "left",
	weight,
	sizePx,
	tracking,
	leading,
	style,
	className,
	...rest
}: AppTextProps) {
	const fs = sizePx ?? VARIANT_SIZE[variant ?? "body"] ?? 15;

	return (
		<RNText
			className={cn(textVariants({ variant, color, align, weight }), className)}
			style={[
				{ fontSize: fs },
				tracking != null && { letterSpacing: tracking },
				leading != null && { lineHeight: leading },
				style,
			]}
			{...rest}
		/>
	);
}
