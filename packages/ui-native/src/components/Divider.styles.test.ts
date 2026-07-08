import { describe, expect, it } from "vitest";
import { dividerVariants } from "./Divider.styles";

describe("dividerVariants", () => {
	it("defaults to a horizontal rule with no opacity tweak", () => {
		expect(dividerVariants()).toBe("h-px w-full bg-line");
	});

	it("renders a vertical rule", () => {
		expect(dividerVariants({ direction: "vertical" })).toBe(
			"w-px self-stretch bg-line",
		);
	});

	it("applies strength opacity", () => {
		expect(dividerVariants({ strength: "soft" })).toBe(
			"h-px w-full bg-line opacity-60",
		);
		expect(dividerVariants({ strength: "strong" })).toBe(
			"h-px w-full bg-line opacity-100",
		);
	});
});
