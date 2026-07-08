# Phase 2 — Reviews I've Written Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an authenticated customer see all the reviews they've written (Pending + Published) on the marketing-site account page, via a new self-scoped `GET /api/v1/reviews/mine` endpoint.

**Architecture:** A full vertical slice with no schema change (the `reviews_user_id_idx` index already exists): a `findByUser` repository method joins venue + service names → a `listMine` service method → a self-scoped `GET /reviews/mine` route on the existing authenticated `userApp` → an `api-client` `listMine` method → a self-contained `ReviewsSection` component rendered by the account page. Read-only (no edit/delete — no such endpoint exists; deliberate boundary).

**Tech Stack:** Hono + Cloudflare Workers + Drizzle/D1 (API), Next.js 16 + React 19 + TanStack Query (web), Vitest.

**Spec:** [2026-06-08-account-auth-features-design.md](../specs/2026-06-08-account-auth-features-design.md) (Phase 2). Builds on Phases 0–1 (merged).

---

## Canonical verification commands (Turbo-routed Bun monorepo)
- **API single test file:** `cd workers/api && bunx vitest run <path>`
- **API full suite:** `cd workers/api && bunx vitest run`
- **marketing-site single test:** `cd sites/marketing-site && bunx vitest run <path>`
- **marketing-site full suite:** `cd sites/marketing-site && bunx vitest run`
- **Lint (web):** `bun run --filter @repo/marketing-site lint` (from worktree root)
- **Build:** `bun run build` (from worktree root)
- Note: `cd workers/api && bunx tsc --noEmit` has **pre-existing** errors in test-helper/drizzle-dual-version files unrelated to this work — do not treat those as regressions. The API gate is the vitest suite + build.

## File Structure

| File | Responsibility |
|---|---|
| `packages/core/src/database/repositories/reviews.repository.ts` | **Modify.** Add `ReviewWithVenueService` type + `findByUser(userId)` (joins venue+service names, excludes soft-deleted, newest-first). |
| `workers/api/src/modules/reviews/reviews.service.ts` | **Modify.** Add `listMine(userId)` delegating to `repo.findByUser`. |
| `workers/api/src/modules/reviews/index.ts` | **Modify.** Add `MyReviewSchema` + `GET /mine` route on the authenticated `userApp`. |
| `workers/api/src/__tests__/modules/reviews/reviews.service.test.ts` | **Modify.** Append a `listMine` describe block (real-DB seeded). |
| `workers/api/src/__tests__/modules/reviews/reviews.routes.test.ts` | **Modify.** Add `listMine` to the mocked service + a `GET /mine` describe block. |
| `packages/api-client/src/types.ts` | **Modify.** Add `MyReview` interface. |
| `packages/api-client/src/endpoints/reviews.ts` | **Modify.** Add `listMine()` method. |
| `sites/marketing-site/src/app/account/_components/ReviewsSection.tsx` | **Create.** Self-contained "My reviews" list (read-only). |
| `sites/marketing-site/src/app/account/_components/__tests__/ReviewsSection.test.tsx` | **Create.** Render test. |
| `sites/marketing-site/src/app/account/page.tsx` | **Modify.** Render `<ReviewsSection />` after `<BookingsSection />`. |

---

## Task 1: `findByUser` repository method (core)

**Files:**
- Modify: `packages/core/src/database/repositories/reviews.repository.ts`

No standalone repo unit test (repositories in this codebase aren't unit-tested in isolation); the real-DB **service** test in Task 2 exercises this SQL.

- [ ] **Step 1: Add the type + method**

In `packages/core/src/database/repositories/reviews.repository.ts`:

1. Update the drizzle import to add `desc`:
```ts
import { and, desc, eq, isNull } from "drizzle-orm";
```
2. Update the schema import to add `venuesSchema` + `servicesSchema`:
```ts
import { reviewsSchema, servicesSchema, usersSchema, venuesSchema } from "../schema";
```
3. Add this exported type next to the existing `ReviewWithUser` type (near the top, after the imports):
```ts
export type ReviewWithVenueService = ReviewSelect & {
	venueName: string;
	serviceName: string;
};
```
4. Add this method to the `ReviewsRepository` class (e.g. after `findPendingByVenue`):
```ts
	async findByUser(userId: string): Promise<ReviewWithVenueService[]> {
		const rows = await this.db
			.select({
				id: reviewsSchema.id,
				userId: reviewsSchema.userId,
				venueId: reviewsSchema.venueId,
				serviceId: reviewsSchema.serviceId,
				bookingId: reviewsSchema.bookingId,
				rating: reviewsSchema.rating,
				text: reviewsSchema.text,
				status: reviewsSchema.status,
				createdAt: reviewsSchema.createdAt,
				updatedAt: reviewsSchema.updatedAt,
				deletedAt: reviewsSchema.deletedAt,
				venueName: venuesSchema.name,
				serviceName: servicesSchema.name,
			})
			.from(reviewsSchema)
			.leftJoin(venuesSchema, eq(reviewsSchema.venueId, venuesSchema.id))
			.leftJoin(servicesSchema, eq(reviewsSchema.serviceId, servicesSchema.id))
			.where(and(eq(reviewsSchema.userId, userId), isNull(reviewsSchema.deletedAt)))
			.orderBy(desc(reviewsSchema.createdAt));
		return rows.map((r) => ({
			...r,
			venueName: r.venueName ?? "Unknown venue",
			serviceName: r.serviceName ?? "Unknown service",
		}));
	}
```

Rule (per spec): excludes soft-deleted (`isNull(deletedAt)`), returns **both `Pending` and `Published`** (no status filter — a rejected review is soft-deleted, so it's already excluded), newest-first.

- [ ] **Step 2: Type-check core builds via the API suite**

There's no isolated core test; verify it compiles by running the API suite in Task 2. For now, confirm no obvious type error by reading: `venuesSchema.name`/`servicesSchema.name` are `text().notNull()` (string), the leftJoin makes them nullable in the row, and the `?? "Unknown …"` coalesces to string — matching `ReviewWithVenueService`.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/database/repositories/reviews.repository.ts
git commit -m "feat(core): add ReviewsRepository.findByUser (venue+service join, newest-first)"
```

---

## Task 2: `listMine` service + `GET /reviews/mine` route (api)

**Files:**
- Modify: `workers/api/src/modules/reviews/reviews.service.ts`
- Modify: `workers/api/src/modules/reviews/index.ts`
- Test: `workers/api/src/__tests__/modules/reviews/reviews.service.test.ts`
- Test: `workers/api/src/__tests__/modules/reviews/reviews.routes.test.ts`

- [ ] **Step 1: Write the failing service test**

Append this describe block to `workers/api/src/__tests__/modules/reviews/reviews.service.test.ts` (the file already imports `createTestDb`, `seedChain`, `reviewsSchema`, and defines `makeService`):

```ts
describe("ReviewsService.listMine", () => {
	it("returns the user's reviews (Pending+Published) with venue/service names, newest-first, excluding deleted and other users", async () => {
		const db = createTestDb();
		const { venueId, serviceId } = await seedChain(db, { ownerId: "owner-1" });
		await db.insert(reviewsSchema).values([
			{ id: "r-old", venueId, userId: "cust-1", serviceId, bookingId: "b1", rating: 4, text: "ok", status: "Published", createdAt: "2026-01-01T00:00:00.000Z" },
			{ id: "r-new", venueId, userId: "cust-1", serviceId, bookingId: "b2", rating: 5, text: "great", status: "Pending", createdAt: "2026-02-01T00:00:00.000Z" },
			{ id: "r-del", venueId, userId: "cust-1", serviceId, bookingId: "b3", rating: 1, text: "bad", status: "Published", createdAt: "2026-03-01T00:00:00.000Z", deletedAt: "2026-03-02T00:00:00.000Z" },
			{ id: "r-other", venueId, userId: "cust-2", serviceId, bookingId: "b4", rating: 3, text: "meh", status: "Published", createdAt: "2026-01-15T00:00:00.000Z" },
		] as never);

		const svc = makeService(db);
		const result = await svc.listMine("cust-1");

		expect(result.map((r) => r.id)).toEqual(["r-new", "r-old"]);
		expect(result[0].venueName).toBe("Test Venue");
		expect(result[0].serviceName).toBe("Haircut");
		expect(result[0].status).toBe("Pending");
	});
});
```

- [ ] **Step 2: Run it, verify it FAILS**

Run: `cd workers/api && bunx vitest run src/__tests__/modules/reviews/reviews.service.test.ts`
Expected: FAIL — `svc.listMine` is not a function.

- [ ] **Step 3: Implement the service method**

In `workers/api/src/modules/reviews/reviews.service.ts`, add this method to `ReviewsService` (e.g. after `listPending`):
```ts
	listMine(userId: string) {
		return this.repo.findByUser(userId);
	}
```

- [ ] **Step 4: Run the service test, verify it PASSES**

Run: `cd workers/api && bunx vitest run src/__tests__/modules/reviews/reviews.service.test.ts`
Expected: PASS (existing + the new listMine test).

- [ ] **Step 5: Write the failing route test**

In `workers/api/src/__tests__/modules/reviews/reviews.routes.test.ts`:
1. Add `listMine: vi.fn(),` to the `mockReviewsService` object.
2. Append this describe block:
```ts
describe("GET /api/v1/reviews/mine (authenticated)", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request("/api/v1/reviews/mine", {}, TEST_ENV);
		expect(res.status).toBe(401);
	});

	it("returns 200 with the caller's reviews", async () => {
		mockReviewsService.listMine.mockResolvedValue([
			{
				id: "review-1", userId: "user-1", venueId: "venue-1", serviceId: "svc-1",
				bookingId: "b1", rating: 5, text: "Great!", status: "Published",
				venueName: "Glow Spa", serviceName: "Facial",
				createdAt: "2026-01-01T00:00:00.000Z", updatedAt: null,
			},
		]);
		const token = await createTestToken({ userId: "user-1" });
		const res = await app.request(
			"/api/v1/reviews/mine",
			{ headers: { ...authHeader(token) } },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Array<Record<string, unknown>>;
		expect(body).toHaveLength(1);
		expect(body[0].venueName).toBe("Glow Spa");
		expect(mockReviewsService.listMine).toHaveBeenCalledWith("user-1");
	});
});
```
(`createTestToken` is `async` and defaults to `userId: "test-user-id"`; passing `{ userId: "user-1" }` makes the `toHaveBeenCalledWith("user-1")` assertion exact — matching the existing POST /reviews test in this file.)

- [ ] **Step 6: Run it, verify the 200 case FAILS** (route doesn't exist yet)

Run: `cd workers/api && bunx vitest run src/__tests__/modules/reviews/reviews.routes.test.ts`
Expected: the new `GET /mine` 200 test FAILS (404/route not found); the 401 test may pass-by-accident depending on routing.

- [ ] **Step 7: Implement the route**

In `workers/api/src/modules/reviews/index.ts`:
1. After the `ReviewSchema` definition, add:
```ts
const MyReviewSchema = ReviewSchema.extend({
	venueName: z.string(),
	serviceName: z.string(),
}).openapi("MyReview");
```
2. After the `submitRoute` definition, add the route definition:
```ts
const listMineRoute = createRoute({
	method: "get",
	path: "/mine",
	tags: ["Reviews"],
	summary: "List the authenticated user's own reviews",
	security: [{ bearerAuth: [] }],
	responses: {
		200: {
			content: { "application/json": { schema: z.array(MyReviewSchema) } },
			description: "OK",
		},
	},
});
```
3. Register it on `userApp` (which already applies `authenticate`). Change the existing single registration:
```ts
userApp.openapi(submitRoute, async (c) => {
	const body = c.req.valid("json");
	const review = await c.var.reviewsService.submit(c.var.user.id, body);
	return c.json(review, 201);
});
```
to chain the new route (register `/mine` first):
```ts
userApp
	.openapi(listMineRoute, async (c) => {
		const reviews = await c.var.reviewsService.listMine(c.var.user.id);
		return c.json(reviews, 200);
	})
	.openapi(submitRoute, async (c) => {
		const body = c.req.valid("json");
		const review = await c.var.reviewsService.submit(c.var.user.id, body);
		return c.json(review, 201);
	});
```

- [ ] **Step 8: Run both test files, verify PASS**

Run: `cd workers/api && bunx vitest run src/__tests__/modules/reviews/`
Expected: PASS (service + route).

- [ ] **Step 9: Full API suite (no regressions)**

Run: `cd workers/api && bunx vitest run`
Expected: all green (the prior count + the new tests).

- [ ] **Step 10: Commit**

```bash
git add workers/api/src/modules/reviews/reviews.service.ts workers/api/src/modules/reviews/index.ts workers/api/src/__tests__/modules/reviews/reviews.service.test.ts workers/api/src/__tests__/modules/reviews/reviews.routes.test.ts
git commit -m "feat(api): GET /reviews/mine — authenticated user's own reviews"
```

---

## Task 3: api-client `listMine` + `MyReview` type

**Files:**
- Modify: `packages/api-client/src/types.ts`
- Modify: `packages/api-client/src/endpoints/reviews.ts`

- [ ] **Step 1: Add the `MyReview` type**

In `packages/api-client/src/types.ts`, add (near the existing `Review` interface):
```ts
export interface MyReview {
	id: string;
	userId: string;
	venueId: string;
	serviceId: string;
	bookingId: string | null;
	rating: number;
	text: string;
	status: ReviewStatus;
	venueName: string;
	serviceName: string;
	createdAt: string;
	updatedAt: string | null;
}
```
(`ReviewStatus` is already defined in this file — `"Pending" | "Published"`.)

- [ ] **Step 2: Add the endpoint method**

In `packages/api-client/src/endpoints/reviews.ts`:
1. Add `MyReview` to the type import:
```ts
import type { MyReview, PaginatedResponse, Review, SingleResponse } from "../types";
```
2. Add this method to the returned object (e.g. after `list`):
```ts
		listMine: () => client.get<MyReview[]>("/api/v1/reviews/mine"),
```
The route returns a bare array (like `listPublished`), so the client type is `MyReview[]`.

- [ ] **Step 3: Type-check the api-client**

Run: `cd packages/api-client && bunx tsc --noEmit`
Expected: clean. (If the package has no local tsconfig for this, instead rely on the marketing-site type-check in Task 4, which imports `MyReview`.)

- [ ] **Step 4: Commit**

```bash
git add packages/api-client/src/types.ts packages/api-client/src/endpoints/reviews.ts
git commit -m "feat(api-client): add reviews.listMine + MyReview type"
```

---

## Task 4: `ReviewsSection` component + wire into account page (marketing-site)

**Files:**
- Create: `sites/marketing-site/src/app/account/_components/ReviewsSection.tsx`
- Test: `sites/marketing-site/src/app/account/_components/__tests__/ReviewsSection.test.tsx`
- Modify: `sites/marketing-site/src/app/account/page.tsx`

- [ ] **Step 1: Write the failing test**

Create `sites/marketing-site/src/app/account/_components/__tests__/ReviewsSection.test.tsx`:
```tsx
import type { MyReview } from "@repo/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listMine = vi.fn();
vi.mock("@/lib/api", () => ({ api: { reviews: { listMine: () => listMine() } } }));
vi.mock("@/hooks/useAuth", () => ({
	useAuth: () => ({ user: { id: "u1", email: null, name: "Sara", role: "user" } }),
}));

import { ReviewsSection } from "../ReviewsSection";

function review(over: Partial<MyReview>): MyReview {
	return {
		id: "r1", userId: "u1", venueId: "v1", serviceId: "s1", bookingId: "b1",
		rating: 5, text: "Loved it", status: "Published",
		venueName: "Glow Spa", serviceName: "Facial",
		createdAt: "2026-01-01T00:00:00.000Z", updatedAt: null, ...over,
	};
}

function renderSection() {
	const qc = new QueryClient();
	return render(
		<QueryClientProvider client={qc}>
			<ReviewsSection />
		</QueryClientProvider>,
	);
}

beforeEach(() => listMine.mockReset());

describe("ReviewsSection", () => {
	it("renders the venue name, text, and an Awaiting-approval badge for pending reviews", async () => {
		listMine.mockResolvedValue([
			review({ id: "r-pending", status: "Pending", venueName: "Glow Spa", text: "Nice" }),
		]);
		renderSection();
		await waitFor(() => expect(screen.getByText("Glow Spa")).toBeInTheDocument());
		expect(screen.getByText("Nice")).toBeInTheDocument();
		expect(screen.getByText(/Awaiting approval/i)).toBeInTheDocument();
	});

	it("renders nothing when the user has no reviews", async () => {
		listMine.mockResolvedValue([]);
		const { container } = renderSection();
		await waitFor(() => expect(listMine).toHaveBeenCalled());
		expect(container.querySelector("h2")).toBeNull();
	});
});
```

- [ ] **Step 2: Run it, verify it FAILS**

Run: `cd sites/marketing-site && bunx vitest run src/app/account/_components/__tests__/ReviewsSection.test.tsx`
Expected: FAIL — cannot resolve `../ReviewsSection`.

- [ ] **Step 3: Implement the component**

Create `sites/marketing-site/src/app/account/_components/ReviewsSection.tsx`:
```tsx
"use client";
import type { MyReview } from "@repo/api-client";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import Link from "next/link";
import { Stars } from "@/components/Stars";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";

export function ReviewsSection() {
	const { user } = useAuth();
	const { data } = useQuery({
		queryKey: ["my-reviews"],
		queryFn: () => api.reviews.listMine(),
		enabled: !!user,
		staleTime: 60_000,
	});
	const reviews: MyReview[] = data ?? [];

	// Mirror the other optional sections (notifications, favourites): render
	// nothing when there's no content.
	if (reviews.length === 0) return null;

	return (
		<div className="bg-surface rounded-xl border border-line overflow-hidden mt-6">
			<div className="flex items-center gap-2.5 px-6 py-4 border-b border-line">
				<Star size={18} className="text-green-700" />
				<h2 className="m-0 font-serif font-medium text-xl text-ink-900">
					My reviews
				</h2>
			</div>
			<div>
				{reviews.map((r, i) => (
					<div
						key={r.id}
						className={["px-6 py-4", i ? "border-t border-line-soft" : ""].join(" ")}
					>
						<div className="flex items-center justify-between gap-3">
							<Link
								href={`/venues/${r.venueId}`}
								className="font-sans text-sm font-semibold text-ink-900 hover:text-green-700 no-underline"
							>
								{r.venueName}
							</Link>
							<div className="flex items-center gap-2">
								<Stars value={r.rating} size={14} />
								{r.status === "Pending" && (
									<span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface border border-line text-ink-500">
										Awaiting approval
									</span>
								)}
							</div>
						</div>
						<div className="font-sans text-xs text-ink-400 mt-0.5">
							{r.serviceName}
						</div>
						<p className="font-sans text-sm text-ink-700 mt-1.5 m-0">{r.text}</p>
						<div className="font-sans text-xs text-ink-400 mt-1">
							{new Date(r.createdAt).toLocaleDateString("en-BD", {
								day: "numeric",
								month: "short",
								year: "numeric",
							})}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
```

- [ ] **Step 4: Run it, verify it PASSES**

Run: `cd sites/marketing-site && bunx vitest run src/app/account/_components/__tests__/ReviewsSection.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire into the account page**

In `sites/marketing-site/src/app/account/page.tsx`:
1. Add the import next to the other `_components` imports:
```tsx
import { ReviewsSection } from "./_components/ReviewsSection";
```
2. Render it immediately after `<BookingsSection />`:
```tsx
				<BookingsSection />

				<ReviewsSection />
```

- [ ] **Step 6: Type-check + full marketing-site suite**

Run: `cd sites/marketing-site && bunx tsc --noEmit` (clean) and `cd sites/marketing-site && bunx vitest run` (all green: Phase 0+1 suites + ReviewsSection).

- [ ] **Step 7: Commit**

```bash
git add sites/marketing-site/src/app/account/_components/ReviewsSection.tsx sites/marketing-site/src/app/account/_components/__tests__/ReviewsSection.test.tsx sites/marketing-site/src/app/account/page.tsx
git commit -m "feat(marketing-site): ReviewsSection — my written reviews on the account page"
```

---

## Task 5: Verification + docs

**Files:**
- Modify: `docs/guides/api-endpoints.md`
- Modify: `docs/feature-map.md`
- Modify: `workers/api/CLAUDE.md`
- Modify: `sites/marketing-site/AGENTS.md`

- [ ] **Step 1: Document the endpoint**

- In `docs/guides/api-endpoints.md`, find the Reviews route group and add a row/line for `GET /api/v1/reviews/mine` — "List the authenticated user's own reviews (Pending + Published), with venue + service names; self-scoped." Match the existing formatting of nearby entries (read the file first).
- In `docs/feature-map.md`, add a line linking the new "Reviews I've written" feature to the `GET /reviews/mine` endpoint + `ReviewsSection` component (match existing rows).

- [ ] **Step 2: Update the API guide note**

In `workers/api/CLAUDE.md`, under the `## Reviews` section, append: "`GET /api/v1/reviews/mine` (authenticated, self-scoped) returns the caller's own reviews (Pending + Published, excluding soft-deleted) via `ReviewsRepository.findByUser`, joined with venue + service names (`MyReview`)."

- [ ] **Step 3: Update the web layout note**

In `sites/marketing-site/AGENTS.md`, in the `account/_components/` description line (added in Phase 1), add `ReviewsSection (my written reviews)` to the list.

- [ ] **Step 4: Lint (web)**

Run: `bun run --filter @repo/marketing-site lint`
Expected: 0 errors. Fix only Phase 2 files if needed (`bunx biome check --write <file>`).

- [ ] **Step 5: Full suites**

Run: `cd workers/api && bunx vitest run` (all green) and `cd sites/marketing-site && bunx vitest run` (all green).

- [ ] **Step 6: Build**

Run: `bun run build` (from worktree root)
Expected: PASS.

- [ ] **Step 7: Manual smoke test**

Run the API (`bun run api:dev`) + web (`bun run marketing-site:dev`), sign in, open `/account`:
1. After leaving a review on a Completed booking (Past tab), the **My reviews** section appears showing the venue name, the star rating, the review text, the date, and an **"Awaiting approval"** badge while it's Pending.
2. A user with no reviews sees no "My reviews" section at all.

- [ ] **Step 8: Commit**

```bash
git add docs/guides/api-endpoints.md docs/feature-map.md workers/api/CLAUDE.md sites/marketing-site/AGENTS.md
git commit -m "docs: document GET /reviews/mine + ReviewsSection (Phase 2)"
```

---

## Self-Review notes (for the implementer)

- **Spec coverage:** `findByUser` returns Pending + Published, excludes deleted, newest-first, venue+service joined (Task 1); self-scoped `GET /reviews/mine` from `c.var.user.id` (Task 2); api-client `listMine` + `MyReview` (Task 3); read-only `ReviewsSection` with the "Awaiting approval" badge for Pending (Task 4); docs (Task 5). **Read-only** — no edit/delete (deliberate; no endpoint exists).
- **Type consistency:** `findByUser(userId): Promise<ReviewWithVenueService[]>`; `ReviewWithVenueService = ReviewSelect & { venueName; serviceName }`; service `listMine(userId)` returns the same; route returns a bare `z.array(MyReviewSchema)`; api-client `listMine(): MyReview[]`; component consumes `MyReview[]`. All aligned.
- **No schema change / migration** — `reviews_user_id_idx` already exists.
- **Route ordering:** `GET /mine` (static) does not collide with `GET /` (publicApp) or `GET /pending` (ownerApp); registered on the authenticated `userApp`.
- **Not in this phase:** profile photo (Phase 3). Do not add it.
```
