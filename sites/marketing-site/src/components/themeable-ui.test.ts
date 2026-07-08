import { badgeVariants, buttonVariants } from "@repo/ui";
import { describe, expect, it } from "vitest";

// Venue reskin (#97 web follow-up): the shared @repo/ui Button/Badge must paint
// their brand surfaces with the THEMEABLE role tokens (primary / primary-soft /
// primary-muted / primary-strong / primary-deep / on-primary) — the same custom
// properties `BrandThemeBoundary` overrides per tenant — and NOT the static
// numbered ramp (`primary-600`, `primary-50`…), which venue theming never
// touches and which would leave the buttons inert. Mirrors ui-native #97.

/** Matches a numbered primary-ramp class, e.g. bg-primary-600 / text-primary-50. */
const NUMBERED_PRIMARY = /\b(?:bg|text|border|ring)-primary-\d/;
/** Matches a bare `primary` role utility (not a -soft/-muted/-strong/-deep/-NN). */
const hasRole = (cls: string, role: RegExp) => role.test(cls);

describe("themeable @repo/ui Button (venue reskin)", () => {
	const themeable = ["primary", "ghost", "subtle", "light", "dark"] as const;

	it.each(
		themeable,
	)("variant %s uses no static numbered primary ramp", (variant) => {
		expect(buttonVariants({ variant })).not.toMatch(NUMBERED_PRIMARY);
	});

	it("primary fills with the themeable primary role + on-primary text", () => {
		const cls = buttonVariants({ variant: "primary" });
		expect(hasRole(cls, /(?:^|\s)bg-primary(?:\s|$)/)).toBe(true);
		expect(cls).toContain("hover:bg-primary-strong");
		expect(cls).toContain("text-on-primary");
	});

	it("subtle uses soft fill / muted hover / strong text", () => {
		const cls = buttonVariants({ variant: "subtle" });
		expect(cls).toContain("bg-primary-soft");
		expect(cls).toContain("hover:bg-primary-muted");
		expect(cls).toContain("text-primary-strong");
	});

	it("ghost hover tints with the themeable soft role", () => {
		expect(buttonVariants({ variant: "ghost" })).toContain(
			"hover:bg-primary-soft",
		);
	});

	it("dark fills with the deep role and keeps its hover on-brand", () => {
		const cls = buttonVariants({ variant: "dark" });
		expect(cls).toContain("bg-primary-deep");
		expect(cls).not.toContain("bg-black");
	});

	it("light text uses the deep role", () => {
		expect(buttonVariants({ variant: "light" })).toContain("text-primary-deep");
	});
});

describe("themeable @repo/ui Badge (venue reskin)", () => {
	it("primary badge uses soft fill + strong text, no numbered ramp", () => {
		const cls = badgeVariants({ variant: "primary" });
		expect(cls).toContain("bg-primary-soft");
		expect(cls).toContain("text-primary-strong");
		expect(cls).not.toMatch(NUMBERED_PRIMARY);
	});
});
