import type { Business as ApiBusiness, BrandPalette } from "@repo/api-client";
import { describe, expect, it } from "vitest";
import { adaptBusinessDetail } from "../lib/adapters";

const PALETTE: BrandPalette = {
	primary: "#5B2A86",
	accent: "#C9A063",
	foreground: "#1A1320",
	surface: "#FDFBFF",
};

function apiBusiness(brandPalette: BrandPalette | null): ApiBusiness {
	return {
		id: "biz_1",
		name: "Glow Spa",
		category: "Spa",
		city: "Dhaka",
		vertical: "booking",
		status: "Active",
		description: null,
		phone: null,
		email: null,
		website: null,
		brandPalette,
		ownerId: "usr_1",
		createdAt: "2026-01-01T00:00:00Z",
		updatedAt: null,
	};
}

describe("adaptBusinessDetail — brand palette", () => {
	it("carries the venue brand palette onto the UI model (drives the reskin)", () => {
		const ui = adaptBusinessDetail(apiBusiness(PALETTE), [], []);
		expect(ui.brandPalette).toEqual(PALETTE);
	});

	it("is null when the venue has no palette (Talash-default fallback)", () => {
		const ui = adaptBusinessDetail(apiBusiness(null), [], []);
		expect(ui.brandPalette).toBeNull();
	});
});
