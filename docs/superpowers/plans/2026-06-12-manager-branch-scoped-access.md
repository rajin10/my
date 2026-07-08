# Manager Branch-Scoped Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give managers branch-scoped access to analytics, customers, and campaigns (owners keep full access), routed through a new authorization primitive and a proper service layer.

**Architecture:** A new `AuthorizationService.resolveBusinessBranchScope` both authorizes a caller against a business and returns the branch IDs they may see (owner → all branches; manager → intersection of their assigned branches with the business; empty → 403). Three new services (`AnalyticsService`, `CustomersService`, `CampaignsService`) call it, then pass the resolved branch IDs into already-branch-keyed repository queries. Route handlers become thin. No DB migration.

**Tech Stack:** Hono + Cloudflare Workers, Drizzle ORM over D1 (SQLite), Zod (`@hono/zod-openapi`), Vitest. Package manager: `bun`. Spec: `docs/superpowers/specs/2026-06-12-manager-branch-scoped-access-design.md`.

**Why each module migrates atomically:** the repo signature change and the route that consumes it must land in the same commit, or the intermediate state fails `tsc`. So Tasks 2–4 each migrate one module end-to-end (repo → service → routes → tests) and commit once.

**Conventions for this plan:**
- Run all `bun`/`vitest`/`tsc`/`biome` commands from `workers/api/` unless a path says otherwise.
- API test run: `bunx vitest run`. Single file/dir: `bunx vitest run <path>`.
- Lint a file: `bunx biome check <path>`; apply format: `bunx biome format --write <path>` (never `biome check --unsafe`).
- Tabs for indentation (Biome enforces). When adding an import that is only used by code in a *later* step of the same task, add the import and its first use in the **same** edit (the repo's PostToolUse formatter strips unused imports).
- `tsc --noEmit` in this worktree reports pre-existing errors in ~12 untouched files from a drizzle-orm duplicate-install artifact; gate type-checking on the files you touch (`grep` the output), not the global exit code.

---

## File structure

**`@repo/core` (`packages/core/`)**
- `src/database/repositories/branches.repository.ts` — *modify*: add `findIdsByBusiness`.
- `src/database/repositories/analytics.repository.ts` — *modify*: re-key methods to `branchIds`; remove private `getBranchIds`.
- `src/database/repositories/customers.repository.ts` — *modify*: re-key methods to `branchIds`; remove private `getBranchIds`.

**`@repo/api` (`workers/api/`)**
- `src/core/authorization.ts` — *modify*: add `resolveBusinessBranchScope`.
- `src/modules/{analytics,customers,campaigns}/<name>.service.ts` — *create*.
- `src/modules/{analytics,customers,campaigns}/index.ts` — *modify*: thin handlers + `branchScope` guard + installer; delete local `assertBusinessOwner` and inline repos.
- `src/types/index.ts` — *modify*: add 3 context vars.
- `src/modules/routes.ts` — *modify*: register 3 installers.
- `src/__tests__/helpers/create-test-app.ts` — *modify*: add 3 entries to `MockServices`.
- Tests: new service unit tests; rewritten route tests; updated analytics earnings integration test.

---

## Task 1: Authorization primitive + branch-id lookup

**Files:**
- Modify: `packages/core/src/database/repositories/branches.repository.ts`
- Modify: `workers/api/src/core/authorization.ts`
- Test: `workers/api/src/__tests__/core/authorization.test.ts`

- [ ] **Step 1: Add `findIdsByBusiness` to `BranchesRepository`**

In `packages/core/src/database/repositories/branches.repository.ts`, add this method directly below the existing `findByBusiness` (reuses the already-imported `and`, `eq`, `isNull`, `branchesSchema`):

```ts
	async findIdsByBusiness(businessId: string): Promise<string[]> {
		const rows = await this.db
			.select({ id: branchesSchema.id })
			.from(branchesSchema)
			.where(
				and(
					eq(branchesSchema.businessId, businessId),
					isNull(branchesSchema.deletedAt),
				),
			);
		return rows.map((b) => b.id);
	}
```

- [ ] **Step 2: Write the failing test for `resolveBusinessBranchScope`**

Append a new `describe` block to `workers/api/src/__tests__/core/authorization.test.ts`. **This file uses a real in-memory test DB, not mocks** — it builds the service with the existing `makeGuard(db)` helper and seeds data with `seedChain`. `createTestDb`, `seedChain`, `makeGuard`, `ForbiddenError`, and `NotFoundError` are already imported at the top; reuse them (do **not** add `vi.fn()` mocks). `seedChain(db, { ownerId })` inserts a business → branch → service chain and returns `{ ownerId, businessId, branchId, serviceId }`. This test also exercises the real `BranchesRepository.findIdsByBusiness` from Step 1.

```ts
describe("AuthorizationService.resolveBusinessBranchScope", () => {
	let db: ReturnType<typeof createTestDb>;
	beforeEach(() => {
		db = createTestDb();
	});

	it("owner: returns the business's branch IDs after asserting ownership", async () => {
		const { businessId, branchId } = await seedChain(db, {
			ownerId: "owner-1",
		});
		const result = await makeGuard(db).resolveBusinessBranchScope(
			"owner-1",
			businessId,
			null,
		);
		expect(result).toEqual([branchId]);
	});

	it("owner: throws ForbiddenError when not the owner", async () => {
		const { businessId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeGuard(db).resolveBusinessBranchScope("owner-2", businessId, null),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("owner: throws NotFoundError when the business is missing", async () => {
		await expect(
			makeGuard(db).resolveBusinessBranchScope("owner-1", "missing", null),
		).rejects.toBeInstanceOf(NotFoundError);
	});

	it("manager: returns the intersection of assigned branches with the business", async () => {
		const { businessId, branchId } = await seedChain(db, {
			ownerId: "owner-1",
		});
		const result = await makeGuard(db).resolveBusinessBranchScope(
			"mgr-1",
			businessId,
			[branchId, "unrelated-branch"],
		);
		expect(result).toEqual([branchId]);
	});

	it("manager: throws ForbiddenError when no assigned branch is in the business", async () => {
		const { businessId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeGuard(db).resolveBusinessBranchScope("mgr-1", businessId, [
				"unrelated-branch",
			]),
		).rejects.toBeInstanceOf(ForbiddenError);
	});
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bunx vitest run src/__tests__/core/authorization.test.ts`
Expected: FAIL — `resolveBusinessBranchScope is not a function`.

- [ ] **Step 4: Implement `resolveBusinessBranchScope`**

In `workers/api/src/core/authorization.ts`, add this method to `AuthorizationService` (place it directly above `resolveBranchScope`). Uses existing `this.businessesRepo`, `this.branchesRepo`, `assertBusinessOwner`, and the already-imported `ForbiddenError`:

```ts
	/**
	 * Resolves the branch IDs a caller may see for a business — and authorizes them.
	 * Owner (scopedBranchIds === null): asserts ownership (404 missing / 403 not owner),
	 * then returns all of the business's non-deleted branch IDs. Manager/staff (array):
	 * returns the intersection of their assigned branches with the business's branches;
	 * an empty intersection means the caller is not attached to this business → 403.
	 */
	async resolveBusinessBranchScope(
		actorId: string,
		businessId: string,
		scopedBranchIds: string[] | null,
	): Promise<string[]> {
		if (scopedBranchIds === null) {
			await this.assertBusinessOwner(actorId, businessId);
			return this.branchesRepo.findIdsByBusiness(businessId);
		}
		const businessBranchIds =
			await this.branchesRepo.findIdsByBusiness(businessId);
		const allowed = businessBranchIds.filter((id) =>
			scopedBranchIds.includes(id),
		);
		if (allowed.length === 0) {
			throw new ForbiddenError("You are not assigned to this business");
		}
		return allowed;
	}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bunx vitest run src/__tests__/core/authorization.test.ts`
Expected: PASS.

- [ ] **Step 6: Lint the touched files**

Run: `bunx biome check src/core/authorization.ts src/__tests__/core/authorization.test.ts ../../packages/core/src/database/repositories/branches.repository.ts`
Expected: no errors (info-level diagnostics on pre-existing lines are fine). On a format diff, `bunx biome format --write <file>` then re-check.

- [ ] **Step 7: Commit**

```bash
git add workers/api/src/core/authorization.ts workers/api/src/__tests__/core/authorization.test.ts packages/core/src/database/repositories/branches.repository.ts
git commit -m "feat(api): add resolveBusinessBranchScope authz primitive + branch-id lookup"
```

---

## Task 2: Analytics — branch-scoped manager access (end-to-end)

Migrates analytics atomically: re-key the repo, add `AnalyticsService`, thin the routes, wire it, update tests. One commit.

**Files:**
- Modify: `packages/core/src/database/repositories/analytics.repository.ts`
- Create: `workers/api/src/modules/analytics/analytics.service.ts`
- Modify: `workers/api/src/modules/analytics/index.ts`, `workers/api/src/types/index.ts`, `workers/api/src/modules/routes.ts`, `workers/api/src/__tests__/helpers/create-test-app.ts`
- Test: `workers/api/src/__tests__/modules/analytics/analytics.repository.earnings.integration.test.ts` (update), `…/analytics.service.test.ts` (create), `…/analytics.routes.test.ts` (rewrite)

- [ ] **Step 1: Update the earnings integration test to the new signature (failing first)**

In `workers/api/src/__tests__/modules/analytics/analytics.repository.earnings.integration.test.ts`, find each `repo.getEarnings(...)` call (currently passes a `businessId`). The test seeds branches for its business; collect their IDs into an array (e.g. `const branchIds = [branchId];` from the seeded chain) and change each call to `repo.getEarnings(branchIds, range)`. If a case asserted "empty for unknown business", change it to pass `[]` (empty branch list) instead of a bogus businessId.

Run: `bunx vitest run src/__tests__/modules/analytics/analytics.repository.earnings.integration.test.ts`
Expected: FAIL (argument/shape mismatch — signature not changed yet).

- [ ] **Step 2: Re-key the six booking-derived methods**

In `packages/core/src/database/repositories/analytics.repository.ts`, for **each** of `getOverview`, `getRevenueByDate`, `getTopServices`, `getStaffStats`, `getEarnings`, `getPeakHours`:
- Change the first parameter from `businessId: string,` to `branchIds: string[],`.
- Delete the line `const branchIds = await this.getBranchIds(businessId);` from the body.
- Leave everything else unchanged (the `if (branchIds.length === 0) return …;` guard and all `inArray(bookingsSchema.branchId, branchIds)` filters stay).

Resulting signatures:

```ts
	async getOverview(branchIds: string[], range: AnalyticsRange): Promise<AnalyticsOverview>
	async getRevenueByDate(branchIds: string[], range: AnalyticsRange): Promise<RevenuePoint[]>
	async getTopServices(branchIds: string[], range: AnalyticsRange): Promise<ServiceStat[]>
	async getStaffStats(branchIds: string[], range: AnalyticsRange): Promise<{ staff: {...}[] }>
	async getEarnings(branchIds: string[], range: AnalyticsRange): Promise<Earnings>
	async getPeakHours(branchIds: string[], range: AnalyticsRange): Promise<PeakSlot[]>
```

- [ ] **Step 3: Re-key `getCouponStats`; leave `getReviewStats`; delete `getBranchIds`**

- `getCouponStats`: change signature to `async getCouponStats(businessId: string, branchIds: string[], range: AnalyticsRange)`. Delete its `const branchIds = await this.getBranchIds(businessId);` line. Keep the redemption query (uses `branchIds`) and the coupon-definition query (`eq(couponsSchema.businessId, businessId)`).
- `getReviewStats(businessId, range)`: unchanged.
- Delete the private `getBranchIds` method. **Do not** remove the `branchesSchema` import — `getEarnings` still joins it for `byBranch`. Verify each named import (`and`, `eq`, `gte`, `inArray`, `isNull`, `sql`, and the schema imports) is still referenced before deleting any.

- [ ] **Step 4: Run the integration test to verify it passes**

Run: `bunx vitest run src/__tests__/modules/analytics/analytics.repository.earnings.integration.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing `AnalyticsService` unit test**

Create `workers/api/src/__tests__/modules/analytics/analytics.service.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "../../../core/errors";
import { AnalyticsService } from "../../../modules/analytics/analytics.service";

const repo = {
	getOverview: vi.fn(),
	getRevenueByDate: vi.fn(),
	getTopServices: vi.fn(),
	getPeakHours: vi.fn(),
	getStaffStats: vi.fn(),
	getEarnings: vi.fn(),
	getReviewStats: vi.fn(),
	getCouponStats: vi.fn(),
};
const authz = { resolveBusinessBranchScope: vi.fn() };
const range = { startDate: "2026-01-01", endDate: "2026-01-31" };

function makeService() {
	return new AnalyticsService(repo as never, authz as never);
}

beforeEach(() => vi.clearAllMocks());

describe("AnalyticsService.getOverview", () => {
	it("resolves scope then queries with the allowed branch IDs", async () => {
		authz.resolveBusinessBranchScope.mockResolvedValue(["b1", "b2"]);
		repo.getOverview.mockResolvedValue({ totalRevenue: 5 });
		const result = await makeService().getOverview("owner-1", "biz1", null, range);
		expect(authz.resolveBusinessBranchScope).toHaveBeenCalledWith(
			"owner-1",
			"biz1",
			null,
		);
		expect(repo.getOverview).toHaveBeenCalledWith(["b1", "b2"], range);
		expect(result).toEqual({ totalRevenue: 5 });
	});

	it("passes a manager's scoped branch IDs through to the resolver", async () => {
		authz.resolveBusinessBranchScope.mockResolvedValue(["b2"]);
		repo.getOverview.mockResolvedValue({ totalRevenue: 1 });
		await makeService().getOverview("mgr-1", "biz1", ["b2", "b9"], range);
		expect(authz.resolveBusinessBranchScope).toHaveBeenCalledWith(
			"mgr-1",
			"biz1",
			["b2", "b9"],
		);
		expect(repo.getOverview).toHaveBeenCalledWith(["b2"], range);
	});

	it("propagates a 403 from the resolver without querying", async () => {
		authz.resolveBusinessBranchScope.mockRejectedValue(new ForbiddenError("no"));
		await expect(
			makeService().getOverview("mgr-1", "biz1", ["b9"], range),
		).rejects.toBeInstanceOf(ForbiddenError);
		expect(repo.getOverview).not.toHaveBeenCalled();
	});
});

describe("AnalyticsService business-level dimensions", () => {
	it("getReviewStats authorizes but queries by businessId (business-wide)", async () => {
		authz.resolveBusinessBranchScope.mockResolvedValue(["b2"]);
		repo.getReviewStats.mockResolvedValue({ avgRating: 4 });
		await makeService().getReviewStats("mgr-1", "biz1", ["b2"], range);
		expect(authz.resolveBusinessBranchScope).toHaveBeenCalledWith(
			"mgr-1",
			"biz1",
			["b2"],
		);
		expect(repo.getReviewStats).toHaveBeenCalledWith("biz1", range);
	});

	it("getCouponStats passes both businessId and the allowed branch IDs", async () => {
		authz.resolveBusinessBranchScope.mockResolvedValue(["b2"]);
		repo.getCouponStats.mockResolvedValue({ coupons: [] });
		await makeService().getCouponStats("mgr-1", "biz1", ["b2"], range);
		expect(repo.getCouponStats).toHaveBeenCalledWith("biz1", ["b2"], range);
	});
});
```

Run: `bunx vitest run src/__tests__/modules/analytics/analytics.service.test.ts`
Expected: FAIL — cannot find module `analytics.service`.

- [ ] **Step 6: Create `AnalyticsService`**

Create `workers/api/src/modules/analytics/analytics.service.ts`:

```ts
import type {
	AnalyticsRange,
	AnalyticsRepository,
} from "@repo/core/src/database/repositories/analytics.repository";
import type { AuthorizationService } from "../../core/authorization";

export class AnalyticsService {
	constructor(
		private readonly repo: AnalyticsRepository,
		private readonly authz: AuthorizationService,
	) {}

	private scope(actorId: string, businessId: string, scoped: string[] | null) {
		return this.authz.resolveBusinessBranchScope(actorId, businessId, scoped);
	}

	async getOverview(
		actorId: string,
		businessId: string,
		scopedBranchIds: string[] | null,
		range: AnalyticsRange,
	) {
		return this.repo.getOverview(
			await this.scope(actorId, businessId, scopedBranchIds),
			range,
		);
	}

	async getRevenueByDate(
		actorId: string,
		businessId: string,
		scopedBranchIds: string[] | null,
		range: AnalyticsRange,
	) {
		return this.repo.getRevenueByDate(
			await this.scope(actorId, businessId, scopedBranchIds),
			range,
		);
	}

	async getTopServices(
		actorId: string,
		businessId: string,
		scopedBranchIds: string[] | null,
		range: AnalyticsRange,
	) {
		return this.repo.getTopServices(
			await this.scope(actorId, businessId, scopedBranchIds),
			range,
		);
	}

	async getPeakHours(
		actorId: string,
		businessId: string,
		scopedBranchIds: string[] | null,
		range: AnalyticsRange,
	) {
		return this.repo.getPeakHours(
			await this.scope(actorId, businessId, scopedBranchIds),
			range,
		);
	}

	async getStaffStats(
		actorId: string,
		businessId: string,
		scopedBranchIds: string[] | null,
		range: AnalyticsRange,
	) {
		return this.repo.getStaffStats(
			await this.scope(actorId, businessId, scopedBranchIds),
			range,
		);
	}

	async getEarnings(
		actorId: string,
		businessId: string,
		scopedBranchIds: string[] | null,
		range: AnalyticsRange,
	) {
		return this.repo.getEarnings(
			await this.scope(actorId, businessId, scopedBranchIds),
			range,
		);
	}

	async getReviewStats(
		actorId: string,
		businessId: string,
		scopedBranchIds: string[] | null,
		range: AnalyticsRange,
	) {
		// Business-level dimension: authorize, but query business-wide.
		await this.scope(actorId, businessId, scopedBranchIds);
		return this.repo.getReviewStats(businessId, range);
	}

	async getCouponStats(
		actorId: string,
		businessId: string,
		scopedBranchIds: string[] | null,
		range: AnalyticsRange,
	) {
		const branchIds = await this.scope(actorId, businessId, scopedBranchIds);
		return this.repo.getCouponStats(businessId, branchIds, range);
	}
}
```

Run: `bunx vitest run src/__tests__/modules/analytics/analytics.service.test.ts`
Expected: PASS.

- [ ] **Step 7: Add the `analyticsService` context var to `types/index.ts`**

In `workers/api/src/types/index.ts` add the import (with the other service imports) and the var (in `Variables`):

```ts
import type { AnalyticsService } from "../modules/analytics/analytics.service";
```
```ts
		analyticsService: AnalyticsService;
```

- [ ] **Step 8: Rewrite `analytics/index.ts` to thin handlers + installer**

Edit `workers/api/src/modules/analytics/index.ts`. **Keep every `createRoute(...)` definition, the `RangeQuery`/`*Schema` definitions, and the `getRange` helper exactly as they are.** Delete the local `assertBusinessOwner` function. Replace the import block, the guard line, the eight handler bodies, and add the installer.

Imports (top of file):

```ts
import { createRoute, z } from "@hono/zod-openapi";
import { AnalyticsRepository } from "@repo/core/src/database/repositories/analytics.repository";
import { createApp } from "../../core/create-app";
import { authenticate } from "../../middleware/auth";
import { requireAuth } from "../../middleware/auth-guard";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import { AnalyticsService } from "./analytics.service";
```

Guard + handlers + installer:

```ts
analyticsApp.use(
	"*",
	authenticate,
	requireAuth(["owner", "manager"], { branchScope: true }),
);

analyticsApp
	.openapi(overviewRoute, async (c) => {
		const { businessId, range } = c.req.valid("query");
		const data = await c.var.analyticsService.getOverview(
			c.var.user.id,
			businessId,
			c.var.scopedBranchIds,
			getRange(Number(range)),
		);
		return c.json(data, 200);
	})
	.openapi(revenueRoute, async (c) => {
		const { businessId, range } = c.req.valid("query");
		const data = await c.var.analyticsService.getRevenueByDate(
			c.var.user.id,
			businessId,
			c.var.scopedBranchIds,
			getRange(Number(range)),
		);
		return c.json(data, 200);
	})
	.openapi(servicesRoute, async (c) => {
		const { businessId, range } = c.req.valid("query");
		const data = await c.var.analyticsService.getTopServices(
			c.var.user.id,
			businessId,
			c.var.scopedBranchIds,
			getRange(Number(range)),
		);
		return c.json(data, 200);
	})
	.openapi(peakRoute, async (c) => {
		const { businessId, range } = c.req.valid("query");
		const data = await c.var.analyticsService.getPeakHours(
			c.var.user.id,
			businessId,
			c.var.scopedBranchIds,
			getRange(Number(range)),
		);
		return c.json(data, 200);
	})
	.openapi(reviewsRoute, async (c) => {
		const { businessId, range } = c.req.valid("query");
		const data = await c.var.analyticsService.getReviewStats(
			c.var.user.id,
			businessId,
			c.var.scopedBranchIds,
			getRange(Number(range)),
		);
		return c.json(data, 200);
	})
	.openapi(couponsRoute, async (c) => {
		const { businessId, range } = c.req.valid("query");
		const data = await c.var.analyticsService.getCouponStats(
			c.var.user.id,
			businessId,
			c.var.scopedBranchIds,
			getRange(Number(range)),
		);
		return c.json(data, 200);
	})
	.openapi(staffRoute, async (c) => {
		const { businessId, range } = c.req.valid("query");
		const data = await c.var.analyticsService.getStaffStats(
			c.var.user.id,
			businessId,
			c.var.scopedBranchIds,
			getRange(Number(range)),
		);
		return c.json(data, 200);
	})
	.openapi(earningsRoute, async (c) => {
		const { businessId, range } = c.req.valid("query");
		const data = await c.var.analyticsService.getEarnings(
			c.var.user.id,
			businessId,
			c.var.scopedBranchIds,
			getRange(Number(range)),
		);
		return c.json(data, 200);
	});

export const installAnalyticsService: ServiceInstaller = (c, { db, authz }) =>
	c.set(
		"analyticsService",
		new AnalyticsService(new AnalyticsRepository(db), authz),
	);
```

> The route definitions `overviewRoute`, `revenueRoute`, `servicesRoute`, `peakRoute`, `reviewsRoute`, `couponsRoute`, `staffRoute`, `earningsRoute` already exist in the file — reference them as-is. `SharedDeps` already exposes `db` and `authz`. The old imports of `getDB` and `BusinessesRepository` are now removed.

- [ ] **Step 9: Register the installer in `routes.ts`**

In `workers/api/src/modules/routes.ts`, change the analytics import to also import the installer, and add it to `serviceInstallers`:

```ts
import { analyticsApp, installAnalyticsService } from "./analytics";
```
Add `installAnalyticsService,` to the `serviceInstallers` array.

- [ ] **Step 10: Add `analyticsService` to `MockServices`**

In `workers/api/src/__tests__/helpers/create-test-app.ts` add:

```ts
import type { AnalyticsService } from "../../modules/analytics/analytics.service";
```
```ts
	analyticsService?: Partial<AnalyticsService>;
```

- [ ] **Step 11: Rewrite the analytics route test to mock the service**

Replace `workers/api/src/__tests__/modules/analytics/analytics.routes.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authHeader, createTestToken, TEST_ENV } from "../../helpers/auth";
import { createTestApp } from "../../helpers/create-test-app";

const mockAnalyticsService = {
	getOverview: vi.fn(),
	getRevenueByDate: vi.fn(),
	getTopServices: vi.fn(),
	getPeakHours: vi.fn(),
	getReviewStats: vi.fn(),
	getCouponStats: vi.fn(),
	getStaffStats: vi.fn(),
	getEarnings: vi.fn(),
};

const app = createTestApp({ analyticsService: mockAnalyticsService as never });

beforeEach(() => {
	vi.clearAllMocks();
	mockAnalyticsService.getOverview.mockResolvedValue({ totalRevenue: 0 });
	mockAnalyticsService.getEarnings.mockResolvedValue({
		total: 0,
		byStaff: [],
		byService: [],
		byBranch: [],
		overTime: [],
	});
});

describe("GET /api/v1/analytics/overview (owner/manager only)", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request(
			"/api/v1/analytics/overview?businessId=biz1&range=30",
			{},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 403 for a customer role", async () => {
		const token = await createTestToken({ role: "customer" });
		const res = await app.request(
			"/api/v1/analytics/overview?businessId=biz1&range=30",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("returns 200 for an owner and delegates to the service", async () => {
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/analytics/overview?businessId=biz1&range=30",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		expect(mockAnalyticsService.getOverview).toHaveBeenCalledTimes(1);
	});

	it("returns 200 for a manager", async () => {
		const token = await createTestToken({ role: "manager", userId: "mgr-1" });
		const res = await app.request(
			"/api/v1/analytics/overview?businessId=biz1&range=30",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
	});
});

describe("GET /api/v1/analytics/earnings", () => {
	it("returns 200 for an owner", async () => {
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/analytics/earnings?businessId=biz1&range=30",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		expect(mockAnalyticsService.getEarnings).toHaveBeenCalledTimes(1);
	});
});
```

- [ ] **Step 12: Run all analytics tests, lint, and scoped typecheck**

Run: `bunx vitest run src/__tests__/modules/analytics`
Expected: PASS (service + routes + earnings integration).
Run: `bunx biome check src/modules/analytics/analytics.service.ts src/modules/analytics/index.ts src/types/index.ts src/modules/routes.ts src/__tests__/helpers/create-test-app.ts src/__tests__/modules/analytics/analytics.service.test.ts src/__tests__/modules/analytics/analytics.routes.test.ts`
Expected: no errors (format with `bunx biome format --write` on any diff, then re-check).
Run: `bunx tsc --noEmit 2>&1 | grep -E 'analytics|types/index|routes.ts|create-test-app' || echo "touched files clean"`
Expected: `touched files clean`.

- [ ] **Step 13: Commit**

```bash
git add workers/api/src/modules/analytics workers/api/src/types/index.ts workers/api/src/modules/routes.ts workers/api/src/__tests__/helpers/create-test-app.ts workers/api/src/__tests__/modules/analytics packages/core/src/database/repositories/analytics.repository.ts
git commit -m "feat(api): AnalyticsService + branch-scoped manager access"
```

---

## Task 3: Customers — branch-scoped manager access (end-to-end)

**Files:**
- Modify: `packages/core/src/database/repositories/customers.repository.ts`
- Create: `workers/api/src/modules/customers/customers.service.ts`
- Modify: `workers/api/src/modules/customers/index.ts`, `workers/api/src/types/index.ts`, `workers/api/src/modules/routes.ts`, `workers/api/src/__tests__/helpers/create-test-app.ts`
- Test: `…/customers/customers.service.test.ts` (create), `…/customers/customers.routes.test.ts` (rewrite)

- [ ] **Step 1: Re-key `CustomersRepository`**

In `packages/core/src/database/repositories/customers.repository.ts`:
- Rename `listByBusiness(businessId: string)` → `listByBranches(branchIds: string[])`. Delete its opening `const branchIds = await this.getBranchIds(businessId);` line; keep the `if (branchIds.length === 0) return [];` guard and the rest.
- Change `getCustomerVisits(businessId: string, userId: string)` → `getCustomerVisits(branchIds: string[], userId: string)`. Delete its `const branchIds = await this.getBranchIds(businessId);` line; keep the rest.
- Delete the private `getBranchIds` method.
- Remove now-unused imports only if truly unused: after deletion, `branchesSchema` is no longer referenced → remove it from the import. `eq`/`isNull` are still used by `getCustomerVisits`; `and`, `inArray`, `sql`, `usersSchema`, `bookingsSchema` remain used. Verify before removing.

Resulting signatures:

```ts
	async listByBranches(branchIds: string[]): Promise<CustomerSummary[]>
	async getCustomerVisits(branchIds: string[], userId: string): Promise<CustomerVisit[]>
```

- [ ] **Step 2: Write the failing `CustomersService` unit test**

Create `workers/api/src/__tests__/modules/customers/customers.service.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "../../../core/errors";
import { CustomersService } from "../../../modules/customers/customers.service";

const repo = { listByBranches: vi.fn(), getCustomerVisits: vi.fn() };
const authz = { resolveBusinessBranchScope: vi.fn() };

function makeService() {
	return new CustomersService(repo as never, authz as never);
}

beforeEach(() => vi.clearAllMocks());

describe("CustomersService.list", () => {
	it("resolves scope then lists by the allowed branches", async () => {
		authz.resolveBusinessBranchScope.mockResolvedValue(["b1"]);
		repo.listByBranches.mockResolvedValue([{ userId: "u1" }]);
		const result = await makeService().list("owner-1", "biz1", null);
		expect(authz.resolveBusinessBranchScope).toHaveBeenCalledWith(
			"owner-1",
			"biz1",
			null,
		);
		expect(repo.listByBranches).toHaveBeenCalledWith(["b1"]);
		expect(result).toEqual([{ userId: "u1" }]);
	});

	it("propagates a 403 without querying", async () => {
		authz.resolveBusinessBranchScope.mockRejectedValue(new ForbiddenError("no"));
		await expect(
			makeService().list("mgr-1", "biz1", ["b9"]),
		).rejects.toBeInstanceOf(ForbiddenError);
		expect(repo.listByBranches).not.toHaveBeenCalled();
	});
});

describe("CustomersService.visits", () => {
	it("resolves scope then fetches visits for the user within allowed branches", async () => {
		authz.resolveBusinessBranchScope.mockResolvedValue(["b2"]);
		repo.getCustomerVisits.mockResolvedValue([{ id: "v1" }]);
		const result = await makeService().visits("mgr-1", "biz1", "u1", ["b2"]);
		expect(repo.getCustomerVisits).toHaveBeenCalledWith(["b2"], "u1");
		expect(result).toEqual([{ id: "v1" }]);
	});
});
```

Run: `bunx vitest run src/__tests__/modules/customers/customers.service.test.ts`
Expected: FAIL — cannot find module `customers.service`.

- [ ] **Step 3: Create `CustomersService`**

Create `workers/api/src/modules/customers/customers.service.ts`:

```ts
import type { CustomersRepository } from "@repo/core/src/database/repositories/customers.repository";
import type { AuthorizationService } from "../../core/authorization";

export class CustomersService {
	constructor(
		private readonly repo: CustomersRepository,
		private readonly authz: AuthorizationService,
	) {}

	async list(
		actorId: string,
		businessId: string,
		scopedBranchIds: string[] | null,
	) {
		const branchIds = await this.authz.resolveBusinessBranchScope(
			actorId,
			businessId,
			scopedBranchIds,
		);
		return this.repo.listByBranches(branchIds);
	}

	async visits(
		actorId: string,
		businessId: string,
		userId: string,
		scopedBranchIds: string[] | null,
	) {
		const branchIds = await this.authz.resolveBusinessBranchScope(
			actorId,
			businessId,
			scopedBranchIds,
		);
		return this.repo.getCustomerVisits(branchIds, userId);
	}
}
```

Run: `bunx vitest run src/__tests__/modules/customers/customers.service.test.ts`
Expected: PASS.

- [ ] **Step 4: Wire context var + MockServices**

- `workers/api/src/types/index.ts`: add `import type { CustomersService } from "../modules/customers/customers.service";` and `customersService: CustomersService;`.
- `workers/api/src/__tests__/helpers/create-test-app.ts`: add `import type { CustomersService } from "../../modules/customers/customers.service";` and `customersService?: Partial<CustomersService>;`.

- [ ] **Step 5: Rewrite `customers/index.ts`**

Edit `workers/api/src/modules/customers/index.ts`. Keep the Zod schemas and both `createRoute(...)` definitions (`listRoute`, `visitsRoute`) and the `CustomerSummary`/`CustomerVisit` response schemas verbatim. Delete the local `assertBusinessOwner` and the `getDB`/`CustomersRepository`/`BusinessesRepository` imports. Changed regions:

Imports:

```ts
import { createRoute, z } from "@hono/zod-openapi";
import { CustomersRepository } from "@repo/core/src/database/repositories/customers.repository";
import { createApp } from "../../core/create-app";
import { authenticate } from "../../middleware/auth";
import { requireAuth } from "../../middleware/auth-guard";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import { CustomersService } from "./customers.service";
```

Guard + handlers + installer:

```ts
export const customersApp = createApp();
customersApp.use(
	"*",
	authenticate,
	requireAuth(["owner", "manager"], { branchScope: true }),
);

customersApp
	.openapi(listRoute, async (c) => {
		const { businessId } = c.req.valid("query");
		const customers = await c.var.customersService.list(
			c.var.user.id,
			businessId,
			c.var.scopedBranchIds,
		);
		return c.json(customers, 200);
	})
	.openapi(visitsRoute, async (c) => {
		const { userId } = c.req.valid("param");
		const { businessId } = c.req.valid("query");
		const visits = await c.var.customersService.visits(
			c.var.user.id,
			businessId,
			userId,
			c.var.scopedBranchIds,
		);
		return c.json(visits, 200);
	});

export const installCustomersService: ServiceInstaller = (c, { db, authz }) =>
	c.set(
		"customersService",
		new CustomersService(new CustomersRepository(db), authz),
	);
```

- [ ] **Step 6: Register installer in `routes.ts`**

```ts
import { customersApp, installCustomersService } from "./customers";
```
Add `installCustomersService,` to `serviceInstallers`.

- [ ] **Step 7: Rewrite the customers route test**

Replace `workers/api/src/__tests__/modules/customers/customers.routes.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authHeader, createTestToken, TEST_ENV } from "../../helpers/auth";
import { createTestApp } from "../../helpers/create-test-app";

const mockCustomersService = { list: vi.fn(), visits: vi.fn() };
const app = createTestApp({ customersService: mockCustomersService as never });

beforeEach(() => {
	vi.clearAllMocks();
	mockCustomersService.list.mockResolvedValue([]);
	mockCustomersService.visits.mockResolvedValue([]);
});

describe("GET /api/v1/customers (owner/manager only)", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request(
			"/api/v1/customers?businessId=biz1",
			{},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 403 for a customer role", async () => {
		const token = await createTestToken({ role: "customer" });
		const res = await app.request(
			"/api/v1/customers?businessId=biz1",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("returns 200 for an owner and delegates to the service", async () => {
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/customers?businessId=biz1",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		expect(mockCustomersService.list).toHaveBeenCalledTimes(1);
	});

	it("returns 200 for a manager", async () => {
		const token = await createTestToken({ role: "manager", userId: "mgr-1" });
		const res = await app.request(
			"/api/v1/customers?businessId=biz1",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
	});
});
```

> If the previous version of this file tested a customer-visits route, open the current `visitsRoute` definition in `customers/index.ts`, read its exact `path` (it includes a `:userId` param and a `businessId` query), and add one `it` that requests that exact path with an owner token and asserts `mockCustomersService.visits` was called. The `visits` service method is already unit-tested in Step 2, so this route case is supplementary.

- [ ] **Step 8: Run customers tests, lint, scoped typecheck**

Run: `bunx vitest run src/__tests__/modules/customers`
Expected: PASS.
Run: `bunx biome check src/modules/customers/customers.service.ts src/modules/customers/index.ts src/__tests__/modules/customers/customers.service.test.ts src/__tests__/modules/customers/customers.routes.test.ts`
Expected: no errors.
Run: `bunx tsc --noEmit 2>&1 | grep -E 'customers' || echo "touched files clean"`
Expected: `touched files clean`.

- [ ] **Step 9: Commit**

```bash
git add workers/api/src/modules/customers workers/api/src/types/index.ts workers/api/src/modules/routes.ts workers/api/src/__tests__/helpers/create-test-app.ts workers/api/src/__tests__/modules/customers packages/core/src/database/repositories/customers.repository.ts
git commit -m "feat(api): CustomersService + branch-scoped manager access"
```

---

## Task 4: Campaigns — branch-scoped manager access incl. send (end-to-end)

Campaigns are shared business records (no schema change). Every method authorizes via `resolveBusinessBranchScope` against the campaign's `businessId`; `send` scopes recipients to the **sender's** branches via `customersRepo.listByBranches` (depends on Task 3). The campaigns repo is unchanged.

**Files:**
- Create: `workers/api/src/modules/campaigns/campaigns.service.ts`
- Modify: `workers/api/src/modules/campaigns/index.ts`, `workers/api/src/types/index.ts`, `workers/api/src/modules/routes.ts`, `workers/api/src/__tests__/helpers/create-test-app.ts`
- Test: `…/campaigns/campaigns.service.test.ts` (create), `…/campaigns/campaigns.routes.test.ts` (rewrite)

- [ ] **Step 1: Write the failing `CampaignsService` unit test**

Create `workers/api/src/__tests__/modules/campaigns/campaigns.service.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	ConflictError,
	ForbiddenError,
	NotFoundError,
} from "../../../core/errors";
import { CampaignsService } from "../../../modules/campaigns/campaigns.service";

const repo = {
	findByBusiness: vi.fn(),
	findOne: vi.fn(),
	create: vi.fn(),
	updateOne: vi.fn(),
	deleteOne: vi.fn(),
};
const customersRepo = { listByBranches: vi.fn() };
const authz = { resolveBusinessBranchScope: vi.fn() };

function makeService() {
	return new CampaignsService(
		repo as never,
		customersRepo as never,
		authz as never,
	);
}

beforeEach(() => vi.clearAllMocks());

describe("CampaignsService.list", () => {
	it("authorizes then lists the business's campaigns", async () => {
		authz.resolveBusinessBranchScope.mockResolvedValue(["b1"]);
		repo.findByBusiness.mockResolvedValue([{ id: "c1" }]);
		const result = await makeService().list("owner-1", "biz1", null);
		expect(authz.resolveBusinessBranchScope).toHaveBeenCalledWith(
			"owner-1",
			"biz1",
			null,
		);
		expect(repo.findByBusiness).toHaveBeenCalledWith("biz1");
		expect(result).toEqual([{ id: "c1" }]);
	});
});

describe("CampaignsService.create", () => {
	it("authorizes against the body businessId then creates a Draft", async () => {
		authz.resolveBusinessBranchScope.mockResolvedValue(["b1"]);
		repo.create.mockResolvedValue({ data: { id: "c1" } });
		const result = await makeService().create("mgr-1", ["b1"], {
			businessId: "biz1",
			name: "Promo",
			segment: "All",
			channels: ["Email"],
			message: "hi",
		});
		expect(authz.resolveBusinessBranchScope).toHaveBeenCalledWith(
			"mgr-1",
			"biz1",
			["b1"],
		);
		expect(repo.create).toHaveBeenCalledWith(
			expect.objectContaining({
				businessId: "biz1",
				name: "Promo",
				channels: JSON.stringify(["Email"]),
				status: "Draft",
			}),
		);
		expect(result).toEqual({ id: "c1" });
	});
});

describe("CampaignsService.send", () => {
	it("scopes recipients to the sender's branches and stamps Sent", async () => {
		repo.findOne.mockResolvedValue({
			id: "c1",
			businessId: "biz1",
			segment: "All",
			status: "Draft",
		});
		authz.resolveBusinessBranchScope.mockResolvedValue(["b2"]);
		customersRepo.listByBranches.mockResolvedValue([
			{ userId: "u1", tier: "VIP" },
			{ userId: "u2", tier: "Regular" },
		]);
		repo.updateOne.mockResolvedValue({
			data: { id: "c1", status: "Sent", recipientCount: 2 },
		});
		const result = await makeService().send("mgr-1", "c1", ["b2"]);
		expect(customersRepo.listByBranches).toHaveBeenCalledWith(["b2"]);
		expect(repo.updateOne).toHaveBeenCalledWith(
			"c1",
			expect.objectContaining({ status: "Sent", recipientCount: 2 }),
		);
		expect(result).toEqual({ id: "c1", status: "Sent", recipientCount: 2 });
	});

	it("filters recipients by a non-All segment", async () => {
		repo.findOne.mockResolvedValue({
			id: "c1",
			businessId: "biz1",
			segment: "VIP",
			status: "Draft",
		});
		authz.resolveBusinessBranchScope.mockResolvedValue(["b2"]);
		customersRepo.listByBranches.mockResolvedValue([
			{ userId: "u1", tier: "VIP" },
			{ userId: "u2", tier: "Regular" },
		]);
		repo.updateOne.mockResolvedValue({ data: { id: "c1", recipientCount: 1 } });
		await makeService().send("mgr-1", "c1", ["b2"]);
		expect(repo.updateOne).toHaveBeenCalledWith(
			"c1",
			expect.objectContaining({ recipientCount: 1 }),
		);
	});

	it("throws NotFound for a missing campaign", async () => {
		repo.findOne.mockResolvedValue(null);
		await expect(
			makeService().send("mgr-1", "ghost", ["b2"]),
		).rejects.toBeInstanceOf(NotFoundError);
	});

	it("throws Conflict when already sent", async () => {
		repo.findOne.mockResolvedValue({
			id: "c1",
			businessId: "biz1",
			segment: "All",
			status: "Sent",
		});
		authz.resolveBusinessBranchScope.mockResolvedValue(["b2"]);
		await expect(
			makeService().send("mgr-1", "c1", ["b2"]),
		).rejects.toBeInstanceOf(ConflictError);
	});

	it("propagates a 403 from the resolver", async () => {
		repo.findOne.mockResolvedValue({
			id: "c1",
			businessId: "biz1",
			segment: "All",
			status: "Draft",
		});
		authz.resolveBusinessBranchScope.mockRejectedValue(new ForbiddenError("no"));
		await expect(
			makeService().send("mgr-1", "c1", ["b9"]),
		).rejects.toBeInstanceOf(ForbiddenError);
	});
});
```

Run: `bunx vitest run src/__tests__/modules/campaigns/campaigns.service.test.ts`
Expected: FAIL — cannot find module `campaigns.service`.

- [ ] **Step 2: Create `CampaignsService`**

Create `workers/api/src/modules/campaigns/campaigns.service.ts`:

```ts
import type { CampaignsRepository } from "@repo/core/src/database/repositories/campaigns.repository";
import type { CustomersRepository } from "@repo/core/src/database/repositories/customers.repository";
import type {
	CampaignSegment,
	CampaignSelect,
} from "@repo/core/src/database/schema";
import type { AuthorizationService } from "../../core/authorization";
import { ConflictError, NotFoundError } from "../../core/errors";

type Segment = (typeof CampaignSegment)[keyof typeof CampaignSegment];

export interface CreateCampaignInput {
	businessId: string;
	name: string;
	segment: Segment;
	channels: ("Email" | "SMS" | "Push")[];
	message: string;
}

export interface UpdateCampaignInput {
	name?: string;
	segment?: Segment;
	channels?: ("Email" | "SMS" | "Push")[];
	message?: string;
}

export class CampaignsService {
	constructor(
		private readonly repo: CampaignsRepository,
		private readonly customersRepo: CustomersRepository,
		private readonly authz: AuthorizationService,
	) {}

	async list(
		actorId: string,
		businessId: string,
		scopedBranchIds: string[] | null,
	): Promise<CampaignSelect[]> {
		await this.authz.resolveBusinessBranchScope(
			actorId,
			businessId,
			scopedBranchIds,
		);
		return this.repo.findByBusiness(businessId);
	}

	async create(
		actorId: string,
		scopedBranchIds: string[] | null,
		input: CreateCampaignInput,
	): Promise<CampaignSelect> {
		await this.authz.resolveBusinessBranchScope(
			actorId,
			input.businessId,
			scopedBranchIds,
		);
		const result = await this.repo.create({
			businessId: input.businessId,
			name: input.name,
			segment: input.segment,
			channels: JSON.stringify(input.channels),
			message: input.message,
			status: "Draft",
		});
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	async update(
		actorId: string,
		campaignId: string,
		scopedBranchIds: string[] | null,
		input: UpdateCampaignInput,
	): Promise<CampaignSelect> {
		const existing = await this.repo.findOne(campaignId);
		if (!existing) throw new NotFoundError("Campaign not found");
		await this.authz.resolveBusinessBranchScope(
			actorId,
			existing.businessId,
			scopedBranchIds,
		);
		const patch: Record<string, unknown> = {};
		if (input.name !== undefined) patch.name = input.name;
		if (input.segment !== undefined) patch.segment = input.segment;
		if (input.channels !== undefined)
			patch.channels = JSON.stringify(input.channels);
		if (input.message !== undefined) patch.message = input.message;
		const result = await this.repo.updateOne(
			campaignId,
			patch as Parameters<CampaignsRepository["updateOne"]>[1],
		);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	async send(
		actorId: string,
		campaignId: string,
		scopedBranchIds: string[] | null,
	): Promise<CampaignSelect> {
		const existing = await this.repo.findOne(campaignId);
		if (!existing) throw new NotFoundError("Campaign not found");
		const branchIds = await this.authz.resolveBusinessBranchScope(
			actorId,
			existing.businessId,
			scopedBranchIds,
		);
		if (existing.status === "Sent")
			throw new ConflictError("Campaign has already been sent");

		const customers = await this.customersRepo.listByBranches(branchIds);
		const recipients =
			existing.segment === "All"
				? customers
				: customers.filter((cust) => cust.tier === existing.segment);

		const result = await this.repo.updateOne(campaignId, {
			status: "Sent",
			sentAt: new Date().toISOString(),
			recipientCount: recipients.length,
		} as Parameters<CampaignsRepository["updateOne"]>[1]);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	async delete(
		actorId: string,
		campaignId: string,
		scopedBranchIds: string[] | null,
	): Promise<void> {
		const existing = await this.repo.findOne(campaignId);
		if (!existing) throw new NotFoundError("Campaign not found");
		await this.authz.resolveBusinessBranchScope(
			actorId,
			existing.businessId,
			scopedBranchIds,
		);
		await this.repo.deleteOne(campaignId);
	}
}
```

> Confirm `CampaignSegment` is exported from `@repo/core/src/database/schema` (defined in `campaigns.schema.ts`, re-exported via `schema/index.ts`). If that import path errors, import from `@repo/core/src/database/schema/campaigns.schema` instead.

Run: `bunx vitest run src/__tests__/modules/campaigns/campaigns.service.test.ts`
Expected: PASS.

- [ ] **Step 3: Wire context var + MockServices**

- `workers/api/src/types/index.ts`: add `import type { CampaignsService } from "../modules/campaigns/campaigns.service";` and `campaignsService: CampaignsService;`.
- `workers/api/src/__tests__/helpers/create-test-app.ts`: add `import type { CampaignsService } from "../../modules/campaigns/campaigns.service";` and `campaignsService?: Partial<CampaignsService>;`.

- [ ] **Step 4: Rewrite `campaigns/index.ts`**

Edit `workers/api/src/modules/campaigns/index.ts`. Keep all Zod schemas (`CampaignSchema`, `CreateCampaignBody`, `UpdateCampaignBody`, `BusinessIdQuery`, `IdParam`, `ErrorSchema`) and every `createRoute(...)` (`listRoute`, `createRoute_`, `updateRoute`, `sendRoute`, `deleteRoute`) verbatim. Delete the local `assertBusinessOwner` and the `getDB`/`BusinessesRepository`/`CampaignsRepository`/`CustomersRepository` imports. Changed regions:

Imports:

```ts
import { createRoute, z } from "@hono/zod-openapi";
import { CampaignsRepository } from "@repo/core/src/database/repositories/campaigns.repository";
import { CustomersRepository } from "@repo/core/src/database/repositories/customers.repository";
import { createApp } from "../../core/create-app";
import { authenticate } from "../../middleware/auth";
import { requireAuth } from "../../middleware/auth-guard";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import { CampaignsService } from "./campaigns.service";
```

Guard + handlers + installer:

```ts
export const campaignsApp = createApp();
campaignsApp.use(
	"*",
	authenticate,
	requireAuth(["owner", "manager"], { branchScope: true }),
);

campaignsApp
	.openapi(listRoute, async (c) => {
		const { businessId } = c.req.valid("query");
		const campaigns = await c.var.campaignsService.list(
			c.var.user.id,
			businessId,
			c.var.scopedBranchIds,
		);
		return c.json(campaigns, 200);
	})
	.openapi(createRoute_, async (c) => {
		const body = c.req.valid("json");
		const campaign = await c.var.campaignsService.create(
			c.var.user.id,
			c.var.scopedBranchIds,
			body,
		);
		return c.json(campaign, 201);
	})
	.openapi(updateRoute, async (c) => {
		const { id } = c.req.valid("param");
		const body = c.req.valid("json");
		const campaign = await c.var.campaignsService.update(
			c.var.user.id,
			id,
			c.var.scopedBranchIds,
			body,
		);
		return c.json(campaign, 200);
	})
	.openapi(sendRoute, async (c) => {
		const { id } = c.req.valid("param");
		const campaign = await c.var.campaignsService.send(
			c.var.user.id,
			id,
			c.var.scopedBranchIds,
		);
		return c.json(campaign, 200);
	})
	.openapi(deleteRoute, async (c) => {
		const { id } = c.req.valid("param");
		await c.var.campaignsService.delete(
			c.var.user.id,
			id,
			c.var.scopedBranchIds,
		);
		return c.body(null, 204);
	});

export const installCampaignsService: ServiceInstaller = (c, { db, authz }) =>
	c.set(
		"campaignsService",
		new CampaignsService(
			new CampaignsRepository(db),
			new CustomersRepository(db),
			authz,
		),
	);
```

> `sendRoute` still declares `query: BusinessIdQuery` — leave the route definition unchanged. The handler ignores the query `businessId` and authorizes against the campaign's own `businessId` (looked up in the service), which is stricter and correct.

- [ ] **Step 5: Register installer in `routes.ts`**

```ts
import { campaignsApp, installCampaignsService } from "./campaigns";
```
Add `installCampaignsService,` to `serviceInstallers`.

- [ ] **Step 6: Rewrite the campaigns route test**

Replace `workers/api/src/__tests__/modules/campaigns/campaigns.routes.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authHeader, createTestToken, TEST_ENV } from "../../helpers/auth";
import { createTestApp } from "../../helpers/create-test-app";

const mockCampaignsService = {
	list: vi.fn(),
	create: vi.fn(),
	update: vi.fn(),
	send: vi.fn(),
	delete: vi.fn(),
};
const app = createTestApp({ campaignsService: mockCampaignsService as never });

beforeEach(() => {
	vi.clearAllMocks();
	mockCampaignsService.list.mockResolvedValue([]);
	mockCampaignsService.create.mockResolvedValue({ id: "c1", status: "Draft" });
	mockCampaignsService.send.mockResolvedValue({ id: "c1", status: "Sent" });
});

describe("Campaigns routes (owner/manager only)", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request(
			"/api/v1/campaigns?businessId=biz1",
			{},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 403 for a customer role", async () => {
		const token = await createTestToken({ role: "customer" });
		const res = await app.request(
			"/api/v1/campaigns?businessId=biz1",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("lists for an owner", async () => {
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/campaigns?businessId=biz1",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		expect(mockCampaignsService.list).toHaveBeenCalledTimes(1);
	});

	it("creates for a manager", async () => {
		const token = await createTestToken({ role: "manager", userId: "mgr-1" });
		const res = await app.request(
			"/api/v1/campaigns",
			{
				method: "POST",
				headers: { ...authHeader(token), "Content-Type": "application/json" },
				body: JSON.stringify({ businessId: "biz1", name: "Promo" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(201);
		expect(mockCampaignsService.create).toHaveBeenCalledTimes(1);
	});

	it("sends for a manager (scopedBranchIds null via stub authz)", async () => {
		const token = await createTestToken({ role: "manager", userId: "mgr-1" });
		const res = await app.request(
			"/api/v1/campaigns/c1/send?businessId=biz1",
			{ method: "POST", headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		expect(mockCampaignsService.send).toHaveBeenCalledWith("mgr-1", "c1", null);
	});
});
```

> The route test runs through the real `requireAuth(..., { branchScope: true })` guard, whose `resolveBranchScope` comes from `createTestApp`'s stub authz → returns `null`; that is why `send` is asserted with `null` as the third arg. The service is mocked, so no real branch resolution happens here.

- [ ] **Step 7: Run campaigns tests, lint, scoped typecheck**

Run: `bunx vitest run src/__tests__/modules/campaigns`
Expected: PASS.
Run: `bunx biome check src/modules/campaigns/campaigns.service.ts src/modules/campaigns/index.ts src/__tests__/modules/campaigns/campaigns.service.test.ts src/__tests__/modules/campaigns/campaigns.routes.test.ts`
Expected: no errors.
Run: `bunx tsc --noEmit 2>&1 | grep -E 'campaigns' || echo "touched files clean"`
Expected: `touched files clean`.

- [ ] **Step 8: Commit**

```bash
git add workers/api/src/modules/campaigns workers/api/src/types/index.ts workers/api/src/modules/routes.ts workers/api/src/__tests__/helpers/create-test-app.ts workers/api/src/__tests__/modules/campaigns
git commit -m "feat(api): CampaignsService + branch-scoped manager send"
```

---

## Task 5: Full verification + docs

**Files:**
- Modify: `workers/api/CLAUDE.md`, `packages/core/CLAUDE.md`

- [ ] **Step 1: Full API test suite**

Run: `bunx vitest run`
Expected: all files PASS. If any analytics/customers/campaigns test still references `new XRepository`/`vi.mock(...repository)`, it was missed — fix it.

- [ ] **Step 2: Scoped typecheck across all touched files**

Run:
```bash
bunx tsc --noEmit 2>&1 | grep -E 'analytics|customers/customers|campaigns|authorization|branches.repository|types/index|routes.ts|create-test-app' || echo "touched files clean"
```
Expected: `touched files clean`. (Global `tsc` still shows pre-existing drizzle-duplicate errors in untouched files — ignore.)

- [ ] **Step 3: Confirm no leftover route-layer ownership duplication**

Run: `grep -rn "function assertBusinessOwner\|Repository(getDB())" src/modules/analytics src/modules/customers src/modules/campaigns || echo "clean"`
Expected: `clean`.

- [ ] **Step 4: Update `workers/api/CLAUDE.md`**

- **Authorization section:** add to the `AuthorizationService` bullet list: ``- `resolveBusinessBranchScope(actorId, businessId, scopedBranchIds)` — authorizes a caller against a business and returns the branch IDs they may see (owner → all branches; manager → intersection of assigned branches with the business; empty → 403). Used by the analytics/customers/campaigns services for branch-scoped manager access.`` Append `AnalyticsService`, `CustomersService`, `CampaignsService` to the "Currently used by" list.
- **Analytics section:** add: "Owner/manager, branch-scoped — managers see only their assigned branches' data. Review stats and the coupon-definition list are business-level (not branch-attributable) and are shown business-wide to an authorized manager."
- **Customers + Campaigns:** add (create a short Campaigns subsection if none exists): "Owner/manager, branch-scoped (`requireAuth(["owner","manager"], { branchScope: true })`); customers and campaign recipients are scoped to the caller's branches. Campaigns are shared business records (no creator/branch tag): any actor authorized for the business may view/create/edit/send/delete any of its campaigns, and `send` computes recipients from the **sender's** branch scope (`recipientCount` reflects whoever sent; send is one-shot)."

- [ ] **Step 5: Update `packages/core/CLAUDE.md`**

Add a note in the repositories description: "`BranchesRepository.findIdsByBusiness(businessId)` returns non-deleted branch IDs (single source for branch resolution). `AnalyticsRepository` aggregate methods take a pre-resolved `branchIds: string[]` (the API service resolves them via `AuthorizationService.resolveBusinessBranchScope`); `getReviewStats` keeps `businessId` and `getCouponStats` takes both. `CustomersRepository.listByBranches`/`getCustomerVisits` take `branchIds`."

- [ ] **Step 6: Commit + final sweep**

```bash
git add workers/api/CLAUDE.md packages/core/CLAUDE.md
git commit -m "docs: branch-scoped manager access for analytics/customers/campaigns"
```
Run: `bunx vitest run` → all green.

---

## Notes for the implementer

- **Empty branch set:** an owner whose business has zero branches gets `[]` from `resolveBusinessBranchScope`; the repo methods already early-return empty results for `branchIds.length === 0`. A manager with no overlap gets 403 before any repo call.
- **Segment filtering** in campaign `send` matches the current route behaviour (`tier === segment`, `All` = everyone); `CustomerSummary.tier` is the field to compare against `campaign.segment`.
- **Do not** add a `createdBy` column or any migration — campaigns stay shared (spec decision).
- On any Biome formatting diff for a file you wrote, run `bunx biome format --write <file>` (never `biome check --unsafe`) and re-check.
- Each module task (2, 3, 4) is one commit that leaves the app fully type-checking and tests green — do not commit a module half-migrated.
