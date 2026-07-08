import { describe, expect, it } from "vitest";
import { isBusinessStatusToggleable, nextBusinessStatus } from "../data";

describe("nextBusinessStatus", () => {
	it("toggles Active to Draft", () => {
		expect(nextBusinessStatus("Active")).toBe("Draft");
	});

	it("toggles Draft to Active", () => {
		expect(nextBusinessStatus("Draft")).toBe("Active");
	});

	it("returns null for Suspended — the owner cannot lift a Talash suspension", () => {
		expect(nextBusinessStatus("Suspended")).toBeNull();
	});

	it("never lets a Suspended business become Active", () => {
		// Regression: a binary toggle previously flipped Suspended → Active.
		expect(nextBusinessStatus("Suspended")).not.toBe("Active");
	});
});

describe("isBusinessStatusToggleable", () => {
	it("is true for Active and Draft", () => {
		expect(isBusinessStatusToggleable("Active")).toBe(true);
		expect(isBusinessStatusToggleable("Draft")).toBe(true);
	});

	it("is false for Suspended", () => {
		expect(isBusinessStatusToggleable("Suspended")).toBe(false);
	});
});
