# Commerce Discovery (#75) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make discovery vertical-aware so a customer can find LPG (commerce) sellers by area or proximity, list them, and jump back into a past seller's catalog — while booking discovery stays byte-for-byte unchanged.

**Architecture:** Refactor the single `GET /api/v1/search` handler into a *shell* that reads a `vertical` param (default `booking`) and dispatches to per-vertical query strategies. The booking query is lifted verbatim; a new commerce strategy filters `businesses.vertical='commerce'`, matches by `branches.area` or ranks by Haversine distance over `branches.lat/lng` (computed in app code, not SQL). The mobile Search tab gains a `Salons | Gas sellers` segment; the commerce mode adds GPS-or-area location selection, a seller list, and an "Order again" row.

**Tech Stack:** Hono + `@hono/zod-openapi` on Cloudflare Workers, Drizzle ORM over D1, Vitest (mocked-DB route tests + real in-memory-SQLite integration tests via `createTestDb`), `@repo/api-client`, Expo 56 / expo-router mobile app, React Query, `expo-location`.

---

## Spec reference

Design: [docs/superpowers/specs/2026-06-10-commerce-discovery-design.md](../specs/2026-06-10-commerce-discovery-design.md)

## File structure

**Phase 1 — Backend + seed + api-client**

- `tools/cli/factories/branch.factory.ts` — *modify*: add per-area BD `lat`/`lng` to seeded branches.
- `workers/api/src/modules/search/booking-strategy.ts` — *create*: `bookingSearch(db, params, ai)` — the current query lifted verbatim, returns `{ data, aiRanked }`.
- `workers/api/src/modules/search/commerce-strategy.ts` — *create*: `commerceSearch(db, params)` — area / distance commerce query.
- `workers/api/src/modules/search/result.ts` — *create*: shared `SearchResultSchema` (adds `vertical`, `area`, `distanceKm`) + the `CommerceSearchParams` / `SearchResultRow` types.
- `workers/api/src/modules/search/index.ts` — *modify*: becomes the shell (parse `vertical`, dispatch).
- `workers/api/src/__tests__/modules/search/search.routes.test.ts` — *modify*: keep existing 3 tests; add default→booking + `vertical=commerce` dispatch + validation tests.
- `workers/api/src/__tests__/modules/search/commerce-strategy.integration.test.ts` — *create*: real-DB area + distance tests.
- `packages/api-client/src/endpoints/search.ts` — *modify*: params + `EnrichedSearchResult` fields.

**Phase 2 — Mobile app**

- `apps/mobile-app/package.json` — *modify*: add `expo-location` (via `expo install`).
- `apps/mobile-app/src/hooks/useDeviceLocation.ts` — *create*: permission + `getCurrentPositionAsync` hook.
- `apps/mobile-app/src/hooks/useBusinessSearch.ts` — *modify*: vertical/area/lat/lng params; use real per-result `vertical`, `area`, `distanceKm`.
- `apps/mobile-app/src/data.ts` — *modify*: add `area?`/`distanceKm?` to `Business`, `businessId` to `Order`.
- `apps/mobile-app/src/lib/adapters.ts` — *modify*: carry `businessId` through `adaptOrder`.
- `apps/mobile-app/src/hooks/useRecentSellers.ts` — *create*: distinct past sellers from `useMyOrders` resolved to `{id,name}`.
- `apps/mobile-app/src/components/screens/SearchScreen.tsx` — *modify*: vertical segment + commerce location bar + area picker + seller list + "Order again" row.

## Conventions (read before starting)

- Run scoped commands from repo root: `bun run --filter @repo/api test`, `bun run --filter @repo/api-client test`, `bun run --filter @repo/mobile-app test`, `bun run --filter @repo/cli test`. Lint touched files with `bun run lint`.
- Prices are integers in **paisa** (`products.price`, `services.price`). "from ৳X" uses the raw integer; the mobile `formatMoney` helper handles display.
- `branches.lat`/`lng` are nullable `real()`. Rows missing coordinates must degrade safely (excluded from distance ranking, still returned in area mode).
- Real-DB tests follow the khata pattern: `createTestDb()` + Drizzle inserts cast `as never` (better-sqlite3 vs D1 drizzle type mismatch). FKs are OFF in the harness, so you can insert a business/branch/product without a full chain.

---

## Phase 1 — Backend, seed, api-client

### Task 1: Seed branch coordinates

Distance ranking needs real `lat`/`lng` on seeded branches. The factory currently sets `area`/`city` but leaves `lat`/`lng` null.

**Files:**
- Modify: `tools/cli/factories/branch.factory.ts`
- Test: `tools/cli/__tests__/factories.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tools/cli/__tests__/factories.test.ts`:

```ts
import { createBranch } from "../factories/branch.factory.ts";

describe("createBranch coordinates", () => {
	it("assigns lat/lng inside Bangladesh's bounding box", () => {
		const b = createBranch("biz-1", "Dhaka");
		expect(b.lat).not.toBeNull();
		expect(b.lng).not.toBeNull();
		// Bangladesh bounding box (approx): lat 20.5–26.7, lng 88.0–92.7
		expect(b.lat as number).toBeGreaterThan(20.5);
		expect(b.lat as number).toBeLessThan(26.7);
		expect(b.lng as number).toBeGreaterThan(88.0);
		expect(b.lng as number).toBeLessThan(92.7);
	});

	it("is deterministic under a fixed faker seed", () => {
		faker.seed(42);
		const a = createBranch("biz-1", "Dhaka");
		faker.seed(42);
		const b = createBranch("biz-1", "Dhaka");
		expect([a.lat, a.lng]).toEqual([b.lat, b.lng]);
	});
});
```

(Import `faker` from `@faker-js/faker` at the top if not already imported.)

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter @repo/cli test -- factories`
Expected: FAIL — `b.lat` is `null` (`expected null not to be null`).

- [ ] **Step 3: Implement coordinates in the factory**

In `tools/cli/factories/branch.factory.ts`, add a per-city centre map and jitter. Replace the `return { ... }` block of `createBranch` to include `lat`/`lng`:

```ts
// Approximate city centres (lat, lng) so seeded branches cluster realistically.
const CITY_CENTRES: Record<string, [number, number]> = {
	Dhaka: [23.781, 90.4],
	Chittagong: [22.357, 91.78],
	Sylhet: [24.895, 91.87],
	Rajshahi: [24.374, 88.601],
	Khulna: [22.845, 89.54],
	Cumilla: [23.46, 91.18],
	Mymensingh: [24.747, 90.42],
	Gazipur: [23.999, 90.42],
	Narayanganj: [23.62, 90.5],
	Bogura: [24.848, 89.372],
};
```

Then inside `createBranch`, after `const area = ...`:

```ts
	const [clat, clng] = CITY_CENTRES[city] ?? [23.78, 90.4];
	// ±0.05° jitter (~5 km) so branches in one city spread out for distance ranking.
	const lat = clat + faker.number.float({ min: -0.05, max: 0.05 });
	const lng = clng + faker.number.float({ min: -0.05, max: 0.05 });
```

And add `lat,` and `lng,` to the returned object (next to `area,`).

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --filter @repo/cli test -- factories`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/cli/factories/branch.factory.ts tools/cli/__tests__/factories.test.ts
git commit -m "feat(cli): seed branch lat/lng for commerce distance ranking (#75)"
```

---

### Task 2: Extract the booking strategy (behavior-preserving)

Lift the existing booking query out of the route into a function, with **zero logic change**, so the shell can dispatch to it. The existing 3 route tests must stay green.

**Files:**
- Create: `workers/api/src/modules/search/result.ts`
- Create: `workers/api/src/modules/search/booking-strategy.ts`
- Modify: `workers/api/src/modules/search/index.ts`
- Test: `workers/api/src/__tests__/modules/search/search.routes.test.ts` (existing tests unchanged this task)

- [ ] **Step 1: Create the shared result schema + types**

Create `workers/api/src/modules/search/result.ts`:

```ts
import { z } from "@hono/zod-openapi";

/**
 * Unified search result row. `vertical`/`area`/`distanceKm` are additive over the
 * pre-#75 booking shape: booking rows set vertical="booking", area=null, distanceKm=null.
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
	})
	.openapi("BusinessSearchResult");

export type SearchResultRow = z.infer<typeof SearchResultSchema>;

export interface SearchResponse {
	data: SearchResultRow[];
	aiRanked: boolean;
}
```

- [ ] **Step 2: Create the booking strategy by lifting the current query verbatim**

Create `workers/api/src/modules/search/booking-strategy.ts`. Move the body of the current handler (the businesses query, post-aggregate filtering, sort, and AI re-rank) into `bookingSearch`, returning `SearchResponse`. Map each row to include `vertical: "booking", area: null, distanceKm: null`:

```ts
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
interface RerankAI {
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
	if (category) businessConditions.push(eq(businessesSchema.category, category));
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
		if (minPrice !== undefined && (v.minPrice === null || v.minPrice < minPrice))
			return false;
		if (maxPrice !== undefined && (v.minPrice === null || v.minPrice > maxPrice))
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
		// @ts-expect-error - bge-reranker-base is valid but not in the type stubs
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
```

> Note: the only change vs. the original is the additive `eq(businessesSchema.vertical, "booking")` filter (commerce sellers must not appear in booking results) and the `vertical/area/distanceKm` fields on each row. Everything else is verbatim.

- [ ] **Step 3: Rewrite `index.ts` as a thin shell delegating to bookingSearch**

Replace `workers/api/src/modules/search/index.ts` with a shell that keeps the existing route/query params and (for now) only the booking branch:

```ts
import { createRoute, z } from "@hono/zod-openapi";
import { createApp } from "../../core/create-app";
import { bookingSearch } from "./booking-strategy";
import { SearchResultSchema } from "./result";

const searchRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["Search"],
	summary: "Search businesses",
	description:
		"Vertical-aware discovery. Booking: full-text + AI re-rank. Commerce: by area or nearest.",
	request: {
		query: z.object({
			vertical: z.enum(["booking", "commerce"]).default("booking").optional(),
			q: z.string().optional().openapi({ description: "Search query" }),
			city: z.string().optional(),
			area: z.string().optional().openapi({ description: "Commerce: branch area" }),
			category: z.string().optional(),
			lat: z.coerce.number().optional().openapi({ description: "Commerce: device latitude" }),
			lng: z.coerce.number().optional().openapi({ description: "Commerce: device longitude" }),
			minPrice: z.coerce.number().int().nonnegative().optional(),
			maxPrice: z.coerce.number().int().nonnegative().optional(),
			minRating: z.coerce.number().min(0).max(5).optional(),
			sortBy: z.enum(["recommended", "rating", "price"]).default("recommended").optional(),
			limit: z.coerce.number().int().positive().max(50).default(20).optional(),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						data: z.array(SearchResultSchema),
						aiRanked: z.boolean(),
					}),
				},
			},
			description: "Search results",
		},
	},
});

export const searchApp = createApp().openapi(searchRoute, async (c) => {
	const { vertical = "booking", ...params } = c.req.valid("query");
	// Commerce branch is wired in Task 3.
	const result = await bookingSearch(params, c.env.TALASH_AI as never);
	return c.json(result, 200);
});
```

- [ ] **Step 4: Run the existing search tests to verify they stay green**

Run: `bun run --filter @repo/api test -- search`
Expected: PASS — the 3 existing tests pass unchanged (empty results, sortBy+limit, 200).

- [ ] **Step 5: Add a default→booking dispatch test**

Append to `search.routes.test.ts`:

```ts
it("defaults to the booking vertical when no vertical param is given", async () => {
	const res = await app.request("/api/v1/search", {}, TEST_ENV);
	expect(res.status).toBe(200);
	const body = (await res.json()) as { data: unknown[]; aiRanked: boolean };
	expect(Array.isArray(body.data)).toBe(true);
	expect(body.aiRanked).toBe(false);
});
```

Run: `bun run --filter @repo/api test -- search`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add workers/api/src/modules/search/ workers/api/src/__tests__/modules/search/search.routes.test.ts
git commit -m "refactor(api): extract booking search strategy behind a vertical shell (#75)"
```

---

### Task 3: Commerce strategy — area mode

Add the commerce query: filter `vertical='commerce'`, match by `branches.area`, aggregate min product price + avg rating + cover photo + nearest-branch area/lat/lng.

**Files:**
- Create: `workers/api/src/modules/search/commerce-strategy.ts`
- Modify: `workers/api/src/modules/search/index.ts` (wire commerce branch)
- Test: `workers/api/src/__tests__/modules/search/commerce-strategy.integration.test.ts`

- [ ] **Step 1: Write the failing real-DB integration test (area mode)**

Create `workers/api/src/__tests__/modules/search/commerce-strategy.integration.test.ts`:

```ts
/**
 * Real-DB integration test for commerceSearch — exercises the actual area filter
 * and commerce/booking isolation against in-memory SQLite (createTestDb).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { commerceSearch } from "../../../modules/search/commerce-strategy";
import { createTestDb } from "../../helpers/test-db";

const TS = "2026-01-01T00:00:00.000Z";

async function seedBusiness(
	db: ReturnType<typeof createTestDb>,
	o: { id: string; vertical: "booking" | "commerce"; city?: string },
) {
	const { businessesSchema } = await import("@repo/core/src/database/schema");
	// biome-ignore lint/suspicious/noExplicitAny: better-sqlite3 vs D1 drizzle type mismatch
	await (db as any).insert(businessesSchema).values({
		id: o.id,
		name: `${o.vertical}-${o.id}`,
		category: "LPG",
		city: o.city ?? "Dhaka",
		vertical: o.vertical,
		status: "Active",
		ownerId: "owner-1",
		createdAt: TS,
	});
}

async function seedBranch(
	db: ReturnType<typeof createTestDb>,
	o: { id: string; businessId: string; area: string; lat?: number; lng?: number },
) {
	const { branchesSchema } = await import("@repo/core/src/database/schema");
	// biome-ignore lint/suspicious/noExplicitAny: better-sqlite3 vs D1 drizzle type mismatch
	await (db as any).insert(branchesSchema).values({
		id: o.id,
		businessId: o.businessId,
		name: `${o.area} Branch`,
		address: "123 St",
		area: o.area,
		city: "Dhaka",
		lat: o.lat ?? null,
		lng: o.lng ?? null,
		createdAt: TS,
	});
}

async function seedProduct(
	db: ReturnType<typeof createTestDb>,
	o: { id: string; branchId: string; price: number },
) {
	const { productsSchema } = await import("@repo/core/src/database/schema");
	// biome-ignore lint/suspicious/noExplicitAny: better-sqlite3 vs D1 drizzle type mismatch
	await (db as any).insert(productsSchema).values({
		id: o.id,
		branchId: o.branchId,
		name: "Cylinder",
		price: o.price,
		stock: 10,
		status: "Active",
		createdAt: TS,
	});
}

describe("commerceSearch — area mode (real DB)", () => {
	let db: ReturnType<typeof createTestDb>;

	beforeEach(() => {
		db = createTestDb();
	});

	it("returns only commerce sellers with a branch in the requested area", async () => {
		await seedBusiness(db, { id: "c1", vertical: "commerce" });
		await seedBranch(db, { id: "c1b", businessId: "c1", area: "Banani" });
		await seedProduct(db, { id: "c1p", branchId: "c1b", price: 1200 });

		// A booking business in the same area — must be excluded.
		await seedBusiness(db, { id: "b1", vertical: "booking" });
		await seedBranch(db, { id: "b1b", businessId: "b1", area: "Banani" });

		// A commerce business in a different area — must be excluded.
		await seedBusiness(db, { id: "c2", vertical: "commerce" });
		await seedBranch(db, { id: "c2b", businessId: "c2", area: "Gulshan" });

		const result = await commerceSearch(db as never, { area: "Banani" });
		expect(result.data.map((r) => r.id)).toEqual(["c1"]);
		expect(result.data[0]).toMatchObject({
			vertical: "commerce",
			area: "Banani",
			minPrice: 1200,
			distanceKm: null,
		});
		expect(result.aiRanked).toBe(false);
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run --filter @repo/api test -- commerce-strategy`
Expected: FAIL — `Cannot find module '.../commerce-strategy'`.

- [ ] **Step 3: Implement `commerceSearch`**

Create `workers/api/src/modules/search/commerce-strategy.ts`:

```ts
import { and, eq, getDB, isNull, sql } from "@repo/core/src/database/client";
import {
	branchesSchema,
	businessesSchema,
	businessPhotosSchema,
	productsSchema,
	reviewsSchema,
} from "@repo/core/src/database/schema";
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
}

// Great-circle distance in km between two WGS84 points (computed in app code
// because D1/SQLite has no reliable math functions).
function haversineKm(
	aLat: number,
	aLng: number,
	bLat: number,
	bLng: number,
): number {
	const R = 6371;
	const dLat = ((bLat - aLat) * Math.PI) / 180;
	const dLng = ((bLng - aLng) * Math.PI) / 180;
	const s =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((aLat * Math.PI) / 180) *
			Math.cos((bLat * Math.PI) / 180) *
			Math.sin(dLng / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(s));
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
			// Nearest branch: when area is given, prefer the matching branch; else first geo branch.
			area: sql<
				string | null
			>`(SELECT ${branchesSchema.area} FROM ${branchesSchema} WHERE ${branchesSchema.businessId} = ${businessesSchema.id} AND ${branchesSchema.deletedAt} IS NULL ${area ? sql`AND ${branchesSchema.area} = ${area}` : sql``} LIMIT 1)`,
			lat: sql<
				number | null
			>`(SELECT ${branchesSchema.lat} FROM ${branchesSchema} WHERE ${branchesSchema.businessId} = ${businessesSchema.id} AND ${branchesSchema.deletedAt} IS NULL AND ${branchesSchema.lat} IS NOT NULL LIMIT 1)`,
			lng: sql<
				number | null
			>`(SELECT ${branchesSchema.lng} FROM ${branchesSchema} WHERE ${branchesSchema.businessId} = ${businessesSchema.id} AND ${branchesSchema.deletedAt} IS NULL AND ${branchesSchema.lng} IS NOT NULL LIMIT 1)`,
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

	let candidates = rows.filter((v) => {
		if (
			minRating !== undefined &&
			(v.avgRating === null || v.avgRating < minRating)
		)
			return false;
		return true;
	});

	// Distance mode: rank by proximity when device coords are provided.
	const withDistance = candidates.map((v) => ({
		...v,
		distanceKm:
			lat !== undefined && lng !== undefined && v.lat !== null && v.lng !== null
				? haversineKm(lat, lng, v.lat, v.lng)
				: null,
	}));

	if (lat !== undefined && lng !== undefined) {
		// Rows without coordinates sort last.
		withDistance.sort(
			(a, b) =>
				(a.distanceKm ?? Number.POSITIVE_INFINITY) -
				(b.distanceKm ?? Number.POSITIVE_INFINITY),
		);
	} else if (sortBy === "rating") {
		withDistance.sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0));
	} else if (sortBy === "price") {
		withDistance.sort((a, b) => (a.minPrice ?? 99999) - (b.minPrice ?? 99999));
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
	}));

	return { data, aiRanked: false };
}
```

- [ ] **Step 4: Wire the commerce branch into the shell**

In `workers/api/src/modules/search/index.ts`, add the import and dispatch. Replace the handler body:

```ts
import { commerceSearch } from "./commerce-strategy";
```

```ts
export const searchApp = createApp().openapi(searchRoute, async (c) => {
	const { vertical = "booking", ...params } = c.req.valid("query");
	const result =
		vertical === "commerce"
			? await commerceSearch(undefined, params)
			: await bookingSearch(params, c.env.TALASH_AI as never);
	return c.json(result, 200);
});
```

- [ ] **Step 5: Run the integration test to verify it passes**

Run: `bun run --filter @repo/api test -- commerce-strategy`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add workers/api/src/modules/search/
git commit -m "feat(api): commerce search strategy — area mode + vertical dispatch (#75)"
```

---

### Task 4: Commerce strategy — distance ordering

Pin the Haversine ordering with a real-DB test.

**Files:**
- Test: `workers/api/src/__tests__/modules/search/commerce-strategy.integration.test.ts` (add a describe block)

- [ ] **Step 1: Write the failing distance test**

Append to the integration test file:

```ts
describe("commerceSearch — distance mode (real DB)", () => {
	let db: ReturnType<typeof createTestDb>;
	beforeEach(() => {
		db = createTestDb();
	});

	it("ranks sellers nearest-first by branch lat/lng and sets distanceKm", async () => {
		// Far seller (~3 km north).
		await seedBusiness(db, { id: "far", vertical: "commerce" });
		await seedBranch(db, {
			id: "far-b",
			businessId: "far",
			area: "Uttara",
			lat: 23.81,
			lng: 90.4,
		});
		// Near seller (~0.1 km).
		await seedBusiness(db, { id: "near", vertical: "commerce" });
		await seedBranch(db, {
			id: "near-b",
			businessId: "near",
			area: "Banani",
			lat: 23.781,
			lng: 90.4,
		});

		const result = await commerceSearch(db as never, {
			lat: 23.78,
			lng: 90.4,
		});
		expect(result.data.map((r) => r.id)).toEqual(["near", "far"]);
		const near = result.data[0];
		expect(near?.distanceKm).not.toBeNull();
		expect(near?.distanceKm as number).toBeLessThan(
			result.data[1]?.distanceKm as number,
		);
	});

	it("sorts sellers without coordinates last in distance mode", async () => {
		await seedBusiness(db, { id: "geo", vertical: "commerce" });
		await seedBranch(db, {
			id: "geo-b",
			businessId: "geo",
			area: "Banani",
			lat: 23.78,
			lng: 90.4,
		});
		await seedBusiness(db, { id: "nogeo", vertical: "commerce" });
		await seedBranch(db, { id: "nogeo-b", businessId: "nogeo", area: "Mirpur" });

		const result = await commerceSearch(db as never, { lat: 23.78, lng: 90.4 });
		expect(result.data.map((r) => r.id)).toEqual(["geo", "nogeo"]);
		expect(result.data[1]?.distanceKm).toBeNull();
	});
});
```

- [ ] **Step 2: Run to verify**

Run: `bun run --filter @repo/api test -- commerce-strategy`
Expected: PASS (implementation from Task 3 already supports distance mode).

> If the empty-coordinate ordering fails, confirm the `withDistance.sort` uses `Number.POSITIVE_INFINITY` for null distances (Task 3, Step 3).

- [ ] **Step 3: Run the full api suite to confirm no regressions**

Run: `bun run --filter @repo/api test`
Expected: PASS — the pre-existing 270+ tests plus the new search tests all green.

- [ ] **Step 4: Commit**

```bash
git add workers/api/src/__tests__/modules/search/commerce-strategy.integration.test.ts
git commit -m "test(api): pin commerce search distance ordering (#75)"
```

---

### Task 5: api-client — vertical-aware search params & result fields

**Files:**
- Modify: `packages/api-client/src/endpoints/search.ts`
- Test: `packages/api-client/src/__tests__/client.test.ts` (add a param-passthrough test)

- [ ] **Step 1: Write the failing test**

Add to `packages/api-client/src/__tests__/client.test.ts` (follow the existing mock-fetch pattern used there):

```ts
it("search.businesses forwards vertical/area/lat/lng params", async () => {
	const calls: Array<{ path: string; params: unknown }> = [];
	const client = {
		get: (path: string, params: unknown) => {
			calls.push({ path, params });
			return Promise.resolve({ data: [], aiRanked: false });
		},
	} as never;
	const { createSearchEndpoints } = await import("../endpoints/search");
	const ep = createSearchEndpoints(client);
	await ep.businesses({ vertical: "commerce", area: "Banani", lat: 23.78, lng: 90.4 });
	expect(calls[0]?.path).toBe("/api/v1/search");
	expect(calls[0]?.params).toMatchObject({
		vertical: "commerce",
		area: "Banani",
		lat: 23.78,
		lng: 90.4,
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run --filter @repo/api-client test`
Expected: FAIL — `vertical`/`area` are not valid params (TS error) and not forwarded.

- [ ] **Step 3: Extend the endpoint types**

In `packages/api-client/src/endpoints/search.ts`, import `BusinessVertical` and extend both the result interface and the params:

```ts
import type { ApiClient } from "../client";
import type { BusinessResult, BusinessVertical } from "../types";

export interface EnrichedSearchResult extends BusinessResult {
	vertical: BusinessVertical;
	minPrice: number | null;
	avgRating: number | null;
	coverPhotoUrl: string | null;
	lat: number | null;
	lng: number | null;
	area: string | null;
	distanceKm: number | null;
}
```

And the params object:

```ts
		businesses: (params: {
			vertical?: BusinessVertical;
			q?: string;
			city?: string;
			area?: string;
			category?: string;
			lat?: number;
			lng?: number;
			minPrice?: number;
			maxPrice?: number;
			minRating?: number;
			sortBy?: SearchSortBy;
			limit?: number;
		}) => client.get<SearchResponse>("/api/v1/search", params),
```

> `BusinessResult` lacks `vertical`; add it as a top-level field on `EnrichedSearchResult` (above), not on `BusinessResult`, to avoid touching unrelated callers.

- [ ] **Step 4: Run to verify it passes**

Run: `bun run --filter @repo/api-client test`
Expected: PASS.

- [ ] **Step 5: Build the api-client to confirm types**

Run: `bun run --filter @repo/api-client build`
Expected: success, no TS errors.

- [ ] **Step 6: Commit**

```bash
git add packages/api-client/src/endpoints/search.ts packages/api-client/src/__tests__/client.test.ts
git commit -m "feat(api-client): vertical-aware search params + commerce result fields (#75)"
```

---

## Phase 2 — Mobile app

### Task 6: Device location hook

**Files:**
- Modify: `apps/mobile-app/package.json` (via `expo install`)
- Create: `apps/mobile-app/src/hooks/useDeviceLocation.ts`

- [ ] **Step 1: Install expo-location (SDK-correct version)**

Run from `apps/mobile-app`:

```bash
cd apps/mobile-app && bunx expo install expo-location
```

Expected: `expo-location` added to `package.json` at the Expo-56-compatible version.

- [ ] **Step 2: Create the hook**

Create `apps/mobile-app/src/hooks/useDeviceLocation.ts`:

```ts
import * as Location from "expo-location";
import { useCallback, useState } from "react";

export type LocationStatus = "idle" | "loading" | "granted" | "denied" | "error";

export interface DeviceLocation {
	lat: number;
	lng: number;
}

/**
 * On-demand device location. Call `request()` (e.g. when the user enters the
 * commerce segment); on denial the caller falls back to the manual area picker.
 */
export function useDeviceLocation() {
	const [status, setStatus] = useState<LocationStatus>("idle");
	const [coords, setCoords] = useState<DeviceLocation | null>(null);

	const request = useCallback(async () => {
		setStatus("loading");
		try {
			const { status: perm } = await Location.requestForegroundPermissionsAsync();
			if (perm !== "granted") {
				setStatus("denied");
				return null;
			}
			const pos = await Location.getCurrentPositionAsync({
				accuracy: Location.Accuracy.Balanced,
			});
			const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
			setCoords(next);
			setStatus("granted");
			return next;
		} catch {
			setStatus("error");
			return null;
		}
	}, []);

	const clear = useCallback(() => {
		setCoords(null);
		setStatus("idle");
	}, []);

	return { status, coords, request, clear };
}
```

- [ ] **Step 3: Typecheck the mobile app**

Run: `bun run --filter @repo/mobile-app typecheck` (or the app's lint/tsc script; check `apps/mobile-app/package.json` scripts).
Expected: no type errors referencing `expo-location`.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile-app/package.json apps/mobile-app/bun.lock apps/mobile-app/src/hooks/useDeviceLocation.ts
git commit -m "feat(mobile-app): on-demand device location hook (#75)"
```

---

### Task 7: Vertical-aware search hook + UI Business fields

**Files:**
- Modify: `apps/mobile-app/src/data.ts` (add `area?`, `distanceKm?` to `Business`)
- Modify: `apps/mobile-app/src/hooks/useBusinessSearch.ts`

- [ ] **Step 1: Add optional discovery fields to the UI Business type**

In `apps/mobile-app/src/data.ts`, inside `export type Business = { ... }`, add:

```ts
	/** Commerce discovery: nearest branch area (null for booking results). */
	area?: string | null;
	/** Commerce discovery: distance from the user in km when GPS is used. */
	distanceKm?: number | null;
```

- [ ] **Step 2: Update the search hook to be vertical-aware**

Replace `apps/mobile-app/src/hooks/useBusinessSearch.ts` with:

```ts
import type {
	BusinessVertical,
	EnrichedSearchResult,
	SearchSortBy,
} from "@repo/api-client";
import { useQuery } from "@tanstack/react-query";
import type { Business } from "../data";
import { api } from "../lib/api";

function adaptBusiness(r: EnrichedSearchResult): Business {
	return {
		id: r.id,
		name: r.name,
		vertical: r.vertical,
		category: r.category,
		city: r.city,
		rating: r.avgRating ?? 0,
		reviews: 0,
		from: r.minPrice ?? 0,
		tone: ["#e8f5e9", "#1b5e20"],
		blurb: r.description ?? "",
		coverPhotoUrl: r.coverPhotoUrl,
		mapLat: r.lat ?? null,
		mapLng: r.lng ?? null,
		area: r.area,
		distanceKm: r.distanceKm,
		branches: [],
		services: [],
	};
}

export interface BusinessSearchFilters {
	vertical?: BusinessVertical;
	q?: string;
	city?: string;
	area?: string;
	category?: string;
	lat?: number;
	lng?: number;
	minPrice?: number;
	maxPrice?: number;
	minRating?: number;
	sortBy?: SearchSortBy;
	/** Commerce mode is suspended until the user picks an area or grants GPS. */
	enabled?: boolean;
}

export function useBusinessSearch(params: BusinessSearchFilters) {
	const { enabled = true, ...filters } = params;
	return useQuery({
		queryKey: ["search", "businesses", filters],
		queryFn: async () => {
			const res = await api.search.businesses({ ...filters, limit: 30 });
			return res.data.map(adaptBusiness);
		},
		enabled,
		staleTime: 60_000,
		placeholderData: (prev) => prev,
	});
}
```

> This removes the `// real per-result vertical lands with #75` marker and the hard-coded `vertical: "booking"`.

- [ ] **Step 3: Typecheck**

Run: `bun run --filter @repo/mobile-app typecheck`
Expected: no errors. (`EnrichedSearchResult` now carries `vertical`/`area`/`distanceKm` from Task 5.)

- [ ] **Step 4: Commit**

```bash
git add apps/mobile-app/src/data.ts apps/mobile-app/src/hooks/useBusinessSearch.ts
git commit -m "feat(mobile-app): vertical-aware search hook with per-result vertical (#75)"
```

---

### Task 8: Recent sellers (reorder source)

The UI `Order` drops `businessId`; add it through the adapter, then derive distinct past sellers and resolve their names via `businesses.get`.

**Files:**
- Modify: `apps/mobile-app/src/data.ts` (add `businessId` to `Order`)
- Modify: `apps/mobile-app/src/lib/adapters.ts` (carry `businessId`)
- Create: `apps/mobile-app/src/hooks/useRecentSellers.ts`

- [ ] **Step 1: Add `businessId` to the UI Order type**

In `apps/mobile-app/src/data.ts`, inside `export type Order = { ... }`, add after `id: string;`:

```ts
	businessId: string;
```

- [ ] **Step 2: Carry `businessId` through `adaptOrder`**

In `apps/mobile-app/src/lib/adapters.ts`, in the `adaptOrder` return object, add after `id: o.id,`:

```ts
		businessId: o.businessId,
```

- [ ] **Step 3: Create the recent-sellers hook**

Create `apps/mobile-app/src/hooks/useRecentSellers.ts`:

```ts
import { useQueries } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useMyOrders } from "./useOrders";

export interface RecentSeller {
	id: string;
	name: string;
}

/**
 * Distinct sellers from the customer's past orders (most-recent first), resolved
 * to a name via businesses.get. Backs the "Order again" row on commerce discovery.
 */
export function useRecentSellers(): RecentSeller[] {
	const { data: orders } = useMyOrders();

	// Distinct businessIds preserving recency order (useMyOrders is newest-first).
	const ids: string[] = [];
	for (const o of orders ?? []) {
		if (!ids.includes(o.businessId)) ids.push(o.businessId);
	}

	const results = useQueries({
		queries: ids.map((id) => ({
			queryKey: ["business", id],
			queryFn: () => api.businesses.get(id),
			staleTime: 5 * 60_000,
		})),
	});

	return results
		.map((r, i) => (r.data ? { id: ids[i] as string, name: r.data.name } : null))
		.filter((s): s is RecentSeller => s !== null);
}
```

> Confirm `api.businesses.get(id)` returns an object with `.name` (it returns a `Business`). If the response is wrapped (`{ data }`), adjust to `r.data.data.name`.

- [ ] **Step 4: Typecheck**

Run: `bun run --filter @repo/mobile-app typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile-app/src/data.ts apps/mobile-app/src/lib/adapters.ts apps/mobile-app/src/hooks/useRecentSellers.ts
git commit -m "feat(mobile-app): recent-sellers hook for commerce reorder (#75)"
```

---

### Task 9: Search screen — segment, commerce location bar, area picker, seller list, reorder

Wire the pieces into `SearchScreen`. Booking mode renders exactly as before; the Gas segment renders the commerce experience.

**Files:**
- Modify: `apps/mobile-app/src/components/screens/SearchScreen.tsx`

- [ ] **Step 1: Add vertical + location state and the search params wiring**

Near the top of the `SearchScreen` component, add state:

```tsx
const [vertical, setVertical] = useState<"booking" | "commerce">("booking");
const [area, setArea] = useState<string | null>(null);
const [areaPickerOpen, setAreaPickerOpen] = useState(false);
const location = useDeviceLocation();
```

Add the imports at the top:

```tsx
import { useDeviceLocation } from "../../hooks/useDeviceLocation";
import { useRecentSellers } from "../../hooks/useRecentSellers";
```

Build the commerce search params and gate them (commerce stays disabled until GPS or an area is chosen):

```tsx
const commerceReady =
	vertical === "commerce" && (location.coords !== null || area !== null);

const searchParams: BusinessSearchFilters =
	vertical === "booking"
		? { vertical: "booking", ...filters }
		: {
				vertical: "commerce",
				q: filters.q,
				city: filters.city,
				area: area ?? undefined,
				lat: location.coords?.lat,
				lng: location.coords?.lng,
				enabled: commerceReady,
			};

const { data: results, isLoading, isError, refetch } = useBusinessSearch(searchParams);
const recentSellers = useRecentSellers();
```

> Adapt `filters` to whatever the screen already holds in `BusinessSearchFilters` state — keep booking behavior identical to the current call.

- [ ] **Step 2: Request GPS when entering the Gas segment**

Add an effect:

```tsx
useEffect(() => {
	if (vertical === "commerce" && location.status === "idle") {
		void location.request();
	}
}, [vertical, location]);
```

(Import `useEffect` from React if not already imported.)

- [ ] **Step 3: Render the segment toggle above the result list**

Add a segmented control near the top of the screen body (style mirrors `FilterSheet`):

```tsx
<View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 10 }}>
	{(["booking", "commerce"] as const).map((v) => (
		<TouchableOpacity
			key={v}
			onPress={() => setVertical(v)}
			activeOpacity={0.8}
			style={{
				flex: 1,
				paddingVertical: 9,
				borderRadius: Radius.md,
				alignItems: "center",
				backgroundColor: vertical === v ? Colors.primary600 : Colors.surface,
				borderWidth: 1,
				borderColor: vertical === v ? Colors.primary600 : Colors.border,
			}}
		>
			<Text style={{ fontWeight: "600", color: vertical === v ? "#fff" : Colors.ink600 }}>
				{v === "booking" ? "Salons" : "Gas sellers"}
			</Text>
		</TouchableOpacity>
	))}
</View>
```

> Use the token names that already exist in `../../tokens` (the screen imports `Colors, Radius, Shadow`). If `Colors.surface`/`Colors.border` don't exist, substitute the nearest existing neutrals used elsewhere in this file.

- [ ] **Step 4: Render the commerce location bar (only in Gas mode)**

Above the list, when `vertical === "commerce"`:

```tsx
{vertical === "commerce" && (
	<TouchableOpacity
		onPress={() => setAreaPickerOpen(true)}
		activeOpacity={0.8}
		style={{
			marginHorizontal: 16,
			marginBottom: 10,
			padding: 12,
			borderRadius: Radius.md,
			borderWidth: 1,
			borderColor: Colors.border,
			flexDirection: "row",
			alignItems: "center",
			gap: 8,
		}}
	>
		<Icons.MapPin size={16} color={Colors.primary600} />
		<Text style={{ flex: 1, color: Colors.ink600 }}>
			{area
				? `Delivering to ${area}`
				: location.coords
					? "Near you"
					: "Choose your area"}
		</Text>
		<Text style={{ color: Colors.primary600, fontWeight: "600" }}>Change</Text>
	</TouchableOpacity>
)}
```

- [ ] **Step 5: Render the area picker modal**

Source the area list from the seeded BD areas (a static list is fine for the MVP — coverage is implicit). Add near the other modals:

```tsx
const AREAS = [
	"Gulshan", "Banani", "Dhanmondi", "Mirpur", "Uttara",
	"Mohammadpur", "Bashundhara", "Panthapath",
];

<Modal visible={areaPickerOpen} animationType="slide" transparent onRequestClose={() => setAreaPickerOpen(false)}>
	<View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.3)" }}>
		<View style={{ backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 32 }}>
			<Text style={{ fontSize: 16, fontWeight: "700", marginBottom: 12 }}>Choose your area</Text>
			{AREAS.map((a) => (
				<TouchableOpacity
					key={a}
					onPress={() => { setArea(a); location.clear(); setAreaPickerOpen(false); }}
					style={{ paddingVertical: 12 }}
				>
					<Text style={{ fontSize: 15, color: a === area ? Colors.primary600 : Colors.ink600 }}>{a}</Text>
				</TouchableOpacity>
			))}
		</View>
	</View>
</Modal>
```

> Picking an area calls `location.clear()` so the manual override takes precedence over GPS (area mode vs distance mode are mutually exclusive at the query layer).

- [ ] **Step 6: Render the "Order again" row + seller cards in commerce mode**

In Gas mode, before the result list, render recent sellers; reuse the existing result-card rendering for the seller list. The card already navigates to the business route by `id` — tapping a commerce business opens `CommerceBusinessScreen` via the existing experience registry. Show `area`/`distanceKm` on the card subtitle:

```tsx
{vertical === "commerce" && recentSellers.length > 0 && (
	<View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
		<SectionTitle>Order again</SectionTitle>
		<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
			{recentSellers.map((s) => (
				<TouchableOpacity
					key={s.id}
					onPress={() => router.push(`/business?id=${s.id}`)}
					style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border }}
				>
					<Text style={{ fontWeight: "600", color: Colors.ink700 }}>{s.name}</Text>
				</TouchableOpacity>
			))}
		</ScrollView>
	</View>
)}
```

For the seller-card subtitle (in the existing card render, when `vertical === "commerce"`), show distance/area instead of city:

```tsx
{item.distanceKm != null
	? `${item.distanceKm.toFixed(1)} km away`
	: item.area ?? item.city}
```

> Match the screen's existing navigation helper (it already pushes to the business route from a result card — reuse that exact call rather than hard-coding `router.push` if a helper exists).

- [ ] **Step 7: Commerce empty/cold-start state**

When `vertical === "commerce" && !commerceReady`, render the existing `EmptyState` prompting area selection instead of the result list:

```tsx
{vertical === "commerce" && !commerceReady ? (
	<EmptyState
		icon="MapPin"
		title="Where should we deliver?"
		subtitle="Choose your area or enable location to find gas sellers near you."
	/>
) : (
	/* existing result list / loading / error rendering */
)}
```

> Use `EmptyState`'s actual prop names (it's imported from `../ui`); adjust if it takes `message` rather than `subtitle`.

- [ ] **Step 8: Manually verify in the app**

Run the app and seed data:

```bash
bun run db:fresh
bun run mobile-app:dev
```

Verify: Search tab shows the segment; switching to **Gas sellers** prompts for location (or shows "Choose your area"); picking **Banani** lists commerce sellers in Banani; a seller card opens `CommerceBusinessScreen`; "Order again" appears after placing an order; the **Salons** segment behaves exactly as before.

- [ ] **Step 9: Run mobile tests + lint**

Run: `bun run --filter @repo/mobile-app test` and `bun run lint`
Expected: PASS (existing mobile tests green; touched files lint-clean).

- [ ] **Step 10: Commit**

```bash
git add apps/mobile-app/src/components/screens/SearchScreen.tsx
git commit -m "feat(mobile-app): commerce discovery — segment, area/GPS, seller list, reorder (#75)"
```

---

### Task 10: Docs + close-out

**Files:**
- Modify: `docs/guides/api-endpoints.md` (document the `vertical`/`area`/`lat`/`lng` params on `/search`)
- Modify: `docs/guides/ui-backend-sync.md` (note commerce discovery wiring: `useBusinessSearch` vertical-aware, `useRecentSellers`)
- Check: `AGENTS.md` "Learned Workspace Facts" — add commerce-discovery search entry if it fits the existing list

- [ ] **Step 1: Update API endpoint docs**

Document on the `GET /api/v1/search` entry: `vertical` (default `booking`), and the commerce-only `area`, `lat`, `lng` params; note the response adds `vertical`, `area`, `distanceKm`.

- [ ] **Step 2: Update the UI↔backend sync guide**

Add a short note that discovery is vertical-aware: booking → AI-ranked text search; commerce → area or nearest-first; `useBusinessSearch` passes `vertical`, and `useRecentSellers` backs reorder.

- [ ] **Step 3: Run the full verification sweep**

```bash
bun run lint
bun run --filter @repo/api test
bun run --filter @repo/api-client test
bun run --filter @repo/mobile-app test
bun run --filter @repo/cli test
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add docs/ AGENTS.md
git commit -m "docs: commerce discovery search params + UI wiring (#75)"
```

- [ ] **Step 5: Close the issue on merge**

When the PR merges, comment/close [#75](https://github.com/hasib-devs/Talash/issues/75) referencing the merge.

---

## Self-review notes

- **Spec coverage:** search shell + `vertical` default booking (Task 2,3) ✓; commerce by `branches.area` (Task 3) ✓; nearest by `lat/lng` Haversine in app code (Task 4) ✓; booking search unchanged — verbatim lift + existing tests green + default-path test (Task 2) ✓; mobile seller listing (Task 9) ✓; reorder entry point (Task 8,9) ✓; tests at both seams (Tasks 2–5,9) ✓; seed `lat/lng` (Task 1) ✓; `expo-location` dependency (Task 6) ✓; docs (Task 10) ✓.
- **Non-goals honored:** no reverse geocoding (GPS → distance only), no zone editor, no order-cloning.
- **Open implementation confirmations flagged inline:** `api.businesses.get` response wrapping (Task 8), exact token names (`Colors.surface/border`) and `EmptyState` prop names (Task 9), the screen's existing result-card navigation helper (Task 9). These are local lookups for the implementer, not design gaps.
