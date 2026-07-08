import { describe, expect, it } from "vitest";
import { ICON_SIZE_PX, iconSizeVariant, resolveIconPx } from "./Icon.styles";

describe("resolveIconPx", () => {
	it("maps each token size to its pixel value", () => {
		expect(resolveIconPx("xs")).toBe(ICON_SIZE_PX.xs);
		expect(resolveIconPx("md")).toBe(ICON_SIZE_PX.md);
		expect(resolveIconPx("xl")).toBe(ICON_SIZE_PX.xl);
	});

	it("uses a numeric size directly (owner-app feature)", () => {
		expect(resolveIconPx(42)).toBe(42);
	});

	it("lets sizePx override both token and numeric size", () => {
		expect(resolveIconPx("md", 9)).toBe(9);
		expect(resolveIconPx(42, 9)).toBe(9);
	});

	it("falls back to md when size is undefined", () => {
		expect(resolveIconPx(undefined)).toBe(ICON_SIZE_PX.md);
	});
});

describe("iconSizeVariant", () => {
	it("passes a token size through for the className", () => {
		expect(iconSizeVariant("lg")).toBe("lg");
	});

	it("collapses a numeric size to md (no scale class applies)", () => {
		expect(iconSizeVariant(48)).toBe("md");
	});

	it("defaults to md when undefined", () => {
		expect(iconSizeVariant(undefined)).toBe("md");
	});
});
