import type { BrandPalette } from "@repo/api-client";

// Talash semantic-role defaults (mirror @repo/tokens theme.css) — the palette the
// branding editor starts from when a business has no saved brand yet. Editing from
// the real defaults (not white) gives owners a sensible, on-brand starting point.
export const DEFAULT_PALETTE_SEEDS: BrandPalette = {
	primary: "#0e7c66",
	accent: "#c9a063",
	foreground: "#14201c",
	surface: "#ffffff",
};

// The roles an owner edits, in display order. `foreground` is collected here (the
// editor captures the full palette #57 persists) even though the render-path token
// for it is deferred (ADR-0002) — the API stores all four seeds.
export const PALETTE_ROLES = [
	"primary",
	"accent",
	"foreground",
	"surface",
] as const;

export function palettesEqual(a: BrandPalette, b: BrandPalette): boolean {
	return PALETTE_ROLES.every((role) => a[role] === b[role]);
}
