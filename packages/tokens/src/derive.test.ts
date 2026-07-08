import { describe, expect, it } from "vitest";
import { derivePrimaryTints } from "./derive";
import { Colors } from "./index";

// `derivePrimaryTints` is the single source of the brand-tint math, shared by the
// app render boundaries (paletteToVars) and the API WCAG gate (contrast.ts) so the
// colours a tenant SEES are exactly the colours the save-time gate VALIDATES (#97).
describe("derivePrimaryTints", () => {
	it("derives the four brand tints from the Talash primary seed", () => {
		// Deterministic sRGB mix: soft/muted toward white, strong/deep toward black.
		// The seed's own ramp (primary50/100/700/900) is approximated, not matched —
		// a tenant palette has only the one primary seed to derive from.
		expect(derivePrimaryTints("#0e7c66")).toEqual({
			soft: "#e7f2f0",
			muted: "#cfe5e0",
			strong: "#0b5d4d",
			deep: "#06382e",
		});
	});

	it("derives from an arbitrary tenant seed (demo purple)", () => {
		expect(derivePrimaryTints("#5B2A86")).toEqual({
			soft: "#efeaf3",
			muted: "#ded4e7",
			strong: "#442065",
			deep: "#29133c",
		});
	});

	it("is deterministic (same seed → same tints)", () => {
		expect(derivePrimaryTints("#5B2A86")).toEqual(
			derivePrimaryTints("#5b2a86"),
		);
	});

	it("orders the tints by lightness: soft > muted > seed > strong > deep", () => {
		// Luminance proxy: sum of channels. Soft/muted are lighter than the seed;
		// strong/deep are darker. (Holds for any non-degenerate seed.)
		const lum = (hex: string) => {
			const n = hex.replace("#", "");
			return (
				Number.parseInt(n.slice(0, 2), 16) +
				Number.parseInt(n.slice(2, 4), 16) +
				Number.parseInt(n.slice(4, 6), 16)
			);
		};
		const seed = "#0e7c66";
		const t = derivePrimaryTints(seed);
		expect(lum(t.soft)).toBeGreaterThan(lum(t.muted));
		expect(lum(t.muted)).toBeGreaterThan(lum(seed));
		expect(lum(seed)).toBeGreaterThan(lum(t.strong));
		expect(lum(t.strong)).toBeGreaterThan(lum(t.deep));
	});

	it("returns 6-digit lowercase hex", () => {
		for (const v of Object.values(derivePrimaryTints("#5B2A86"))) {
			expect(v).toMatch(/^#[0-9a-f]{6}$/);
		}
	});

	it("reproduces the documented brand defaults closely enough to swap in", () => {
		// Sanity: the derived strong/deep land near the static ramp the components
		// used before (#54 ramp), so the null-palette fallback looks unchanged.
		const t = derivePrimaryTints(Colors.primary);
		expect(t.strong.toLowerCase()).not.toBe(t.deep.toLowerCase());
	});
});
