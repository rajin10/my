import type { BrandPalette } from "@repo/api-client";
import { derivePrimaryTints } from "@repo/tokens";

// Web mirror of the mobile `vars()` boundary (#55, apps/mobile-app/src/lib/theme-vars.ts).
// The themeable custom properties a tenant palette may override (ADR-0002):
// only the brand roles — ink/line/status stay static, `foreground` is
// deferred (no token; ADR-0003 / #59/#60). The primary brand ramp
// (soft/muted/strong/deep) is derived from the primary seed (#97).
export const THEMEABLE_VARS = [
	"--color-primary",
	"--color-primary-soft",
	"--color-primary-muted",
	"--color-primary-strong",
	"--color-primary-deep",
	"--color-accent",
	"--color-surface",
] as const;

/**
 * Maps the owner-chosen palette seeds to the themeable CSS custom properties,
 * ready to spread onto a wrapper's inline `style` (subtree-scoped override). The
 * primary seed also drives a derived brand ramp (soft/muted/strong/deep, #97),
 * shared with the API WCAG gate (@repo/tokens) so rendered colours == gated
 * colours. `foreground` is intentionally omitted; static roles are never touched.
 */
export function paletteToVars(
	palette: BrandPalette,
): Record<(typeof THEMEABLE_VARS)[number], string> {
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

// Hardcoded palette for the mechanism proof / manual smoke (mirrors mobile).
export const DEMO_BRAND_PALETTE: BrandPalette = {
	primary: "#5B2A86",
	accent: "#C9A063",
	foreground: "#1A1320",
	surface: "#FDFBFF",
};
