import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Stars } from "../components/Stars";

describe("Stars", () => {
	it("renders 5 star icons", () => {
		const { container } = render(<Stars value={3} />);
		const icons = container.querySelectorAll("svg");
		expect(icons).toHaveLength(5);
	});

	it("defaults to all 5 stars filled when value is 5", () => {
		const { container } = render(<Stars value={5} />);
		const icons = Array.from(container.querySelectorAll("svg"));
		for (const icon of icons) {
			expect(icon.style.fill).not.toBe("transparent");
		}
	});

	it("fills only the first 3 stars when value is 3", () => {
		const { container } = render(<Stars value={3} />);
		const icons = Array.from(container.querySelectorAll("svg"));
		for (let i = 0; i < 3; i++) {
			expect(icons[i].style.fill).not.toBe("transparent");
		}
		for (let i = 3; i < 5; i++) {
			expect(icons[i].style.fill).toBe("transparent");
		}
	});
});
