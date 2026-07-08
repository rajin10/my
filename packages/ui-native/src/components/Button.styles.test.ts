import { Colors } from "@repo/tokens";
import { describe, expect, it } from "vitest";
import {
	BUTTON_ICON_COLOR,
	BUTTON_ICON_SIZE,
	BUTTON_TEXT_CLASS,
	buttonActiveOpacity,
	buttonVariants,
	isButtonInteractive,
} from "./Button.styles";

describe("buttonVariants — danger split (#63 HITL decision)", () => {
	it("`danger` is the filled, high-emphasis treatment", () => {
		expect(buttonVariants({ variant: "danger" })).toContain("bg-danger-bg");
	});

	it("`dangerOutline` is the low-emphasis outline treatment", () => {
		const cls = buttonVariants({ variant: "dangerOutline" });
		expect(cls).toContain("bg-surface");
		expect(cls).toContain("border");
	});
});

describe("buttonVariants — variant rename `secondary` → `subtle`", () => {
	it("exposes `subtle` with the themeable tinted treatment (#97)", () => {
		const cls = buttonVariants({ variant: "subtle" });
		expect(cls).toContain("bg-primary-soft");
		expect(cls).toContain("border-primary-muted");
	});
});

describe("buttonVariants — themeable brand fills (#97)", () => {
	it("paints `primary` with the flat themeable role (repaints per tenant)", () => {
		const cls = buttonVariants({ variant: "primary" });
		expect(cls).toContain("bg-primary");
		// not the raw ramp step it carried before #97
		expect(cls).not.toContain("bg-primary-6");
	});

	it("paints `dark` with the deep themeable role", () => {
		expect(buttonVariants({ variant: "dark" })).toContain("bg-primary-deep");
	});
});

describe("BUTTON_TEXT_CLASS — repaintable text colours (#97)", () => {
	it("uses the themeable text roles for brand variants", () => {
		expect(BUTTON_TEXT_CLASS.primary).toBe("text-on-primary");
		expect(BUTTON_TEXT_CLASS.dark).toBe("text-on-primary");
		expect(BUTTON_TEXT_CLASS.subtle).toBe("text-primary-strong");
	});

	it("keeps static roles for non-brand variants", () => {
		expect(BUTTON_TEXT_CLASS.danger).toBe("text-danger-fg");
		expect(BUTTON_TEXT_CLASS.dangerOutline).toBe("text-danger-fg");
	});
});

describe("BUTTON_ICON_COLOR — static icon/spinner hex (#97)", () => {
	it("decouples the subtle icon to neutral ink (icon can't read the themed var on RN)", () => {
		expect(BUTTON_ICON_COLOR.subtle).toBe(Colors.ink600);
	});

	it("keeps white on the filled brand variants and danger fg on danger", () => {
		expect(BUTTON_ICON_COLOR.primary).toBe("#fff");
		expect(BUTTON_ICON_COLOR.dark).toBe("#fff");
		expect(BUTTON_ICON_COLOR.danger).toBe(Colors.dangerFg);
	});
});

describe("BUTTON_ICON_SIZE — owner's per-size map", () => {
	it("has a distinct icon size per button size", () => {
		expect(BUTTON_ICON_SIZE).toEqual({ sm: 16, md: 18, lg: 20 });
	});
});

describe("isButtonInteractive — loading state (#63)", () => {
	it("is interactive by default", () => {
		expect(isButtonInteractive({})).toBe(true);
	});

	it("is non-interactive when disabled", () => {
		expect(isButtonInteractive({ disabled: true })).toBe(false);
	});

	it("is non-interactive while loading even if not disabled", () => {
		expect(isButtonInteractive({ loading: true })).toBe(false);
	});
});

describe("buttonActiveOpacity — press feedback (#97)", () => {
	it("dims the themed-fill variants on press (replaces the static hex overlay)", () => {
		expect(buttonActiveOpacity("primary")).toBeLessThan(1);
		expect(buttonActiveOpacity("dark")).toBeLessThan(1);
	});

	it("leaves other variants un-dimmed (unchanged press behaviour)", () => {
		expect(buttonActiveOpacity("ghost")).toBe(1);
		expect(buttonActiveOpacity("subtle")).toBe(1);
		expect(buttonActiveOpacity("danger")).toBe(1);
	});
});
