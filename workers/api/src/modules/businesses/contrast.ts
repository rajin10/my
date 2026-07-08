import type { BrandPalette } from "@repo/core/src/database/schema/businesses.schema";
import { derivePrimaryTints } from "@repo/tokens";

// WCAG 2.1 AA minimum contrast for normal text. We apply it to every pair (no
// large-text 3:1 exemption) — conservative, since the same roles back both body
// and heading text in the customer reskin (ADR-0003).
export const AA_CONTRAST = 4.5;

// Static "on-" roles from @repo/tokens theme.css that render over the custom fills
// and are never themeable: white button/label text on the primary fill, and ink
// text on the accent fill. The gate must pair these with the owner's chosen colours
// because that is what actually renders.
const ON_PRIMARY = "#ffffff";
const ON_ACCENT = "#14201c";

export type ContrastPair = { label: string; fg: string; bg: string };

// The foreground/background pairs the customer reskin renders together. Each is a
// real readability surface in the booking flow:
//  - body/ink text sits on the surface background
//  - the primary colour is used as heading/link text on the surface
//  - white labels sit on primary-filled buttons/badges
//  - ink labels sit on accent-filled chips
export function paletteContrastPairs(p: BrandPalette): ContrastPair[] {
	// #97 — the shared Button/Badge derive a brand ramp (soft/strong/deep) from the
	// primary seed via @repo/tokens. The gate validates the pairs those derived roles
	// render, using the SAME derivation, so a saved palette can never paint an
	// unreadable subtle/dark button or brand badge.
	const tints = derivePrimaryTints(p.primary);
	return [
		{ label: "foreground text on surface", fg: p.foreground, bg: p.surface },
		{ label: "primary text on surface", fg: p.primary, bg: p.surface },
		{ label: "button text on primary", fg: ON_PRIMARY, bg: p.primary },
		{ label: "text on accent", fg: ON_ACCENT, bg: p.accent },
		// subtle button + brand badge: emphasis text on the light brand tint.
		{ label: "subtle text on brand tint", fg: tints.strong, bg: tints.soft },
		// `dark` button: white label on the deep brand fill.
		{
			label: "dark button text on deep brand fill",
			fg: ON_PRIMARY,
			bg: tints.deep,
		},
	];
}

function channelLuminance(channel: number): number {
	const c = channel / 255;
	return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

// WCAG relative luminance of a 6-digit hex colour.
export function relativeLuminance(hex: string): number {
	const n = hex.replace("#", "");
	const r = Number.parseInt(n.slice(0, 2), 16);
	const g = Number.parseInt(n.slice(2, 4), 16);
	const b = Number.parseInt(n.slice(4, 6), 16);
	return (
		0.2126 * channelLuminance(r) +
		0.7152 * channelLuminance(g) +
		0.0722 * channelLuminance(b)
	);
}

// WCAG contrast ratio (1–21), order-independent.
export function contrastRatio(a: string, b: string): number {
	const la = relativeLuminance(a);
	const lb = relativeLuminance(b);
	const lighter = Math.max(la, lb);
	const darker = Math.min(la, lb);
	return (lighter + 0.05) / (darker + 0.05);
}

export type ContrastViolation = {
	label: string;
	ratio: number;
	required: number;
};

// Returns the pairs that fall below AA. Empty array ⇒ the palette is readable.
export function findContrastViolations(p: BrandPalette): ContrastViolation[] {
	return paletteContrastPairs(p)
		.map(({ label, fg, bg }) => ({
			label,
			ratio: Math.round(contrastRatio(fg, bg) * 100) / 100,
			required: AA_CONTRAST,
		}))
		.filter((v) => v.ratio < AA_CONTRAST);
}
