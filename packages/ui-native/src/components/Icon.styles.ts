import { cva } from "class-variance-authority";

// Pure, RN-free style logic for `Icon` — node-testable. The `.tsx` component
// owns the lucide binding (`IconName`) and rendering.

export type IconSize = "xs" | "sm" | "md" | "lg" | "xl";

export const ICON_SIZE_PX: Record<IconSize, number> = {
	xs: 12,
	sm: 16,
	md: 20,
	lg: 24,
	xl: 32,
};

export const iconVariants = cva("items-center justify-center", {
	variants: {
		size: { xs: "", sm: "", md: "", lg: "", xl: "" },
	},
	defaultVariants: { size: "md" },
});

/**
 * Resolve the rendered pixel size. `sizePx` wins over everything; a numeric
 * `size` is used directly (owner-app feature); a token `size` maps via
 * {@link ICON_SIZE_PX}; `undefined` falls back to `md`.
 */
export function resolveIconPx(
	size: IconSize | number | undefined,
	sizePx?: number,
): number {
	if (sizePx != null) return sizePx;
	if (typeof size === "number") return size;
	return ICON_SIZE_PX[size ?? "md"] ?? ICON_SIZE_PX.md;
}

/** The token-size variant for the className — numeric sizes collapse to `md`. */
export function iconSizeVariant(size: IconSize | number | undefined): IconSize {
	return typeof size === "string" ? size : "md";
}
