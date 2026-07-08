import { cva } from "class-variance-authority";

// Pure, RN-free style logic for `Card` — node-testable. Identical across both
// apps; the only branching logic is named-vs-raw padding resolution.

export type CardPadding = "none" | "sm" | "md" | "lg";
export type CardRounded = "md" | "lg" | "xl";
export type CardShadow = "none" | "sm" | "md";

export const CARD_PAD_PX: Record<CardPadding, number> = {
	none: 0,
	sm: 12,
	md: 16,
	lg: 20,
};

export const cardVariants = cva("bg-surface border border-line", {
	variants: {
		rounded: { md: "rounded-md", lg: "rounded-lg", xl: "rounded-xl" },
		shadow: { none: "", sm: "", md: "" },
	},
	defaultVariants: { rounded: "lg", shadow: "sm" },
});

/** Named padding maps to its px; a raw number is used directly. */
export function resolveCardPadding(
	pad: CardPadding | number | undefined,
): number {
	if (typeof pad === "number") return pad;
	return CARD_PAD_PX[pad ?? "md"] ?? CARD_PAD_PX.md;
}
