import type { BrandPalette } from "@repo/core/src/database/schema/businesses.schema";
import { derivePrimaryTints } from "@repo/tokens";
import { describe, expect, it } from "vitest";
import {
	AA_CONTRAST,
	contrastRatio,
	findContrastViolations,
	paletteContrastPairs,
} from "../../../modules/businesses/contrast";

// The Talash default seeds — the baseline palette the editor starts from. It MUST
// pass its own gate, or owners could never save the default brand.
const TALASH: BrandPalette = {
	primary: "#0e7c66",
	accent: "#c9a063",
	foreground: "#14201c",
	surface: "#ffffff",
};

describe("contrastRatio", () => {
	it("is 21:1 for black on white", () => {
		expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
	});

	it("is 1:1 for identical colours", () => {
		expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
	});

	it("is order-independent", () => {
		expect(contrastRatio("#0e7c66", "#ffffff")).toBeCloseTo(
			contrastRatio("#ffffff", "#0e7c66"),
			5,
		);
	});
});

describe("findContrastViolations", () => {
	it("passes the Talash default palette (no violations)", () => {
		expect(findContrastViolations(TALASH)).toEqual([]);
	});

	it("flags low-contrast body text (foreground on surface)", () => {
		const bad: BrandPalette = { ...TALASH, foreground: "#f3f3f3" };
		const violations = findContrastViolations(bad);
		expect(violations.map((v) => v.label)).toContain(
			"foreground text on surface",
		);
		expect(violations[0]?.required).toBe(AA_CONTRAST);
		expect(violations[0]?.ratio).toBeLessThan(AA_CONTRAST);
	});

	it("flags a too-light primary (white button text becomes unreadable)", () => {
		const bad: BrandPalette = { ...TALASH, primary: "#b8f0d8" };
		const labels = findContrastViolations(bad).map((v) => v.label);
		expect(labels).toContain("button text on primary");
		expect(labels).toContain("primary text on surface");
	});
});

// #97 — the shared Button/Badge now derive a brand ramp (soft/strong/deep) from the
// primary seed. The gate must validate the pairs those derived roles actually render,
// using the SAME derivation the apps render with — so a saved palette can never paint
// an unreadable subtle/dark button or brand badge.
describe("derived brand-tint contrast pairs (#97)", () => {
	const DEMO_PURPLE: BrandPalette = {
		primary: "#5B2A86",
		accent: "#c9a063",
		foreground: "#1a1320",
		surface: "#fdfbff",
	};

	it("gates the derived subtle/brand text-on-tint pair via the shared derivation", () => {
		const tints = derivePrimaryTints(TALASH.primary);
		const pair = paletteContrastPairs(TALASH).find(
			(p) => p.label === "subtle text on brand tint",
		);
		expect(pair).toBeDefined();
		expect(pair?.fg).toBe(tints.strong);
		expect(pair?.bg).toBe(tints.soft);
	});

	it("gates the derived dark-button white-on-deep pair via the shared derivation", () => {
		const tints = derivePrimaryTints(TALASH.primary);
		const pair = paletteContrastPairs(TALASH).find(
			(p) => p.label === "dark button text on deep brand fill",
		);
		expect(pair).toBeDefined();
		expect(pair?.fg).toBe("#ffffff");
		expect(pair?.bg).toBe(tints.deep);
	});

	it("passes the Talash default palette on the derived pairs", () => {
		// The base test above also covers this now that the pairs are included, but
		// assert the derived pairs specifically are readable.
		const derivedLabels = new Set([
			"subtle text on brand tint",
			"dark button text on deep brand fill",
		]);
		const violations = findContrastViolations(TALASH).filter((v) =>
			derivedLabels.has(v.label),
		);
		expect(violations).toEqual([]);
	});

	it("passes an arbitrary readable tenant palette (demo purple) on the derived pairs", () => {
		expect(findContrastViolations(DEMO_PURPLE)).toEqual([]);
	});
});
