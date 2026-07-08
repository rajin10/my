import type { BrandPalette } from "@repo/api-client";
import { describe, expect, it } from "vitest";
import { DEFAULT_PALETTE_SEEDS, palettesEqual } from "../lib/branding";

describe("DEFAULT_PALETTE_SEEDS", () => {
	it("provides the four Talash default seeds the editor starts from", () => {
		expect(DEFAULT_PALETTE_SEEDS).toEqual({
			primary: "#0e7c66",
			accent: "#c9a063",
			foreground: "#14201c",
			surface: "#ffffff",
		});
	});
});

describe("palettesEqual", () => {
	const base: BrandPalette = {
		primary: "#0e7c66",
		accent: "#c9a063",
		foreground: "#14201c",
		surface: "#ffffff",
	};

	it("is true for identical palettes", () => {
		expect(palettesEqual(base, { ...base })).toBe(true);
	});

	it("is false when any role differs", () => {
		expect(palettesEqual(base, { ...base, primary: "#5b2a86" })).toBe(false);
		expect(palettesEqual(base, { ...base, surface: "#fdfbff" })).toBe(false);
	});
});
