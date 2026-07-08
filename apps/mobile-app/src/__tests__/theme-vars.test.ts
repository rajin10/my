import { derivePrimaryTints } from "@repo/tokens";
import { describe, expect, it } from "vitest";
import {
	DEMO_BRAND_PALETTE,
	paletteToVars,
	THEMEABLE_VARS,
} from "../lib/theme-vars";

describe("paletteToVars", () => {
	it("maps the palette to the themeable roles + derived brand ramp (#97)", () => {
		const palette = {
			primary: "#5B2A86",
			accent: "#C9A063",
			foreground: "#1A1320",
			surface: "#FDFBFF",
		};
		const tints = derivePrimaryTints(palette.primary);
		const vars = paletteToVars(palette);

		expect(vars).toEqual({
			"--color-primary": "#5B2A86",
			"--color-primary-soft": tints.soft,
			"--color-primary-muted": tints.muted,
			"--color-primary-strong": tints.strong,
			"--color-primary-deep": tints.deep,
			"--color-accent": "#C9A063",
			"--color-surface": "#FDFBFF",
		});
	});

	it("emits only the THEMEABLE_VARS keys", () => {
		const vars = paletteToVars(DEMO_BRAND_PALETTE);
		expect(Object.keys(vars).sort()).toEqual([...THEMEABLE_VARS].sort());
	});

	it("never emits a static role (ink, status, or line)", () => {
		const vars = paletteToVars(DEMO_BRAND_PALETTE);
		const keys = Object.keys(vars);

		expect(keys.some((k) => k.startsWith("--color-ink"))).toBe(false);
		expect(keys.some((k) => k.startsWith("--color-line"))).toBe(false);
		for (const status of ["success", "danger", "pending", "info"]) {
			expect(keys.some((k) => k.startsWith(`--color-${status}`))).toBe(false);
		}
	});

	it("does not emit a custom property for foreground (deferred per ADR-0002)", () => {
		const vars = paletteToVars(DEMO_BRAND_PALETTE);
		expect(Object.values(vars)).not.toContain(DEMO_BRAND_PALETTE.foreground);
		expect(vars).not.toHaveProperty("--color-foreground");
		expect(vars).not.toHaveProperty("--color-ink");
	});
});
