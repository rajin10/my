import { Colors } from "@repo/tokens";
import { describe, expect, it } from "vitest";
import {
	BADGE_ICON_COLOR,
	BADGE_ICONS,
	BADGE_TEXT_CLASS,
	badgeVariants,
	STATUS_VARIANT,
	statusLabel,
} from "./Badge.styles";

describe("badgeVariants — `neutral` renamed to `default`", () => {
	it("exposes `default` with the neutral treatment", () => {
		expect(badgeVariants({ variant: "default" })).toContain("bg-line-soft");
	});
});

describe("badgeVariants — themeable brand badge (#97)", () => {
	it("paints `brand` with the themeable soft tint (repaints per tenant)", () => {
		const cls = badgeVariants({ variant: "brand" });
		expect(cls).toContain("bg-primary-soft");
		expect(cls).not.toContain("bg-primary-50");
	});
});

describe("BADGE_TEXT_CLASS — repaintable text colours (#97)", () => {
	it("uses the themeable strong role for the brand badge", () => {
		expect(BADGE_TEXT_CLASS.brand).toBe("text-primary-strong");
	});

	it("keeps static status/neutral roles for the others", () => {
		expect(BADGE_TEXT_CLASS.default).toBe("text-ink-500");
		expect(BADGE_TEXT_CLASS.info).toBe("text-info-fg");
	});
});

describe("BADGE_ICON_COLOR — static icon hex", () => {
	it("keeps status icons on their semantic colour", () => {
		expect(BADGE_ICON_COLOR.info).toBe(Colors.infoFg);
		expect(BADGE_ICON_COLOR.default).toBe(Colors.ink500);
	});
});

describe("BADGE_ICONS — absorbs mobile-app's info icon", () => {
	it("includes the info icon", () => {
		expect(BADGE_ICONS.info).toBe("Info");
	});

	it("keeps the success/danger/pending icons", () => {
		expect(BADGE_ICONS.success).toBe("CheckCircle");
		expect(BADGE_ICONS.danger).toBe("XCircle");
		expect(BADGE_ICONS.pending).toBe("Clock");
	});
});

describe("STATUS_VARIANT — superset incl. commerce statuses", () => {
	it("maps OutForDelivery to info", () => {
		expect(STATUS_VARIANT.OutForDelivery).toBe("info");
	});

	it("maps Sent and Delivered to success", () => {
		expect(STATUS_VARIANT.Sent).toBe("success");
		expect(STATUS_VARIANT.Delivered).toBe("success");
	});

	it("maps Draft to the renamed default variant", () => {
		expect(STATUS_VARIANT.Draft).toBe("default");
	});

	it("keeps booking statuses (Cancelled → danger)", () => {
		expect(STATUS_VARIANT.Cancelled).toBe("danger");
	});
});

describe("statusLabel", () => {
	it("humanizes OutForDelivery", () => {
		expect(statusLabel("OutForDelivery")).toBe("Out for delivery");
	});

	it("returns the status verbatim otherwise", () => {
		expect(statusLabel("Pending")).toBe("Pending");
	});
});
