import { z } from "@hono/zod-openapi";

const HexColor = z
	.string()
	.regex(/^#[0-9a-fA-F]{6}$/, "Must be a 6-digit hex color, e.g. #1A2B3C");

export const BrandPaletteSchema = z
	.object({
		primary: HexColor,
		accent: HexColor,
		foreground: HexColor,
		surface: HexColor,
	})
	.openapi("BrandPalette");

/**
 * Unified search result row. Commerce rows set vertical="commerce" with area/distanceKm
 * when location filters are used.
 */
export const SearchResultSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		category: z.string(),
		city: z.string(),
		vertical: z.enum(["booking", "commerce"]),
		status: z.string(),
		description: z.string().nullable(),
		createdAt: z.string(),
		updatedAt: z.string().nullable(),
		minPrice: z.number().nullable(),
		avgRating: z.number().nullable(),
		coverPhotoUrl: z.string().nullable(),
		lat: z.number().nullable(),
		lng: z.number().nullable(),
		area: z.string().nullable(),
		distanceKm: z.number().nullable(),
		brandPalette: BrandPaletteSchema.nullable(),
	})
	.openapi("BusinessSearchResult");

export type SearchResultRow = z.infer<typeof SearchResultSchema>;

export interface SearchResponse {
	data: SearchResultRow[];
	aiRanked: boolean;
}
