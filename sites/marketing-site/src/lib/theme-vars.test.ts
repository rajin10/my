import type { BrandPalette } from "@repo/api-client";
import { derivePrimaryTints } from "@repo/tokens";
import { describe, expect, it } from "vitest";
import { paletteToVars, THEMEABLE_VARS } from "./theme-vars";

const PALETTE: BrandPalette = {
	primary: "#5B2A86",
	accent: "#C9A063",
	foreground: "#1A1320",
	surface: "#FDFBFF",
};

describe("paletteToVars", () => {
	it("maps the seeds + derived brand ramp to their custom properties (#97)", () => {
		const tints = derivePrimaryTints(PALETTE.primary);
		expect(paletteToVars(PALETTE)).toEqual({
			"--color-primary": "#5B2A86",
			"--color-primary-soft": tints.soft,
			"--color-primary-muted": tints.muted,
			"--color-primary-strong": tints.strong,
			"--color-primary-deep": tints.deep,
			"--color-accent": "#C9A063",
			"--color-surface": "#FDFBFF",
		});
	});

	it("omits foreground (deferred) and only emits the themeable roles", () => {
		const vars = paletteToVars(PALETTE);
		expect(vars).not.toHaveProperty("--color-foreground");
		expect(Object.keys(vars).sort()).toEqual([...THEMEABLE_VARS].sort());
	});

	it("never emits static roles (ink/line/status)", () => {
		const keys = Object.keys(paletteToVars(PALETTE)).join(" ");
		expect(keys).not.toMatch(/ink|line|danger|success|pending|info/);
	});
});
