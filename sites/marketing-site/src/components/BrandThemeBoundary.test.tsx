import type { BrandPalette } from "@repo/api-client";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandThemeBoundary } from "./BrandThemeBoundary";

const PALETTE: BrandPalette = {
	primary: "#5B2A86",
	accent: "#C9A063",
	foreground: "#1A1320",
	surface: "#FDFBFF",
};

describe("BrandThemeBoundary", () => {
	it("overrides the themeable custom properties on the wrapping subtree", () => {
		render(
			<BrandThemeBoundary palette={PALETTE}>
				<span>child</span>
			</BrandThemeBoundary>,
		);
		const wrapper = screen.getByText("child").parentElement as HTMLElement;
		expect(wrapper.style.getPropertyValue("--color-primary")).toBe("#5B2A86");
		expect(wrapper.style.getPropertyValue("--color-accent")).toBe("#C9A063");
		expect(wrapper.style.getPropertyValue("--color-surface")).toBe("#FDFBFF");
	});

	it("is layout-transparent (display: contents)", () => {
		render(
			<BrandThemeBoundary palette={PALETTE}>
				<span>child</span>
			</BrandThemeBoundary>,
		);
		const wrapper = screen.getByText("child").parentElement as HTMLElement;
		expect(wrapper.style.display).toBe("contents");
	});

	it("never sets foreground or static (ink/line/status) custom properties", () => {
		render(
			<BrandThemeBoundary palette={PALETTE}>
				<span>child</span>
			</BrandThemeBoundary>,
		);
		const wrapper = screen.getByText("child").parentElement as HTMLElement;
		expect(wrapper.style.getPropertyValue("--color-foreground")).toBe("");
		expect(wrapper.style.getPropertyValue("--color-ink-900")).toBe("");
		expect(wrapper.style.getPropertyValue("--color-danger")).toBe("");
	});

	it("renders a stable wrapper with no brand override when palette is null (Talash defaults)", () => {
		// The wrapper is always present (even null) so a null→palette resolve is a
		// style update, not a Fragment→div remount of the subtree.
		render(
			<BrandThemeBoundary palette={null}>
				<span>child</span>
			</BrandThemeBoundary>,
		);
		const wrapper = screen.getByText("child").parentElement as HTMLElement;
		expect(wrapper.style.display).toBe("contents");
		expect(wrapper.style.getPropertyValue("--color-primary")).toBe("");
	});

	it("keeps the same wrapper element type across null → palette (no remount)", () => {
		const { rerender } = render(
			<BrandThemeBoundary palette={null}>
				<span>child</span>
			</BrandThemeBoundary>,
		);
		const before = screen.getByText("child").parentElement;
		rerender(
			<BrandThemeBoundary palette={PALETTE}>
				<span>child</span>
			</BrandThemeBoundary>,
		);
		const after = screen.getByText("child").parentElement;
		expect(after?.tagName).toBe(before?.tagName);
		expect(
			(after as HTMLElement).style.getPropertyValue("--color-primary"),
		).toBe("#5B2A86");
	});
});
