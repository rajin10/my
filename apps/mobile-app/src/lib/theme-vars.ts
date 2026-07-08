import { derivePrimaryTints } from "@repo/tokens";

// Mirrors @repo/api-client's BrandPalette; replace with the import once #89 merges.
export type BrandPalette = {
	primary: string;
	accent: string;
	foreground: string; // deferred — see #59/#60
	surface: string;
};

// The themeable custom properties a tenant palette may override (ADR-0002). The
// primary brand ramp (soft/muted/strong/deep) is derived from the primary seed (#97).
export const THEMEABLE_VARS = [
	"--color-primary",
	"--color-primary-soft",
	"--color-primary-muted",
	"--color-primary-strong",
	"--color-primary-deep",
	"--color-accent",
	"--color-surface",
] as const;

// Maps the owner-chosen seeds to the themeable custom properties. The primary seed
// also drives a derived brand ramp (soft/muted/strong/deep, #97) so the shared
// Button/Badge repaint per tenant; the derivation is shared with the API WCAG gate
// (@repo/tokens) so rendered colours == gated colours. `foreground` is intentionally
// omitted (no token; ink stays static per ADR-0002) — handled in #59/#60.
export function paletteToVars(
	palette: BrandPalette,
): Record<`--${string}`, string> {
	const tints = derivePrimaryTints(palette.primary);
	return {
		"--color-primary": palette.primary,
		"--color-primary-soft": tints.soft,
		"--color-primary-muted": tints.muted,
		"--color-primary-strong": tints.strong,
		"--color-primary-deep": tints.deep,
		"--color-accent": palette.accent,
		"--color-surface": palette.surface,
	};
}

// Hardcoded palette for the mechanism proof / manual smoke.
export const DEMO_BRAND_PALETTE: BrandPalette = {
	primary: "#5B2A86",
	accent: "#C9A063",
	foreground: "#1A1320",
	surface: "#FDFBFF",
};
