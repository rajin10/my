import { Colors } from "@repo/tokens";

// Pure, RN-free style logic for `Eyebrow` — node-testable. Identical across both
// apps (#96): an uppercase, letter-spaced label tinted with the brand primary.

export const EYEBROW_CLASSNAME = "font-semibold uppercase";

export const EYEBROW_BASE_STYLE = {
	fontSize: 12,
	letterSpacing: 2,
} as const;

/** Default tint when a caller doesn't override `color`. */
export const EYEBROW_DEFAULT_COLOR = Colors.primary600;
