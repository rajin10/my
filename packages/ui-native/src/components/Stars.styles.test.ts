import { describe, expect, it } from "vitest";
import {
	filledCount,
	resolveStarPx,
	STAR_SIZE_PX,
	starSizeKey,
} from "./Stars.styles";

describe("filledCount", () => {
	it("rounds the rating to whole stars", () => {
		expect(filledCount(4.4)).toBe(4);
		expect(filledCount(4.6)).toBe(5);
	});
});

describe("resolveStarPx", () => {
	it("maps token sizes", () => {
		expect(resolveStarPx("md")).toBe(STAR_SIZE_PX.md);
	});

	it("uses a numeric size directly (owner-app feature)", () => {
		expect(resolveStarPx(20)).toBe(20);
	});

	it("lets sizePx override token and numeric size", () => {
		expect(resolveStarPx("md", 9)).toBe(9);
	});

	it("defaults to sm", () => {
		expect(resolveStarPx(undefined)).toBe(STAR_SIZE_PX.sm);
	});
});

describe("starSizeKey", () => {
	it("passes a token size through", () => {
		expect(starSizeKey("lg")).toBe("lg");
	});

	it("collapses a numeric size to sm", () => {
		expect(starSizeKey(20)).toBe("sm");
	});
});
