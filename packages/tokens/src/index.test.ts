import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Colors, DarkColors } from "./index";

// Parse `--color-*` custom properties out of the shared theme.css.
function parseThemeColors(): Record<string, string> {
	const css = readFileSync(
		fileURLToPath(new URL("./theme.css", import.meta.url)),
		"utf8",
	);
	const out: Record<string, string> = {};
	const re = /--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6});/g;
	for (const m of css.matchAll(re)) {
		// kebab → camelCase: "green-600" → "primary600", "on-primary" → "onPrimary"
		const key = m[1].replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
		out[key] = m[2].toLowerCase();
	}
	return out;
}

const DARK_OVERRIDE_KEYS = [
	"ink900",
	"ink800",
	"ink700",
	"ink600",
	"ink500",
	"ink400",
	"ink300",
	"lineStrong",
	"line",
	"lineSoft",
	"surface",
	"paper",
	"cream",
	"creamDeep",
	"ink",
	"inkMuted",
	"inkSubtle",
] as const;

function parseDarkCssColors(): Record<string, string> {
	const css = readFileSync(
		fileURLToPath(new URL("./dark.css", import.meta.url)),
		"utf8",
	);
	const out: Record<string, string> = {};
	const re = /--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6});/g;
	for (const m of css.matchAll(re)) {
		const key = m[1].replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
		out[key] = m[2].toLowerCase();
	}
	return out;
}

describe("token sync: theme.css ↔ index.ts", () => {
	const cssColors = parseThemeColors();

	it("every CSS color var has a matching Colors entry with the same value", () => {
		for (const [key, value] of Object.entries(cssColors)) {
			expect(Colors, `Colors is missing "${key}"`).toHaveProperty(key);
			expect(
				(Colors as Record<string, string>)[key]?.toLowerCase(),
				`value mismatch for "${key}"`,
			).toBe(value);
		}
	});

	it("every Colors entry has a matching CSS color var (no drift either way)", () => {
		for (const [key, value] of Object.entries(Colors)) {
			expect(
				cssColors,
				`theme.css is missing "--color-*" for "${key}"`,
			).toHaveProperty(key);
			expect(cssColors[key], `value mismatch for "${key}"`).toBe(
				value.toLowerCase(),
			);
		}
	});
});

describe("token sync: dark.css ↔ DarkColors", () => {
	const darkCssColors = parseDarkCssColors();

	it("every DarkColors override has a matching dark.css var", () => {
		for (const key of DARK_OVERRIDE_KEYS) {
			expect(
				darkCssColors,
				`dark.css is missing "--color-*" for "${key}"`,
			).toHaveProperty(key);
			expect(
				(DarkColors as Record<string, string>)[key]?.toLowerCase(),
				`value mismatch for "${key}"`,
			).toBe(darkCssColors[key]);
		}
	});
});
