import { describe, expect, it } from "vitest";
import {
	EYEBROW_BASE_STYLE,
	EYEBROW_CLASSNAME,
	EYEBROW_DEFAULT_COLOR,
} from "./Eyebrow.styles";

describe("Eyebrow styles", () => {
	it("is an uppercase, semibold label", () => {
		expect(EYEBROW_CLASSNAME).toBe("font-semibold uppercase");
	});

	it("uses a small, letter-spaced base style", () => {
		expect(EYEBROW_BASE_STYLE).toEqual({ fontSize: 12, letterSpacing: 2 });
	});

	it("defaults to the brand primary tint", () => {
		expect(EYEBROW_DEFAULT_COLOR).toMatch(/^#/);
	});
});
