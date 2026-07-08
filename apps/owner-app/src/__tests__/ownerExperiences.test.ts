import { describe, expect, it, vi } from "vitest";

// Stub the screen modules so this stays a pure registry test — it asserts the
// vertical → experience mapping, not the screens' native render path. The stubs
// are created via vi.hoisted so the hoisted vi.mock factories can reference them.
const { ServicesScreenStub, ProductsScreenStub } = vi.hoisted(() => ({
	ServicesScreenStub: () => null,
	ProductsScreenStub: () => null,
}));
vi.mock("../components/screens/ServicesScreen", () => ({
	default: ServicesScreenStub,
}));
vi.mock("../components/screens/ProductsScreen", () => ({
	default: ProductsScreenStub,
}));

import { ownerCatalogExperience } from "../lib/ownerExperiences";

describe("ownerCatalogExperience registry (ADR-0004)", () => {
	it("maps booking → Services tab + ServicesScreen", () => {
		const exp = ownerCatalogExperience.booking;
		expect(exp.tab.label).toBe("Services");
		expect(exp.tab.icon).toBe("Sparkles");
		expect(exp.Screen).toBe(ServicesScreenStub);
	});

	it("maps commerce → Products tab + ProductsScreen", () => {
		const exp = ownerCatalogExperience.commerce;
		expect(exp.tab.label).toBe("Products");
		expect(exp.tab.icon).toBe("Package");
		expect(exp.Screen).toBe(ProductsScreenStub);
	});

	it("registers exactly the two known verticals", () => {
		expect(Object.keys(ownerCatalogExperience).sort()).toEqual([
			"booking",
			"commerce",
		]);
	});
});
