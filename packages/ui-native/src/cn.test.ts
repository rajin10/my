import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
	it("joins truthy class names", () => {
		expect(cn("px-4", "py-2")).toBe("px-4 py-2");
	});

	it("drops falsy conditional classes", () => {
		expect(cn("px-4", false && "hidden", undefined, null)).toBe("px-4");
	});

	it("resolves conflicting tailwind utilities (last wins)", () => {
		expect(cn("bg-primary-600", "bg-surface")).toBe("bg-surface");
	});
});
