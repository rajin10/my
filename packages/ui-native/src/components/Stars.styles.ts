import { cva } from "class-variance-authority";

// Pure, RN-free style logic for `Stars` — node-testable. Superset of both apps:
// owner-app's numeric `size` over mobile-app's token-only sizes.

export type StarSize = "xs" | "sm" | "md" | "lg";

export const STAR_SIZE_PX: Record<StarSize, number> = {
	xs: 11,
	sm: 13,
	md: 15,
	lg: 18,
};

export const starsVariants = cva("flex-row gap-px", {
	variants: {
		size: { xs: "", sm: "", md: "", lg: "" },
	},
	defaultVariants: { size: "sm" },
});

/** Whole filled stars for a 0–5 rating. */
export function filledCount(value: number): number {
	return Math.round(value);
}

export function resolveStarPx(
	size: StarSize | number | undefined,
	sizePx?: number,
): number {
	if (sizePx != null) return sizePx;
	if (typeof size === "number") return size;
	return STAR_SIZE_PX[size ?? "sm"] ?? STAR_SIZE_PX.sm;
}

export function starSizeKey(size: StarSize | number | undefined): StarSize {
	return typeof size === "string" ? size : "sm";
}
