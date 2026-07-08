// Brand-tint derivation — the single source of the per-tenant primary ramp (#97).
//
// A tenant palette carries only one brand seed (`primary`), but the shared
// Button/Badge need four shades: a light surface (`soft`), a tinted border
// (`muted`), an emphasis shade for text/icons (`strong`), and a deep fill
// (`deep`). This file derives all four deterministically so that:
//   1. the app render boundaries (`paletteToVars`) and
//   2. the API WCAG-AA save gate (`contrast.ts`)
// compute the EXACT same colours — the ones a tenant sees are the ones the gate
// validated. Keep this the only home for the math; do not inline a second copy.

export type PrimaryTints = {
	/** Light tinted surface — subtle button bg, brand badge bg. */
	soft: string;
	/** Stronger tint — subtle button border. */
	muted: string;
	/** Emphasis shade — subtle/brand text (themeable text role). */
	strong: string;
	/** Deep fill — `dark` button bg. */
	deep: string;
};

function clampChannel(n: number): number {
	return Math.max(0, Math.min(255, Math.round(n)));
}

function toHex(channel: number): string {
	return clampChannel(channel).toString(16).padStart(2, "0");
}

function parseHex(hex: string): [number, number, number] {
	const n = hex.replace("#", "");
	return [
		Number.parseInt(n.slice(0, 2), 16),
		Number.parseInt(n.slice(2, 4), 16),
		Number.parseInt(n.slice(4, 6), 16),
	];
}

// Mix `hex` toward `target` by weight `t` (t=1 → fully target). sRGB-space mix:
// simple, deterministic, and good enough for UI tints (no gamma round-trip).
function mix(hex: string, target: [number, number, number], t: number): string {
	const [r, g, b] = parseHex(hex);
	const [tr, tg, tb] = target;
	return `#${toHex(r + (tr - r) * t)}${toHex(g + (tg - g) * t)}${toHex(
		b + (tb - b) * t,
	)}`;
}

const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [0, 0, 0];

/**
 * Derive the four brand tints from a single `primary` seed (6-digit hex).
 * Returns lowercase 6-digit hex. The weights approximate the Talash ramp
 * (primary100/200/700/900) so the null-palette fallback looks unchanged.
 */
export function derivePrimaryTints(primary: string): PrimaryTints {
	return {
		soft: mix(primary, WHITE, 0.9),
		muted: mix(primary, WHITE, 0.8),
		strong: mix(primary, BLACK, 0.25),
		deep: mix(primary, BLACK, 0.55),
	};
}
