import { describe, expect, it } from "vitest";
import {
	AVATAR_FONT_SIZE,
	AVATAR_SIZE_PX,
	avatarSizeKey,
	initialsOf,
	resolveAvatarFontSize,
	resolveAvatarPx,
} from "./Avatar.styles";

describe("initialsOf", () => {
	it("takes the first letter of up to two words, uppercased", () => {
		expect(initialsOf("John Doe")).toBe("JD");
	});

	it("uses a single initial for a one-word name", () => {
		expect(initialsOf("madonna")).toBe("M");
	});

	it("caps at two initials", () => {
		expect(initialsOf("a b c")).toBe("AB");
	});

	it("falls back to ? for an empty name", () => {
		expect(initialsOf("")).toBe("?");
	});
});

describe("resolveAvatarPx", () => {
	it("maps token sizes", () => {
		expect(resolveAvatarPx("md")).toBe(AVATAR_SIZE_PX.md);
		expect(resolveAvatarPx("2xl")).toBe(AVATAR_SIZE_PX["2xl"]);
	});

	it("uses a numeric size directly (owner-app feature)", () => {
		expect(resolveAvatarPx(60)).toBe(60);
	});

	it("defaults to md", () => {
		expect(resolveAvatarPx(undefined)).toBe(AVATAR_SIZE_PX.md);
	});
});

describe("resolveAvatarFontSize", () => {
	it("maps token sizes to the font scale", () => {
		expect(resolveAvatarFontSize("lg")).toBe(AVATAR_FONT_SIZE.lg);
	});

	it("derives ~38% of a numeric size", () => {
		expect(resolveAvatarFontSize(50)).toBe(Math.round(50 * 0.38));
	});
});

describe("avatarSizeKey", () => {
	it("passes a token size through", () => {
		expect(avatarSizeKey("xl")).toBe("xl");
	});

	it("collapses a numeric size to md", () => {
		expect(avatarSizeKey(50)).toBe("md");
	});
});

describe("AVATAR_FONT_SIZE", () => {
	it("keeps the shared scale (md = 16)", () => {
		expect(AVATAR_FONT_SIZE.md).toBe(16);
	});
});
