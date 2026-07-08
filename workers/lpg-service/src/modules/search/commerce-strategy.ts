import {
	and,
	eq,
	getDB,
	inArray,
	isNotNull,
	isNull,
	sql,
} from "@repo/core/src/database/client";
import {
	branchesSchema,
	businessesSchema,
	businessPhotosSchema,
	productsSchema,
	reviewsSchema,
} from "@repo/core/src/database/schema";
import type { BrandPalette } from "@repo/core/src/database/schema/businesses.schema";
import type { SearchResponse, SearchResultRow } from "./result";

export interface CommerceSearchParams {
	q?: string;
	city?: string;
	area?: string;
	lat?: number;
	lng?: number;
	minRating?: number;
	sortBy?: "recommended" | "rating" | "price";
	limit?: number;
}

interface CommerceRow {
	id: string;
	name: string;
	category: string;
	city: string;
	status: string;
	description: string | null;
	createdAt: string;
	updatedAt: string | null;
	minPrice: number | null;
	avgRating: number | null;
	coverPhotoUrl: string | null;
	area: string | null;
	lat: number | null;
	lng: number | null;
	brandPalette: BrandPalette | null;
}

// Great-circle distance in km between two WGS84 points (computed in app code
// because D1/SQLite has no reliable math functions).
const EARTH_RADIUS_KM = 6371; // mean Earth radius (WGS84 approximation)

function haversineKm(
	aLat: number,
	aLng: number,
	bLat: number,
	bLng: number,
): number {
	const dLat = ((bLat - aLat) * Math.PI) / 180;
	const dLng = ((bLng - aLng) * Math.PI) / 180;
	const s =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((aLat * Math.PI) / 180) *
			Math.cos((bLat * Math.PI) / 180) *
			Math.sin(dLng / 2) ** 2;
	return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(s));
}

// `db` is passed for tests; defaults to the request-scoped client in production.
export async function commerceSearch(
	db: ReturnType<typeof getDB> = getDB(),
	params: CommerceSearchParams = {},
): Promise<SearchResponse> {
	const {
		q,
		city,
		area,
		lat,
		lng,
		minRating,
		sortBy = "recommended",
		limit = 20,
	} = params;

	const escapeLike = (s: string) => s.replace(/[%_\\]/g, "\\$&");

	const conditions = [
		eq(businessesSchema.status, "Active"),
		isNull(businessesSchema.deletedAt),
		eq(businessesSchema.vertical, "commerce"),
	];
	if (city)
		conditions.push(
			sql`${businessesSchema.city} LIKE ${`%${escapeLike(city)}%`} ESCAPE '\\'`,
		);
	if (q)
		conditions.push(
			sql`${businessesSchema.name} LIKE ${`%${escapeLike(q)}%`} ESCAPE '\\'`,
		);
	// Area mode: restrict to sellers having a (non-deleted) branch in this area.
	if (area)
		conditions.push(
			sql`EXISTS (SELECT 1 FROM ${branchesSchema} WHERE ${branchesSchema.businessId} = ${businessesSchema.id} AND ${branchesSchema.deletedAt} IS NULL AND ${branchesSchema.area} = ${area})`,
		);

	const rows: CommerceRow[] = await db
		.select({
			id: businessesSchema.id,
			name: businessesSchema.name,
			category: businessesSchema.category,
			city: businessesSchema.city,
			status: businessesSchema.status,
			description: businessesSchema.description,
			createdAt: businessesSchema.createdAt,
			updatedAt: businessesSchema.updatedAt,
			minPrice: sql<number | null>`min(${productsSchema.price})`,
			avgRating: sql<number | null>`avg(${reviewsSchema.rating})`,
			coverPhotoUrl: sql<
				string | null
			>`(SELECT ${businessPhotosSchema.url} FROM ${businessPhotosSchema} WHERE ${businessPhotosSchema.businessId} = ${businessesSchema.id} ORDER BY ${businessPhotosSchema.displayOrder} ASC LIMIT 1)`,
			area: sql<
				string | null
			>`(SELECT ${branchesSchema.area} FROM ${branchesSchema} WHERE ${branchesSchema.businessId} = ${businessesSchema.id} AND ${branchesSchema.deletedAt} IS NULL ${area ? sql`AND ${branchesSchema.area} = ${area}` : sql``} LIMIT 1)`,
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
			productsSchema,
			and(
				eq(productsSchema.branchId, branchesSchema.id),
				eq(productsSchema.status, "Active"),
				isNull(productsSchema.deletedAt),
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
		.where(and(...conditions))
		.groupBy(businessesSchema.id)
		.limit(limit * 5);

	const candidates = rows.filter((v) => {
		if (
			minRating !== undefined &&
			(v.avgRating === null || v.avgRating < minRating)
		)
			return false;
		return true;
	});

	// Distance mode: rank by proximity when device coords are provided.
	const hasCoords = lat !== undefined && lng !== undefined;
	const nearestByBusiness = new Map<
		string,
		{ area: string | null; lat: number; lng: number; distanceKm: number }
	>();
	if (hasCoords && candidates.length > 0) {
		const branchRows = await db
			.select({
				businessId: branchesSchema.businessId,
				area: branchesSchema.area,
				lat: branchesSchema.lat,
				lng: branchesSchema.lng,
			})
			.from(branchesSchema)
			.where(
				and(
					inArray(
						branchesSchema.businessId,
						candidates.map((c) => c.id),
					),
					isNull(branchesSchema.deletedAt),
					isNotNull(branchesSchema.lat),
					isNotNull(branchesSchema.lng),
					area ? eq(branchesSchema.area, area) : undefined,
				),
			);
		for (const b of branchRows) {
			if (b.lat === null || b.lng === null) continue;
			const distanceKm = haversineKm(
				lat as number,
				lng as number,
				b.lat,
				b.lng,
			);
			const current = nearestByBusiness.get(b.businessId);
			if (!current || distanceKm < current.distanceKm) {
				nearestByBusiness.set(b.businessId, {
					area: b.area,
					lat: b.lat,
					lng: b.lng,
					distanceKm,
				});
			}
		}
	}

	const withDistance = candidates.map((v) => {
		if (!hasCoords) return { ...v, distanceKm: null };
		const nearest = nearestByBusiness.get(v.id);
		if (!nearest) return { ...v, distanceKm: null };
		return {
			...v,
			area: nearest.area,
			lat: nearest.lat,
			lng: nearest.lng,
			distanceKm: nearest.distanceKm,
		};
	});

	if (lat !== undefined && lng !== undefined) {
		withDistance.sort(
			(a, b) =>
				(a.distanceKm ?? Number.POSITIVE_INFINITY) -
				(b.distanceKm ?? Number.POSITIVE_INFINITY),
		);
	} else if (sortBy === "rating") {
		withDistance.sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0));
	} else if (sortBy === "price") {
		withDistance.sort(
			(a, b) =>
				(a.minPrice ?? Number.POSITIVE_INFINITY) -
				(b.minPrice ?? Number.POSITIVE_INFINITY),
		);
	}

	const data: SearchResultRow[] = withDistance.slice(0, limit).map((v) => ({
		id: v.id,
		name: v.name,
		category: v.category,
		city: v.city,
		vertical: "commerce",
		status: v.status,
		description: v.description,
		createdAt: v.createdAt,
		updatedAt: v.updatedAt,
		minPrice: v.minPrice,
		avgRating: v.avgRating,
		coverPhotoUrl: v.coverPhotoUrl,
		lat: v.lat,
		lng: v.lng,
		area: v.area,
		distanceKm: v.distanceKm,
		brandPalette: v.brandPalette,
	}));

	return { data, aiRanked: false };
}
