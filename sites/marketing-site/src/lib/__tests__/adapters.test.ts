import type { EnrichedSearchResult } from "@repo/api-client";
import { describe, expect, it } from "vitest";
import { adaptBusiness } from "../adapters";

function enriched(over: Partial<EnrichedSearchResult>): EnrichedSearchResult {
	return {
		id: "v1",
		name: "Glow Studio",
		category: "Spa & massage",
		city: "Dhaka",
		status: "Active",
		description: null,
		ownerId: "o1",
		createdAt: "2026-01-01T00:00:00Z",
		updatedAt: null,
		vertical: "booking",
		minPrice: 500,
		avgRating: 4.5,
		coverPhotoUrl: "https://storage.test/v1/cover.jpg",
		lat: null,
		lng: null,
		area: null,
		distanceKm: null,
		brandPalette: null,
		...over,
	};
}

describe("adaptBusiness", () => {
	it("maps an enriched search result to the card view-model", () => {
		const b = adaptBusiness(enriched({}));
		expect(b).toMatchObject({
			id: "v1",
			name: "Glow Studio",
			cat: "Spa & massage",
			city: "Dhaka",
			rating: 4.5,
			from: 500,
			coverPhotoUrl: "https://storage.test/v1/cover.jpg",
		});
		expect(typeof b.tone).toBe("string");
		expect(b.tone.length).toBeGreaterThan(0);
	});

	it("falls back to 0 when avgRating and minPrice are null", () => {
		const b = adaptBusiness(enriched({ avgRating: null, minPrice: null }));
		expect(b.rating).toBe(0);
		expect(b.from).toBe(0);
	});

	it("defaults the review count to 0 (search payload carries no count)", () => {
		const b = adaptBusiness(enriched({}));
		expect(b.reviews).toBe(0);
	});
});
