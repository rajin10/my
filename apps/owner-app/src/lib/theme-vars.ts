import type { BrandPalette } from "@repo/api-client";
import { derivePrimaryTints } from "@repo/tokens";

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
