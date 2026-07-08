# API Backbone Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the API backbone follow-up from [2026-06-15-api-backbone-completion-design.md](../specs/2026-06-15-api-backbone-completion-design.md) — honest owner-only gates, route auth via `AuthorizationService`, service extraction for route-fat modules, and unified validation error messages.

**Architecture:** Three mergeable phases. Phase 1 fixes security/documentation drift without moving business logic. Phase 2 extracts services for analytics, campaigns, customers, staff-availability, and extends `BookingsService`. Phase 3 adds thin services for favourites/demo-requests/search and aligns `parseQuery`/`parseBody` with `createApp()` `defaultHook`. Every task starts with a failing test where behaviour changes, ends with a commit, and keeps the ~300-test green baseline.

**Tech Stack:** TypeScript, Hono / `@hono/zod-openapi`, Drizzle ORM, Vitest (node pool), bun workspace.

**Spec:** [docs/superpowers/specs/2026-06-15-api-backbone-completion-design.md](../specs/2026-06-15-api-backbone-completion-design.md)

---

## Pre-flight: verify baseline

```bash
cd /path/to/monorepo
bun run --filter @repo/api test 2>&1 | tail -5
# Expected: all test files pass (~300 tests)
```

---

## File map

| Phase | Action | Path |
|-------|--------|------|
| 1 | Modify | `workers/api/src/core/authorization.ts` |
| 1 | Modify | `workers/api/src/__tests__/core/authorization.test.ts` |
| 1 | Modify | `workers/api/src/modules/analytics/index.ts` |
| 1 | Modify | `workers/api/src/modules/campaigns/index.ts` |
| 1 | Modify | `workers/api/src/modules/customers/index.ts` |
| 1 | Modify | `workers/api/src/modules/khata/index.ts` |
| 1 | Modify | `workers/api/src/modules/payments/index.ts` |
| 1 | Modify | `workers/api/src/modules/bookings/index.ts` |
| 1 | Modify | `workers/api/src/modules/staff-availability/index.ts` |
| 1 | Modify | `workers/api/src/__tests__/modules/analytics/analytics.routes.test.ts` |
| 1 | Modify | `workers/api/CLAUDE.md`, `docs/guides/api-endpoints.md` |
| 2 | Create | `workers/api/src/modules/analytics/analytics.service.ts` |
| 2 | Create | `workers/api/src/modules/customers/customers.service.ts` |
| 2 | Create | `workers/api/src/modules/campaigns/campaigns.service.ts` |
| 2 | Create | `workers/api/src/modules/staff-availability/staff-availability.service.ts` |
| 2 | Modify | `workers/api/src/modules/bookings/bookings.service.ts` |
| 2 | Modify | five module `index.ts` route files + `routes.ts` + `types/index.ts` |
| 2 | Create/Modify | service + route tests per module |
| 3 | Create | `favourites/favourites.service.ts`, `demo-requests/demo-requests.service.ts`, `search/search.service.ts` |
| 3 | Modify | `workers/api/src/core/http/validation.ts`, `create-app.ts` |
| 3 | Create | `workers/api/src/__tests__/core/validation.test.ts` |
| 3 | Modify | docs (final pass) |

---

# Phase 1 — Auth honesty & drift removal

> Merge as PR 1. Routes remain fat; only gates, authz, and error throws change.

---

### Task 1: `assertTeamMemberAccess` on `AuthorizationService`

**Files:**
- Modify: `workers/api/src/core/authorization.ts`
- Test: `workers/api/src/__tests__/core/authorization.test.ts`

- [ ] **Step 1: Write failing tests**

Add after the `assertTeamMemberOwner` describe block in `authorization.test.ts`:

```ts
describe("AuthorizationService.assertTeamMemberAccess", () => {
	let db: ReturnType<typeof createTestDb>;
	beforeEach(() => {
		db = createTestDb();
	});

	it("allows the owner (scopedBranchIds null) who owns the business", async () => {
		const { businessId, branchId } = await seedChain(db, { ownerId: "owner-1" });
		await db.insert(teamMembersSchema).values({
			id: "tm-1",
			businessId,
			branchId,
			userId: "staff-1",
			role: "staff",
			title: "Stylist",
			createdAt: "2026-01-01T00:00:00.000Z",
		} as never);
		const member = await makeGuard(db).assertTeamMemberAccess(
			"owner-1",
			"tm-1",
			null,
		);
		expect(member.id).toBe("tm-1");
	});

	it("throws 403 for an owner who does not own the business", async () => {
		const { businessId, branchId } = await seedChain(db, { ownerId: "owner-1" });
		await db.insert(teamMembersSchema).values({
			id: "tm-1",
			businessId,
			branchId,
			userId: "staff-1",
			role: "staff",
			title: "Stylist",
			createdAt: "2026-01-01T00:00:00.000Z",
		} as never);
		await expect(
			makeGuard(db).assertTeamMemberAccess("owner-2", "tm-1", null),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("allows a manager assigned to the member's branch", async () => {
		const { businessId, branchId } = await seedChain(db, { ownerId: "owner-1" });
		await db.insert(teamMembersSchema).values({
			id: "tm-1",
			businessId,
			branchId,
			userId: "staff-1",
			role: "staff",
			title: "Stylist",
			createdAt: "2026-01-01T00:00:00.000Z",
		} as never);
		const member = await makeGuard(db).assertTeamMemberAccess(
			"manager-1",
			"tm-1",
			[branchId],
		);
		expect(member.id).toBe("tm-1");
	});

	it("throws 403 for a manager not assigned to the member's branch", async () => {
		const { businessId, branchId } = await seedChain(db, { ownerId: "owner-1" });
		await db.insert(teamMembersSchema).values({
			id: "tm-1",
			businessId,
			branchId,
			userId: "staff-1",
			role: "staff",
			title: "Stylist",
			createdAt: "2026-01-01T00:00:00.000Z",
		} as never);
		await expect(
			makeGuard(db).assertTeamMemberAccess("manager-1", "tm-1", ["other-branch"]),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("throws 404 when the team member does not exist", async () => {
		await expect(
			makeGuard(db).assertTeamMemberAccess("owner-1", "missing", null),
		).rejects.toBeInstanceOf(NotFoundError);
	});
});
```

Add `teamMembersSchema` import from `@repo/core/src/database/schema`.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd workers/api && bun run test src/__tests__/core/authorization.test.ts -t "assertTeamMemberAccess"
```

Expected: FAIL — `assertTeamMemberAccess is not a function`

- [ ] **Step 3: Implement `assertTeamMemberAccess`**

In `authorization.ts`, after `assertTeamMemberOwner`:

```ts
/** Branch-scoped access to a team member. Returns the member. */
async assertTeamMemberAccess(
	actorId: string,
	memberId: string,
	scopedBranchIds: string[] | null,
): Promise<TeamMemberSelect> {
	const member = await this.teamRepo.findOne(memberId);
	if (!member.data) throw new NotFoundError("Team member not found");
	if (scopedBranchIds === null) {
		await this.assertBusinessOwner(actorId, member.data.businessId);
	} else if (
		!member.data.branchId ||
		!scopedBranchIds.includes(member.data.branchId)
	) {
		throw new ForbiddenError("Not authorized to access this staff member");
	}
	return member.data as TeamMemberSelect;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd workers/api && bun run test src/__tests__/core/authorization.test.ts -t "assertTeamMemberAccess"
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add workers/api/src/core/authorization.ts workers/api/src/__tests__/core/authorization.test.ts
git commit -m "feat(api): add assertTeamMemberAccess to AuthorizationService"
```

---

### Task 2: Honest owner-only gates + `c.var.authz` in analytics, campaigns, customers

**Files:**
- Modify: `workers/api/src/modules/analytics/index.ts`
- Modify: `workers/api/src/modules/campaigns/index.ts`
- Modify: `workers/api/src/modules/customers/index.ts`
- Test: `workers/api/src/__tests__/modules/analytics/analytics.routes.test.ts`

- [ ] **Step 1: Write failing manager-gate test**

In `analytics.routes.test.ts`, add:

```ts
it("returns 403 for manager role (owner-only gate)", async () => {
	const token = await createTestToken({ role: "manager", userId: "mgr-1" });
	const res = await app.request(
		"/api/v1/analytics/overview?businessId=business-1&range=30",
		{ headers: authHeader(token) },
		TEST_ENV,
	);
	expect(res.status).toBe(403);
});
```

Update the describe title from `(owner/manager only)` to `(owner only)`.

- [ ] **Step 2: Run test — expect FAIL** (manager may currently pass middleware)

```bash
cd workers/api && bun run test src/__tests__/modules/analytics/analytics.routes.test.ts -t "manager role"
```

- [ ] **Step 3: Apply changes to all three modules**

For **each** of `analytics/index.ts`, `campaigns/index.ts`, `customers/index.ts`:

1. Change `requireAuth(["owner", "manager"])` → `requireAuth(["owner"])`
2. Delete the local `assertBusinessOwner` function and imports: `getDB`, `BusinessesRepository`, `ForbiddenError`, `NotFoundError` (keep `NotFoundError` in campaigns if still used by route handlers until Phase 2)
3. Replace every `await assertBusinessOwner(c.var.user.id, businessId)` with:

```ts
await c.var.authz.assertBusinessOwner(c.var.user.id, businessId);
```

**analytics** — eight handler call sites (overview, revenue, services, peak, reviews, coupons, staff, earnings).

**campaigns** — five call sites (list, create, update, send, delete).

**customers** — two call sites (list, visits).

- [ ] **Step 4: Run tests**

```bash
cd workers/api && bun run test src/__tests__/modules/analytics/analytics.routes.test.ts src/__tests__/modules/campaigns/campaigns.routes.test.ts
```

Expected: PASS (add manager 403 test to campaigns if it has route tests; skip customers routes test if none exists yet — Phase 2 adds it)

- [ ] **Step 5: Commit**

```bash
git add workers/api/src/modules/analytics/index.ts workers/api/src/modules/campaigns/index.ts workers/api/src/modules/customers/index.ts workers/api/src/__tests__/modules/analytics/analytics.routes.test.ts
git commit -m "refactor(api): owner-only gates and authz on analytics/campaigns/customers"
```

---

### Task 3: Owner-only gates on khata and payments

**Files:**
- Modify: `workers/api/src/modules/khata/index.ts`
- Modify: `workers/api/src/modules/payments/index.ts`

- [ ] **Step 1: Change requireAuth**

In both files, change:

```ts
khataApp.use("*", authenticate, requireAuth(["owner", "manager"]));
```

to:

```ts
khataApp.use("*", authenticate, requireAuth(["owner"]));
```

(same for `paymentsApp`)

Services already call `assertBusinessOwner` — no service changes.

- [ ] **Step 2: Run full api tests**

```bash
cd workers/api && bun run test 2>&1 | tail -5
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add workers/api/src/modules/khata/index.ts workers/api/src/modules/payments/index.ts
git commit -m "refactor(api): owner-only gates on khata and payments routes"
```

---

### Task 4: Bookings inline auth → throws

**Files:**
- Modify: `workers/api/src/modules/bookings/index.ts`
- Test: `workers/api/src/__tests__/modules/bookings/bookings.routes.test.ts` (extend)

- [ ] **Step 1: Add imports at top of bookings/index.ts**

```ts
import { ForbiddenError, ValidationError } from "../../core/errors";
```

Remove any now-unused inline-json-only patterns after refactor.

- [ ] **Step 2: Refactor `exportRoute` handler**

Replace the `business.ownerId !== c.var.user.id` block with:

```ts
if (scopedIds === null) {
	await c.var.authz.assertBusinessOwner(c.var.user.id, businessId);
}
```

Delete the `businessesService.get` call used only for ownership (keep if still needed elsewhere in handler — it is not after this change).

- [ ] **Step 3: Refactor `listByBranchRoute`**

Replace missing-params inline JSON:

```ts
if (!branchId && !businessId) {
	throw new ValidationError("branchId or businessId required");
}
```

Replace owner-check inline JSON:

```ts
if (scopedIds === null) {
	await c.var.authz.assertBusinessOwner(c.var.user.id, businessId);
}
```

- [ ] **Step 4: Refactor `calendarRoute`**

Replace manager-scope inline JSON:

```ts
if (
	c.var.scopedBranchIds !== null &&
	!c.var.scopedBranchIds.includes(branchId)
) {
	throw new ForbiddenError("Not assigned to this branch");
}
if (c.var.scopedBranchIds === null) {
	await c.var.authz.assertBranchAccess(c.var.user.id, branchId, null);
}
```

Remove `branchesService.get` + `businessesService.get` ownership chain.

- [ ] **Step 5: Run bookings tests**

```bash
cd workers/api && bun run test src/__tests__/modules/bookings/
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add workers/api/src/modules/bookings/index.ts
git commit -m "refactor(api): bookings routes throw AppError instead of inline JSON"
```

---

### Task 5: Staff-availability uses `assertTeamMemberAccess` + throws

**Files:**
- Modify: `workers/api/src/modules/staff-availability/index.ts`
- Modify: `workers/api/src/__tests__/modules/staff-availability/staff-availability.routes.test.ts`

- [ ] **Step 1: Replace `assertMemberAccess` helper**

Delete the entire `assertMemberAccess` function (lines ~83–139).

Update both handlers:

```ts
.openapi(getRoute, async (c) => {
	const { id } = c.req.valid("param");
	await c.var.authz.assertTeamMemberAccess(
		c.var.user.id,
		id,
		c.var.scopedBranchIds,
	);
	const repo = new StaffAvailabilityRepository(getDB());
	const slots = await repo.findByMember(id);
	return c.json(slots, 200);
})
```

Same pattern for `upsertRoute` — auth check first, then repo work.

Remove `mockBusinessesService` dependency from route tests if ownership no longer goes through `businessesService.get`. Update `create-test-app` stub `authz` in staff-availability tests to include `assertTeamMemberAccess: vi.fn().mockResolvedValue({ id: "member-1" })` OR use real authz via seed in integration style.

**Recommended for route test:** extend `createTestApp` middleware stub:

```ts
c.set("authz", {
	resolveBranchScope: async (_user: AuthUser) => null,
	assertTeamMemberAccess: async () => ({ id: "member-1", businessId: "business-1", branchId: null }),
} as AuthorizationService);
```

Only in staff-availability route test file — override via a local wrapper or pass full mock authz in `MockServices` (add optional `authz?: Partial<AuthorizationService>` to `MockServices` and `createTestApp`).

- [ ] **Step 2: Run staff-availability tests**

```bash
cd workers/api && bun run test src/__tests__/modules/staff-availability/
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add workers/api/src/modules/staff-availability/index.ts workers/api/src/__tests__/helpers/create-test-app.ts workers/api/src/__tests__/modules/staff-availability/staff-availability.routes.test.ts
git commit -m "refactor(api): staff-availability uses assertTeamMemberAccess"
```

---

### Task 6: Phase 1 docs + verification

**Files:**
- Modify: `workers/api/CLAUDE.md`
- Modify: `docs/guides/api-endpoints.md`

- [ ] **Step 1: Document owner-only routes in CLAUDE.md**

Under the Authorization section, add:

```markdown
### Owner-only routes (no manager access)

These modules gate with `requireAuth(["owner"])` only — managers are rejected at middleware:

- `/api/v1/analytics/*`
- `/api/v1/campaigns/*`
- `/api/v1/customers/*`
- `/api/v1/khata/*`
- `/api/v1/payments/*`

Business-level financial and CRM data stays owner-only by design.
```

Add rule: **Route handlers must not return `c.json({ ok: false, … })` for domain errors — throw `AppError` subclasses.**

- [ ] **Step 2: Update api-endpoints.md role notes** for the five modules above (change "owner/manager" → "owner").

- [ ] **Step 3: Full verification**

```bash
bun run --filter @repo/api test
bun run lint
```

- [ ] **Step 4: Commit**

```bash
git add workers/api/CLAUDE.md docs/guides/api-endpoints.md
git commit -m "docs(api): owner-only route gates and error-throw rule"
```

**Phase 1 PR ready.**

---

# Phase 2 — Service extraction

> Merge as PR 2 after Phase 1 lands. Depends on `assertTeamMemberAccess` from Phase 1.

---

### Task 7: `AnalyticsService`

**Files:**
- Create: `workers/api/src/modules/analytics/analytics.service.ts`
- Create: `workers/api/src/__tests__/modules/analytics/analytics.service.test.ts`
- Modify: `workers/api/src/modules/analytics/index.ts`
- Modify: `workers/api/src/modules/routes.ts`
- Modify: `workers/api/src/types/index.ts`

- [ ] **Step 1: Write failing service test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsService } from "../../../modules/analytics/analytics.service";

const mockRepo = {
	getOverview: vi.fn().mockResolvedValue({ totalRevenue: 1 }),
	getRevenueByDate: vi.fn(),
	getTopServices: vi.fn(),
	getPeakHours: vi.fn(),
	getReviewStats: vi.fn(),
	getCouponStats: vi.fn(),
	getStaffStats: vi.fn(),
	getEarnings: vi.fn(),
};
const mockAuthz = { assertBusinessOwner: vi.fn().mockResolvedValue({ id: "b1" }) };

describe("AnalyticsService.overview", () => {
	it("asserts business ownership then calls repo", async () => {
		const svc = new AnalyticsService(mockRepo as never, mockAuthz as never);
		await svc.overview("owner-1", "b1", 30);
		expect(mockAuthz.assertBusinessOwner).toHaveBeenCalledWith("owner-1", "b1");
		expect(mockRepo.getOverview).toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Implement `AnalyticsService`**

```ts
import type { AnalyticsRepository } from "@repo/core/src/database/repositories/analytics.repository";
import type { AuthorizationService } from "../../core/authorization";

export class AnalyticsService {
	constructor(
		private readonly repo: AnalyticsRepository,
		private readonly authz: AuthorizationService,
	) {}

	private getRange(days: number) {
		const end = new Date();
		const start = new Date(end.getTime() - days * 86400000);
		return {
			startDate: start.toISOString().slice(0, 10),
			endDate: end.toISOString().slice(0, 10),
		};
	}

	private async guarded<T>(
		actorId: string,
		businessId: string,
		days: number,
		fn: (range: { startDate: string; endDate: string }) => Promise<T>,
	) {
		await this.authz.assertBusinessOwner(actorId, businessId);
		return fn(this.getRange(days));
	}

	overview(actorId: string, businessId: string, days: number) {
		return this.guarded(actorId, businessId, days, (r) =>
			this.repo.getOverview(businessId, r),
		);
	}

	revenue(actorId: string, businessId: string, days: number) {
		return this.guarded(actorId, businessId, days, (r) =>
			this.repo.getRevenueByDate(businessId, r),
		);
	}

	topServices(actorId: string, businessId: string, days: number) {
		return this.guarded(actorId, businessId, days, (r) =>
			this.repo.getTopServices(businessId, r),
		);
	}

	peakHours(actorId: string, businessId: string, days: number) {
		return this.guarded(actorId, businessId, days, (r) =>
			this.repo.getPeakHours(businessId, r),
		);
	}

	reviewStats(actorId: string, businessId: string, days: number) {
		return this.guarded(actorId, businessId, days, (r) =>
			this.repo.getReviewStats(businessId, r),
		);
	}

	couponStats(actorId: string, businessId: string, days: number) {
		return this.guarded(actorId, businessId, days, (r) =>
			this.repo.getCouponStats(businessId, r),
		);
	}

	staffStats(actorId: string, businessId: string, days: number) {
		return this.guarded(actorId, businessId, days, (r) =>
			this.repo.getStaffStats(businessId, r),
		);
	}

	earnings(actorId: string, businessId: string, days: number) {
		return this.guarded(actorId, businessId, days, (r) =>
			this.repo.getEarnings(businessId, r),
		);
	}
}
```

- [ ] **Step 3: Wire installer in `analytics/index.ts`**

```ts
import { AnalyticsRepository } from "@repo/core/src/database/repositories/analytics.repository";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import { AnalyticsService } from "./analytics.service";

export const installAnalyticsService: ServiceInstaller = (c, { db, authz }) =>
	c.set(
		"analyticsService",
		new AnalyticsService(new AnalyticsRepository(db), authz),
	);
```

Thin each handler:

```ts
const data = await c.var.analyticsService.overview(
	c.var.user.id,
	businessId,
	Number(range),
);
return c.json(data, 200);
```

Delete `getRange`, `getDB`, `AnalyticsRepository` from route file.

- [ ] **Step 4: Register in `routes.ts` + `types/index.ts`**

Add `installAnalyticsService` to `serviceInstallers` array and `analyticsService: AnalyticsService` to Variables.

- [ ] **Step 5: Update `analytics.routes.test.ts`** — mock `AnalyticsRepository` vi.mock can be removed; instead pass `analyticsService: { overview: vi.fn().mockResolvedValue({...}) }` in `createTestApp({ analyticsService: ... })`. Extend `MockServices` interface.

- [ ] **Step 6: Run tests + commit**

```bash
cd workers/api && bun run test src/__tests__/modules/analytics/
git add workers/api/src/modules/analytics/ workers/api/src/modules/routes.ts workers/api/src/types/index.ts workers/api/src/__tests__/
git commit -m "refactor(api): extract AnalyticsService"
```

---

### Task 8: `CustomersService`

**Files:**
- Create: `workers/api/src/modules/customers/customers.service.ts`
- Create: `workers/api/src/__tests__/modules/customers/customers.service.test.ts`
- Create: `workers/api/src/__tests__/modules/customers/customers.routes.test.ts`
- Modify: `workers/api/src/modules/customers/index.ts`, `routes.ts`, `types/index.ts`

- [ ] **Step 1: Service test** (same authz-delegation pattern as Task 7)

- [ ] **Step 2: Implement service**

```ts
import type { CustomersRepository } from "@repo/core/src/database/repositories/customers.repository";
import type { AuthorizationService } from "../../core/authorization";

export class CustomersService {
	constructor(
		private readonly repo: CustomersRepository,
		private readonly authz: AuthorizationService,
	) {}

	async list(actorId: string, businessId: string) {
		await this.authz.assertBusinessOwner(actorId, businessId);
		return this.repo.listByBusiness(businessId);
	}

	async visits(actorId: string, businessId: string, userId: string) {
		await this.authz.assertBusinessOwner(actorId, businessId);
		return this.repo.getCustomerVisits(businessId, userId);
	}
}
```

- [ ] **Step 3: Wire + thin routes + route test** (owner 200, manager 403, customer 403)

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(api): extract CustomersService"
```

---

### Task 9: `CampaignsService`

**Files:**
- Create: `workers/api/src/modules/campaigns/campaigns.service.ts`
- Create: `workers/api/src/__tests__/modules/campaigns/campaigns.service.test.ts`
- Modify: `workers/api/src/modules/campaigns/index.ts`, `routes.ts`, `types/index.ts`

- [ ] **Step 1: Service test for `send` recipient count**

```ts
it("send marks campaign Sent with recipient count for segment", async () => {
	mockRepo.findOne.mockResolvedValue({
		id: "c1",
		businessId: "b1",
		segment: "VIP",
		status: "Draft",
	});
	mockCustomers.listByBusiness.mockResolvedValue([
		{ tier: "VIP" },
		{ tier: "Regular" },
	]);
	mockRepo.updateOne.mockResolvedValue({ data: { id: "c1", status: "Sent", recipientCount: 1 } });
	const result = await svc.send("owner-1", "c1", "b1");
	expect(result.recipientCount).toBe(1);
});
```

- [ ] **Step 2: Implement `CampaignsService`** — move create/update/send/delete logic from `campaigns/index.ts`; use `ConflictError`, `ForbiddenError`, `NotFoundError` from service.

- [ ] **Step 3: Wire + thin routes + update `campaigns.routes.test.ts`**

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(api): extract CampaignsService"
```

---

### Task 10: `StaffAvailabilityService`

**Files:**
- Create: `workers/api/src/modules/staff-availability/staff-availability.service.ts`
- Create: `workers/api/src/__tests__/modules/staff-availability/staff-availability.service.test.ts`
- Modify: `staff-availability/index.ts`, `routes.ts`, `types/index.ts`

- [ ] **Step 1: Service test** — `get` calls `assertTeamMemberAccess` then `findByMember`

- [ ] **Step 2: Implement service**

```ts
export class StaffAvailabilityService {
	constructor(
		private readonly repo: StaffAvailabilityRepository,
		private readonly authz: AuthorizationService,
	) {}

	async get(actorId: string, memberId: string, scopedBranchIds: string[] | null) {
		await this.authz.assertTeamMemberAccess(actorId, memberId, scopedBranchIds);
		return this.repo.findByMember(memberId);
	}

	async upsert(
		actorId: string,
		memberId: string,
		slots: Array<{
			dayOfWeek: number;
			isClosed: boolean;
			startTime?: string | null;
			endTime?: string | null;
		}>,
		scopedBranchIds: string[] | null,
	) {
		await this.authz.assertTeamMemberAccess(actorId, memberId, scopedBranchIds);
		for (const slot of slots) {
			await this.repo.upsertDay({
				teamMemberId: memberId,
				dayOfWeek: slot.dayOfWeek,
				isClosed: slot.isClosed,
				startTime: slot.startTime ?? null,
				endTime: slot.endTime ?? null,
			});
		}
		return this.repo.findByMember(memberId);
	}
}
```

- [ ] **Step 3: Wire + thin routes; update route tests to mock `staffAvailabilityService`**

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(api): extract StaffAvailabilityService"
```

---

### Task 11: Extend `BookingsService` (export, listByBusiness, calendar)

**Files:**
- Modify: `workers/api/src/modules/bookings/bookings.service.ts`
- Modify: `workers/api/src/modules/bookings/index.ts`
- Modify: `workers/api/src/__tests__/modules/bookings/bookings.service.test.ts`

- [ ] **Step 1: Write failing tests** for `exportCsv`, `listByBusiness`, `calendar`

- [ ] **Step 2: Add methods to `BookingsService`**

`listByBusiness` — use `this.branchesRepo` + `this.repo.findByBranch`; owner path calls `assertBusinessOwner`; manager path uses `scopedBranchIds` filter.

`exportCsv` — reuse branch fan-out; private `csvField` helper; return `{ csv: string, filename: string }`.

`calendar` — `await this.authz.assertBranchAccess(actorId, branchId, scopedBranchIds)` then `this.repo.findByBranchInRange`.

- [ ] **Step 3: Thin route handlers**

```ts
// exportRoute
const { csv, filename } = await c.var.bookingsService.exportCsv(
	c.var.user.id,
	businessId,
	status,
	c.var.scopedBranchIds,
);
return new Response(csv, {
	status: 200,
	headers: {
		"Content-Type": "text/csv",
		"Content-Disposition": `attachment; filename="${filename}"`,
	},
});
```

Remove `getDB`, direct `BookingsRepository`, `branchesSchema` queries from `index.ts`.

- [ ] **Step 4: Run bookings tests + commit**

```bash
git commit -m "refactor(api): move bookings export/list/calendar into BookingsService"
```

---

### Task 12: Phase 2 docs + verification

- [ ] Update `docs/guides/api-query-repository-pattern.md` — add AnalyticsService, CustomersService, CampaignsService, StaffAvailabilityService to module layout table.

- [ ] Run `bun run --filter @repo/api test` and `bun run lint`

- [ ] Commit docs

**Phase 2 PR ready.**

---

# Phase 3 — Thin services & validation polish

> Merge as PR 3 after Phase 2 lands.

---

### Task 13: `FavouritesService`

**Files:**
- Create: `workers/api/src/modules/favourites/favourites.service.ts`
- Create: `workers/api/src/__tests__/modules/favourites/favourites.service.test.ts`
- Modify: `favourites/index.ts`, `routes.ts`, `types/index.ts`, `create-test-app.ts` MockServices

- [ ] **Step 1: Service test** — `add` throws `ConflictError` on duplicate

- [ ] **Step 2: Implement service** (per spec — throws not inline JSON)

- [ ] **Step 3: Wire + thin routes**

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(api): extract FavouritesService with thrown domain errors"
```

---

### Task 14: `DemoRequestsService` + `SearchService`

**Files:**
- Create: `demo-requests/demo-requests.service.ts`, `search/search.service.ts`
- Modify respective `index.ts`, `routes.ts`, `types/index.ts`

- [ ] **Step 1: Implement thin services** (repo delegate / strategy dispatch)

- [ ] **Step 2: Wire installers**

- [ ] **Step 3: Search route smoke test** — `GET /api/v1/search?q=test` returns 200

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(api): extract DemoRequestsService and SearchService"
```

---

### Task 15: `formatZodIssues` validation unification

**Files:**
- Modify: `workers/api/src/core/http/validation.ts`
- Modify: `workers/api/src/core/create-app.ts`
- Create: `workers/api/src/__tests__/core/validation.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { formatZodIssues } from "../../core/http/validation";

describe("formatZodIssues", () => {
	it("joins multiple issue messages with semicolon", () => {
		const schema = z.object({ a: z.string(), b: z.number() });
		const result = schema.safeParse({ a: 1, b: "x" });
		if (result.success) throw new Error("expected failure");
		expect(formatZodIssues(result.error.issues)).toMatch(/; /);
	});
});
```

- [ ] **Step 2: Implement helper and use everywhere**

In `validation.ts`:

```ts
import type { ZodIssue } from "zod";

export function formatZodIssues(issues: ZodIssue[]): string {
	return issues.map((i) => i.message).join("; ") || "Validation failed";
}
```

Update `parseQuery` / `parseBody`:

```ts
throw new ValidationError(formatZodIssues(result.error.issues));
```

Update `create-app.ts`:

```ts
import { formatZodIssues } from "./http/validation";
// ...
const message = formatZodIssues(result.error.issues);
```

- [ ] **Step 3: Run validation + full tests**

```bash
cd workers/api && bun run test src/__tests__/core/validation.test.ts
bun run --filter @repo/api test
```

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(api): unify Zod validation message formatting"
```

---

### Task 16: Final docs + archive old plan

**Files:**
- Modify: `workers/api/CLAUDE.md` (full service inventory)
- Modify: `docs/guides/api-query-repository-pattern.md`
- Modify: `docs/superpowers/plans/2026-06-06-backbone-hardening-f2-remaining-f3-f4-f5.md`

- [ ] Add status banner to old plan:

```markdown
> **Status: DONE (2026-06-15).** F1–F5 core items shipped. Follow-up route/service work: [2026-06-15-api-backbone-completion.md](./2026-06-15-api-backbone-completion.md).
```

- [ ] Run full verification:

```bash
bun run --filter @repo/api test
bun run lint
bun run build
```

- [ ] Commit

```bash
git commit -m "docs(api): complete backbone follow-up documentation"
```

**Phase 3 PR ready. Epic complete.**

---

## Self-review

| Spec requirement | Task |
|------------------|------|
| Honest owner-only gates (5 modules) | Task 2, 3 |
| Delete duplicate assertBusinessOwner | Task 2 |
| Bookings inline auth → authz + throws | Task 4 |
| assertTeamMemberAccess | Task 1, 5 |
| AnalyticsService | Task 7 |
| CustomersService | Task 8 |
| CampaignsService | Task 9 |
| StaffAvailabilityService | Task 10 |
| BookingsService extensions | Task 11 |
| FavouritesService | Task 13 |
| DemoRequestsService + SearchService | Task 14 |
| formatZodIssues | Task 15 |
| Documentation | Tasks 6, 12, 16 |
| Verification each phase | Tasks 6, 12, 16 |

No placeholders. Method names consistent across tasks.
