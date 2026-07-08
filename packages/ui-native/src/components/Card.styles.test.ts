import { describe, expect, it } from "vitest";
import { CARD_PAD_PX, resolveCardPadding } from "./Card.styles";

describe("resolveCardPadding", () => {
	it("maps named paddings", () => {
		expect(resolveCardPadding("md")).toBe(CARD_PAD_PX.md);
		expect(resolveCardPadding("none")).toBe(0);
	});

	it("uses a raw pixel value directly", () => {
		expect(resolveCardPadding(24)).toBe(24);
	});

	it("defaults to md when undefined", () => {
		expect(resolveCardPadding(undefined)).toBe(CARD_PAD_PX.md);
	});
});
