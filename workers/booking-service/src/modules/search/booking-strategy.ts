import { and, eq, getDB, isNull, sql } from "@repo/core/src/database/client";
import {
	branchesSchema,
	businessesSchema,
	businessPhotosSchema,
	reviewsSchema,
	servicesSchema,
} from "@repo/core/src/database/schema";
import type { SearchResponse, SearchResultRow } from "./result";

export interface BookingSearchParams {
	q?: string;
	city?: string;
	category?: string;
	minPrice?: number;
	maxPrice?: number;
	minRating?: number;
	sortBy?: "recommended" | "rating" | "price";
	limit?: number;
}

// Workers AI binding shape (narrow — only what we call).
export interface RerankAI {
	run: (
		model: string,
		opts: { query: string; documents: string[] },
	) => Promise<{ result: number[] }>;
}

export async function bookingSearch(
	params: BookingSearchParams,
	ai: RerankAI | undefined,
): Promise<SearchResponse> {
	const {
		q,
		city,
		category,
		minPrice,
		maxPrice,
		minRating,
		sortBy = "recommended",
		limit = 20,
	} = params;

	const db = getDB();
	const escapeLike = (s: string) => s.replace(/[%_\\]/g, "\\$&");

	const businessConditions = [
		eq(businessesSchema.status, "Active"),
		isNull(businessesSchema.deletedAt),
		eq(businessesSchema.vertical, "booking"),
	];
	if (city)
		businessConditions.push(
			sql`${businessesSchema.city} LIKE ${`%${escapeLike(city)}%`} ESCAPE '\\'`,
		);
	if (category)
		businessConditions.push(eq(businessesSchema.category, category));
	if (q)
		businessConditions.push(
			sql`${businessesSchema.name} LIKE ${`%${escapeLike(q)}%`} ESCAPE '\\'`,
		);

	const rows = await db
		.select({
			id: businessesSchema.id,
			name: businessesSchema.name,
			category: businessesSchema.category,
			city: businessesSchema.city,
			status: businessesSchema.status,
			description: businessesSchema.description,
			createdAt: businessesSchema.createdAt,
			updatedAt: businessesSchema.updatedAt,
			minPrice: sql<number | null>`min(${servicesSchema.price})`,
			avgRating: sql<number | null>`avg(${reviewsSchema.rating})`,
			coverPhotoUrl: sql<
				string | null
			>`(SELECT ${businessPhotosSchema.url} FROM ${businessPhotosSchema} WHERE ${businessPhotosSchema.businessId} = ${businessesSchema.id} ORDER BY ${businessPhotosSchema.displayOrder} ASC LIMIT 1)`,
			lat: sql<
				number | null
			>`(SELECT ${branchesSchema.lat} FROM ${branchesSchema} WHERE ${branchesSchema.businessId} = ${businessesSchema.id} AND ${branchesSchema.deletedAt} IS NULL AND ${branchesSchema.lat} IS NOT NULL LIMIT 1)`,
			lng: sql<
				number | null
			>`(SELECT ${branchesSchema.lng} FROM ${branchesSchema} WHERE ${branchesSchema.businessId} = ${businessesSchema.id} AND ${branchesSchema.deletedAt} IS NULL AND ${branchesSchema.lng} IS NOT NULL LIMIT 1)`,
			brandPalette: businessesSchema.brandPalette,
		})
		.from(businessesSchema)
		.leftJoin(
			branchesSchema,
			and(
				eq(branchesSchema.businessId, businessesSchema.id),
				isNull(branchesSchema.deletedAt),
			),
		)
		.leftJoin(
			servicesSchema,
			and(
				eq(servicesSchema.branchId, branchesSchema.id),
				isNull(servicesSchema.deletedAt),
			),
		)
		.leftJoin(
			reviewsSchema,
			and(
				eq(reviewsSchema.businessId, businessesSchema.id),
				eq(reviewsSchema.status, "Published"),
				isNull(reviewsSchema.deletedAt),
			),
		)
		.where(and(...businessConditions))
		.groupBy(businessesSchema.id)
		.limit(limit * 5);

	const candidates = rows.filter((v) => {
		if (
			minPrice !== undefined &&
			(v.minPrice === null || v.minPrice < minPrice)
		)
			return false;
		if (
			maxPrice !== undefined &&
			(v.minPrice === null || v.minPrice > maxPrice)
		)
			return false;
		if (
			minRating !== undefined &&
			(v.avgRating === null || v.avgRating < minRating)
		)
			return false;
		return true;
	});

	if (sortBy === "rating") {
		candidates.sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0));
	} else if (sortBy === "price") {
		candidates.sort((a, b) => (a.minPrice ?? 99999) - (b.minPrice ?? 99999));
	}

	const toRow = (v: (typeof candidates)[number]): SearchResultRow => ({
		...v,
		vertical: "booking",
		area: null,
		distanceKm: null,
	});

	if (!q?.trim() || candidates.length === 0) {
		return { data: candidates.slice(0, limit).map(toRow), aiRanked: false };
	}

	try {
		if (!ai) throw new Error("AI binding not available");
		const ranked = (await ai.run("@cf/baai/bge-reranker-base", {
			query: q,
			documents: candidates.map((v) => `${v.name} ${v.category} ${v.city}`),
		})) as { result: number[] };

		const withScores = candidates.map((v, i) => ({
			business: v,
			score: ranked.result[i] ?? 0,
		}));
		withScores.sort((a, b) => b.score - a.score);
		return {
			data: withScores.slice(0, limit).map((x) => toRow(x.business)),
			aiRanked: true,
		};
	} catch {
		return { data: candidates.slice(0, limit).map(toRow), aiRanked: false };
	}
}
