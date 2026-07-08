# Booking Owner Earnings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reconciled "earnings" view to the booking-owner analytics — net revenue (price − discount) for **Completed** bookings, broken down by staff, service, branch, and over time, surfaced in business-dashboard and owner-app.

**Architecture:** One consolidated `GET /api/v1/analytics/earnings` endpoint backed by a single new repository method `AnalyticsRepository.getEarnings`. All four breakdowns share one filter set (Completed status, `slot`-based date window, discount netted) so they reconcile to one `total` by construction. Existing analytics methods/routes are left untouched. Frontends gain an "Earnings" section reusing existing chart primitives.

**Tech Stack:** Hono + Cloudflare Workers + Drizzle ORM + D1 (SQLite); Vitest (in-memory SQLite via `createTestDb`); React Query; Next.js (business-dashboard) and Expo/React Native (owner-app).

**Spec:** [docs/superpowers/specs/2026-06-10-booking-owner-earnings-design.md](../specs/2026-06-10-booking-owner-earnings-design.md)
**Issue:** [#76](https://github.com/hasib-devs/Talash/issues/76)

---

## Key conventions (read before starting)

- **No service layer for analytics.** Unlike most modules, the analytics route handlers call the repository directly (see `workers/api/src/modules/analytics/index.ts`). Follow that existing pattern — do **not** introduce an `analytics.service.ts`.
- **Drizzle camelCase keys.** Inserts in tests use schema camelCase keys; cast with `as never` for the better-sqlite3 vs D1 type mismatch (as existing tests do).
- **Run commands from the monorepo root** unless noted. Backend tests: `bun run api:test`. Lint: `bun run lint`.
- **Net earnings = `price - discount`.** Always. Never `price` alone.
- **Date basis = `slot`** (service datetime, e.g. `"2026-06-01T11:00:00"`), filtered as `slot >= startDate AND slot <= endDate+"T23:59:59"` — mirroring the existing `getRevenueByDate`.

---

## File Structure

| File | Responsibility | Change |
| --- | --- | --- |
| `packages/core/src/database/repositories/analytics.repository.ts` | `getEarnings` + `Earnings` types | Modify (add method + interfaces only) |
| `workers/api/src/__tests__/modules/analytics/analytics.repository.earnings.integration.test.ts` | Real-D1 reconciliation test | Create |
| `workers/api/src/modules/analytics/index.ts` | `/earnings` route + OpenAPI schema | Modify |
| `workers/api/src/__tests__/modules/analytics/analytics.routes.test.ts` | Route auth tests for `/earnings` | Modify |
| `packages/api-client/src/endpoints/analytics.ts` | `Earnings` types + `earnings()` method | Modify |
| `packages/api-client/src/index.ts` | Re-export `Earnings` types | Modify |
| `sites/business-dashboard/src/app/(dashboard)/analytics/page.tsx` | Earnings section | Modify |
| `apps/owner-app/src/components/screens/AnalyticsScreen.tsx` | Earnings section | Modify |
| `docs/guides/api-endpoints.md`, `docs/guides/ui-backend-sync.md`, `docs/adr/0004-multi-vertical-platform-extension.md`, `workers/api/CLAUDE.md` | Docs | Modify |

---

## Task 1: `getEarnings` repository method (TDD against real in-memory D1)

**Files:**
- Test: `workers/api/src/__tests__/modules/analytics/analytics.repository.earnings.integration.test.ts` (create)
- Modify: `packages/core/src/database/repositories/analytics.repository.ts`

This is the correctness core. The test seeds a real schema (in-memory SQLite with all migrations applied) and asserts the four breakdowns reconcile.

- [ ] **Step 1: Write the failing integration test**

Create `workers/api/src/__tests__/modules/analytics/analytics.repository.earnings.integration.test.ts`:

```ts
/**
 * Integration test for AnalyticsRepository.getEarnings.
 *
 * Uses the real in-memory SQLite harness (createTestDb) with all migrations
 * applied, so the actual reconciliation SQL (Completed + slot-window +
 * discount-netted) is exercised against a real DB — not mocked. This is the
 * only check that the four breakdowns sum to the same total.
 */
import { AnalyticsRepository } from "@repo/core/src/database/repositories/analytics.repository";
import {
	bookingsSchema,
	teamMembersSchema,
	usersSchema,
} from "@repo/core/src/database/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { seedChain } from "../../helpers/seed";
import { createTestDb } from "../../helpers/test-db";

const TS = "2026-01-01T00:00:00.000Z";
const RANGE = { startDate: "2026-06-01", endDate: "2026-06-30" };

type Db = ReturnType<typeof createTestDb>;

function makeRepo(db: Db) {
	return new AnalyticsRepository(db as never);
}

async function seedUser(db: Db, id: string, name: string) {
	// biome-ignore lint/suspicious/noExplicitAny: better-sqlite3 vs D1 drizzle type mismatch in tests
	await (db as any)
		.insert(usersSchema)
		.values({ id, name, role: "staff", createdAt: TS });
}

async function seedStaff(
	db: Db,
	opts: { id: string; userId: string; businessId: string; branchId: string },
) {
	// biome-ignore lint/suspicious/noExplicitAny: better-sqlite3 vs D1 drizzle type mismatch in tests
	await (db as any).insert(teamMembersSchema).values({
		id: opts.id,
		userId: opts.userId,
		businessId: opts.businessId,
		branchId: opts.branchId,
		title: "Stylist",
		role: "Staff",
		createdAt: TS,
	});
}

async function seedBooking(
	db: Db,
	opts: {
		id: string;
		userId: string;
		serviceId: string;
		branchId: string;
		staffId: string | null;
		slot: string;
		status: "Pending" | "Confirmed" | "Cancelled" | "Completed";
		price: number;
		discount: number;
	},
) {
	// biome-ignore lint/suspicious/noExplicitAny: better-sqlite3 vs D1 drizzle type mismatch in tests
	await (db as any).insert(bookingsSchema).values({
		id: opts.id,
		userId: opts.userId,
		serviceId: opts.serviceId,
		branchId: opts.branchId,
		staffId: opts.staffId,
		slot: opts.slot,
		status: opts.status,
		price: opts.price,
		discount: opts.discount,
		createdAt: TS,
	});
}

describe("AnalyticsRepository.getEarnings", () => {
	let db: Db;

	beforeEach(async () => {
		db = createTestDb();
		// business → branch → service chain owned by owner-1
		await seedChain(db, {
			ownerId: "owner-1",
			businessId: "biz-1",
			branchId: "branch-1",
			serviceId: "svc-1",
		});
		await seedUser(db, "cust-1", "Customer One");
		await seedUser(db, "staff-user-1", "Alice Stylist");
		await seedStaff(db, {
			id: "staff-1",
			userId: "staff-user-1",
			businessId: "biz-1",
			branchId: "branch-1",
		});

		// In-range Completed, assigned to staff-1: net 900
		await seedBooking(db, {
			id: "bk-1",
			userId: "cust-1",
			serviceId: "svc-1",
			branchId: "branch-1",
			staffId: "staff-1",
			slot: "2026-06-10T11:00:00",
			status: "Completed",
			price: 1000,
			discount: 100,
		});
		// In-range Completed, UNASSIGNED (staffId null): net 500
		await seedBooking(db, {
			id: "bk-2",
			userId: "cust-1",
			serviceId: "svc-1",
			branchId: "branch-1",
			staffId: null,
			slot: "2026-06-12T14:00:00",
			status: "Completed",
			price: 500,
			discount: 0,
		});
		// In-range but NOT Completed → excluded
		await seedBooking(db, {
			id: "bk-3",
			userId: "cust-1",
			serviceId: "svc-1",
			branchId: "branch-1",
			staffId: "staff-1",
			slot: "2026-06-15T09:00:00",
			status: "Cancelled",
			price: 9999,
			discount: 0,
		});
		// Completed but slot OUT of range (July) → excluded even though createdAt is in TS
		await seedBooking(db, {
			id: "bk-4",
			userId: "cust-1",
			serviceId: "svc-1",
			branchId: "branch-1",
			staffId: "staff-1",
			slot: "2026-07-01T11:00:00",
			status: "Completed",
			price: 7777,
			discount: 0,
		});
	});

	it("reconciles: each breakdown sums to total (900 + 500 = 1400)", async () => {
		const e = await makeRepo(db).getEarnings("biz-1", RANGE);
		expect(e.total).toBe(1400);
		const sum = (rows: { revenue: number }[]) =>
			rows.reduce((s, r) => s + r.revenue, 0);
		expect(sum(e.byStaff)).toBe(1400);
		expect(sum(e.byService)).toBe(1400);
		expect(sum(e.byBranch)).toBe(1400);
		expect(sum(e.overTime)).toBe(1400);
	});

	it("includes an Unassigned staff bucket for null-staff bookings", async () => {
		const e = await makeRepo(db).getEarnings("biz-1", RANGE);
		const unassigned = e.byStaff.find((r) => r.teamMemberId === null);
		expect(unassigned).toBeDefined();
		expect(unassigned?.name).toBe("Unassigned");
		expect(unassigned?.revenue).toBe(500);
		const alice = e.byStaff.find((r) => r.teamMemberId === "staff-1");
		expect(alice?.name).toBe("Alice Stylist");
		expect(alice?.revenue).toBe(900);
	});

	it("nets discount and excludes non-Completed and out-of-range slots", async () => {
		const e = await makeRepo(db).getEarnings("biz-1", RANGE);
		// 9999 (Cancelled) and 7777 (July slot) must not appear anywhere
		expect(e.total).toBe(1400);
		expect(e.byBranch).toHaveLength(1);
		expect(e.byBranch[0]?.branchId).toBe("branch-1");
		expect(e.byBranch[0]?.bookings).toBe(2);
	});

	it("returns empty/zero for a business with no branches", async () => {
		const e = await makeRepo(db).getEarnings("biz-unknown", RANGE);
		expect(e).toEqual({
			total: 0,
			byStaff: [],
			byService: [],
			byBranch: [],
			overTime: [],
		});
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run api:test analytics.repository.earnings`
Expected: FAIL — `getEarnings is not a function` (method does not exist yet).

- [ ] **Step 3: Add the `Earnings` interfaces to the repository**

In `packages/core/src/database/repositories/analytics.repository.ts`, add these interfaces near the other exported interfaces (after `ServiceStat`):

```ts
export interface EarningsBreakdownRow {
	revenue: number;
	bookings: number;
}

export interface Earnings {
	total: number;
	byStaff: (EarningsBreakdownRow & {
		teamMemberId: string | null;
		name: string;
	})[];
	byService: (EarningsBreakdownRow & { serviceId: string; name: string })[];
	byBranch: (EarningsBreakdownRow & { branchId: string; name: string })[];
	overTime: (EarningsBreakdownRow & { date: string })[];
}
```

- [ ] **Step 4: Implement `getEarnings`**

Add this method to the `AnalyticsRepository` class (e.g. after `getStaffStats`). It reuses the existing private `getBranchIds` helper and the imported `branchesSchema`, `servicesSchema`, `teamMembersSchema`, `usersSchema`, and the drizzle helpers already imported at the top of the file (`and`, `eq`, `inArray`, `isNull`, `gte`, `sql`):

```ts
async getEarnings(
	businessId: string,
	range: AnalyticsRange,
): Promise<Earnings> {
	const empty: Earnings = {
		total: 0,
		byStaff: [],
		byService: [],
		byBranch: [],
		overTime: [],
	};
	const branchIds = await this.getBranchIds(businessId);
	if (branchIds.length === 0) return empty;

	// Shared filter: Completed, not soft-deleted, slot within range.
	const where = and(
		inArray(bookingsSchema.branchId, branchIds),
		isNull(bookingsSchema.deletedAt),
		eq(bookingsSchema.status, "Completed"),
		gte(bookingsSchema.slot, range.startDate),
		sql`${bookingsSchema.slot} <= ${`${range.endDate}T23:59:59`}`,
	);
	const net = sql<number>`sum(${bookingsSchema.price} - ${bookingsSchema.discount})`;
	const cnt = sql<number>`count(*)`;

	// total
	const [totalRow] = await this.db
		.select({ revenue: net })
		.from(bookingsSchema)
		.where(where);
	const total = Number(totalRow?.revenue) || 0;

	// by branch
	const branchRows = await this.db
		.select({
			branchId: bookingsSchema.branchId,
			name: branchesSchema.name,
			revenue: net,
			bookings: cnt,
		})
		.from(bookingsSchema)
		.leftJoin(branchesSchema, eq(bookingsSchema.branchId, branchesSchema.id))
		.where(where)
		.groupBy(bookingsSchema.branchId)
		.orderBy(sql`sum(${bookingsSchema.price} - ${bookingsSchema.discount}) desc`);

	// by service
	const serviceRows = await this.db
		.select({
			serviceId: bookingsSchema.serviceId,
			name: servicesSchema.name,
			revenue: net,
			bookings: cnt,
		})
		.from(bookingsSchema)
		.leftJoin(servicesSchema, eq(bookingsSchema.serviceId, servicesSchema.id))
		.where(where)
		.groupBy(bookingsSchema.serviceId)
		.orderBy(sql`sum(${bookingsSchema.price} - ${bookingsSchema.discount}) desc`);

	// by staff — keep null staffId rows; resolve to an "Unassigned" bucket
	const staffRows = await this.db
		.select({
			staffId: bookingsSchema.staffId,
			revenue: net,
			bookings: cnt,
		})
		.from(bookingsSchema)
		.where(where)
		.groupBy(bookingsSchema.staffId);

	const assignedIds = staffRows
		.map((r) => r.staffId)
		.filter((id): id is string => id !== null);
	const members =
		assignedIds.length > 0
			? await this.db
					.select({ id: teamMembersSchema.id, name: usersSchema.name })
					.from(teamMembersSchema)
					.innerJoin(usersSchema, eq(teamMembersSchema.userId, usersSchema.id))
					.where(inArray(teamMembersSchema.id, assignedIds))
			: [];
	const idToName = Object.fromEntries(members.map((m) => [m.id, m.name]));

	const byStaff = staffRows.map((r) => ({
		teamMemberId: r.staffId,
		name:
			r.staffId === null
				? "Unassigned"
				: (idToName[r.staffId] ?? r.staffId),
		revenue: Number(r.revenue) || 0,
		bookings: Number(r.bookings),
	}));

	// over time — group by slot date (YYYY-MM-DD)
	const overTimeRows = await this.db
		.select({
			date: sql<string>`substr(${bookingsSchema.slot}, 1, 10)`,
			revenue: net,
			bookings: cnt,
		})
		.from(bookingsSchema)
		.where(where)
		.groupBy(sql`substr(${bookingsSchema.slot}, 1, 10)`)
		.orderBy(sql`substr(${bookingsSchema.slot}, 1, 10)`);

	return {
		total,
		byBranch: branchRows.map((r) => ({
			branchId: r.branchId,
			name: r.name ?? r.branchId,
			revenue: Number(r.revenue) || 0,
			bookings: Number(r.bookings),
		})),
		byService: serviceRows.map((r) => ({
			serviceId: r.serviceId,
			name: r.name ?? r.serviceId,
			revenue: Number(r.revenue) || 0,
			bookings: Number(r.bookings),
		})),
		byStaff,
		overTime: overTimeRows.map((r) => ({
			date: r.date,
			revenue: Number(r.revenue) || 0,
			bookings: Number(r.bookings),
		})),
	};
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun run api:test analytics.repository.earnings`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/database/repositories/analytics.repository.ts workers/api/src/__tests__/modules/analytics/analytics.repository.earnings.integration.test.ts
git commit -m "feat(analytics): add reconciled getEarnings repository method (#76)"
```

---

## Task 2: `GET /analytics/earnings` route + auth tests

**Files:**
- Modify: `workers/api/src/modules/analytics/index.ts`
- Test: `workers/api/src/__tests__/modules/analytics/analytics.routes.test.ts`

- [ ] **Step 1: Add `getEarnings` to the route-test repo mock and write the failing auth tests**

In `workers/api/src/__tests__/modules/analytics/analytics.routes.test.ts`, add `getEarnings` to the `AnalyticsRepository` mock implementation inside `beforeEach` (alongside `getRevenueByDate`, `getTopServices`, `getPeakHours`):

```ts
		getEarnings: vi.fn().mockResolvedValue({
			total: 0,
			byStaff: [],
			byService: [],
			byBranch: [],
			overTime: [],
		}),
```

Then add a new describe block at the end of the file (mirror the existing `/revenue` block):

```ts
describe("GET /api/v1/analytics/earnings", () => {
	it("returns 401 without auth", async () => {
		const res = await app.request(
			"/api/v1/analytics/earnings?businessId=business-1&range=30",
			{},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 403 for non-owner role", async () => {
		const token = await createTestToken({ role: "customer" });
		const res = await app.request(
			"/api/v1/analytics/earnings?businessId=business-1&range=30",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("returns 200 for owner", async () => {
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/analytics/earnings?businessId=business-1&range=30",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run api:test analytics.routes`
Expected: FAIL — the `/earnings` 200 test fails (404, route not registered).

- [ ] **Step 3: Add the OpenAPI schema + route to `index.ts`**

In `workers/api/src/modules/analytics/index.ts`, add the response schema near the other schemas (after `StaffStatSchema`):

```ts
const EarningsSchema = z
	.object({
		total: z.number(),
		byStaff: z.array(
			z.object({
				teamMemberId: z.string().nullable(),
				name: z.string(),
				revenue: z.number(),
				bookings: z.number(),
			}),
		),
		byService: z.array(
			z.object({
				serviceId: z.string(),
				name: z.string(),
				revenue: z.number(),
				bookings: z.number(),
			}),
		),
		byBranch: z.array(
			z.object({
				branchId: z.string(),
				name: z.string(),
				revenue: z.number(),
				bookings: z.number(),
			}),
		),
		overTime: z.array(
			z.object({
				date: z.string(),
				revenue: z.number(),
				bookings: z.number(),
			}),
		),
	})
	.openapi("AnalyticsEarnings");
```

Add the route definition near the others (after `staffRoute`):

```ts
const earningsRoute = createRoute({
	method: "get",
	path: "/earnings",
	tags: ["Analytics"],
	summary: "Reconciled earnings by staff, service, branch, and over time",
	security: [{ bearerAuth: [] }],
	request: { query: RangeQuery },
	responses: {
		200: {
			content: { "application/json": { schema: EarningsSchema } },
			description: "OK",
		},
	},
});
```

Register the handler by appending to the `analyticsApp.openapi(...)` chain (after the `.openapi(staffRoute, ...)` handler):

```ts
	.openapi(earningsRoute, async (c) => {
		const { businessId, range } = c.req.valid("query");
		await assertBusinessOwner(c.var.user.id, businessId);
		const repo = new AnalyticsRepository(getDB());
		const data = await repo.getEarnings(businessId, getRange(Number(range)));
		return c.json(data, 200);
	});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run api:test analytics.routes`
Expected: PASS (existing tests + 3 new `/earnings` tests).

- [ ] **Step 5: Commit**

```bash
git add workers/api/src/modules/analytics/index.ts workers/api/src/__tests__/modules/analytics/analytics.routes.test.ts
git commit -m "feat(analytics): expose GET /analytics/earnings route (#76)"
```

---

## Task 3: api-client `earnings` endpoint + types

**Files:**
- Modify: `packages/api-client/src/endpoints/analytics.ts`
- Modify: `packages/api-client/src/index.ts`

No unit test here (the package is thin typed wrappers); verification is typecheck/build.

- [ ] **Step 1: Add the `Earnings` types and `earnings()` method**

In `packages/api-client/src/endpoints/analytics.ts`, add the types after the existing `StaffStat` interface:

```ts
export interface EarningsBreakdownRow {
	revenue: number;
	bookings: number;
}

export interface Earnings {
	total: number;
	byStaff: (EarningsBreakdownRow & {
		teamMemberId: string | null;
		name: string;
	})[];
	byService: (EarningsBreakdownRow & { serviceId: string; name: string })[];
	byBranch: (EarningsBreakdownRow & { branchId: string; name: string })[];
	overTime: (EarningsBreakdownRow & { date: string })[];
}
```

Add the method inside the object returned by `createAnalyticsEndpoints` (after `staff:`):

```ts
		earnings: (params: { businessId: string; range?: AnalyticsRange }) =>
			client.get<Earnings>("/api/v1/analytics/earnings", params),
```

- [ ] **Step 2: Re-export the new types from the package index**

In `packages/api-client/src/index.ts`, add `Earnings` and `EarningsBreakdownRow` to the existing analytics `export type { ... } from "./endpoints/analytics";` block (keep the list alphabetised — insert after `CouponStat`):

```ts
	Earnings,
	EarningsBreakdownRow,
```

- [ ] **Step 3: Typecheck the package**

Run: `bun run build` (or scoped: `bun run --filter @repo/api-client build` if available)
Expected: PASS — no type errors; `Earnings` exported.

- [ ] **Step 4: Commit**

```bash
git add packages/api-client/src/endpoints/analytics.ts packages/api-client/src/index.ts
git commit -m "feat(api-client): add analytics.earnings endpoint + Earnings types (#76)"
```

---

## Task 4: business-dashboard earnings section

**Files:**
- Modify: `sites/business-dashboard/src/app/(dashboard)/analytics/page.tsx`

Reuse the existing `range` state, `useQuery` pattern, `StatCard`, `Card`, `money()`, and a horizontal-bar renderer. The existing `ServiceBars` is count-keyed; add a small revenue-keyed bar list rather than mutating it.

- [ ] **Step 1: Add the earnings query**

In `page.tsx`, alongside the existing `staffQ` query, add (use the same `businessId!`/`range`/`enabled` shape as the others):

```tsx
	const earningsQ = useQuery({
		queryKey: ["analytics", "earnings", businessId, range],
		queryFn: () => api.analytics.earnings({ businessId: businessId!, range }),
		enabled: !!businessId,
	});
```

`earningsQ.data` is already fully typed via the api-client `earnings()` return — do **not** add an `Earnings` type import (it would be unused and trip Biome's unused-import lint).

- [ ] **Step 2: Add a reusable earnings-bar component**

Near `ServiceBars` in the same file, add a revenue-keyed horizontal bar list (label + money, bar width by share of max revenue):

```tsx
function EarningsBars({
	data,
}: {
	data: { name: string; revenue: number; bookings: number }[];
}) {
	if (!data.length)
		return <p className="font-sans text-sm text-ink-400 py-4">No data yet.</p>;
	const max = Math.max(...data.map((d) => d.revenue), 1);
	return (
		<div className="flex flex-col gap-3.5">
			{data.slice(0, 8).map((s) => (
				<div key={s.name}>
					<div className="flex items-center justify-between mb-1">
						<span className="font-sans text-sm text-ink-800 truncate max-w-[60%]">
							{s.name}
						</span>
						<span className="font-sans text-xs font-semibold text-ink-500">
							{money(s.revenue)} · {s.bookings}
						</span>
					</div>
					<div className="h-1.5 bg-line rounded-full overflow-hidden">
						<div
							className="h-full bg-primary-600 rounded-full transition-all duration-500"
							style={{ width: `${(s.revenue / max) * 100}%` }}
						/>
					</div>
				</div>
			))}
		</div>
	);
}
```

- [ ] **Step 3: Render the Earnings section**

Add a new section in the page body (place it after the revenue chart / near the staff section). Use the existing `Card` + `StatCard` + `BarChart` primitives:

```tsx
			{/* ── Earnings ─────────────────────────────────────────── */}
			<section className="flex flex-col gap-4">
				<h2 className="font-sans text-lg font-semibold text-ink-900">
					Earnings
				</h2>
				<StatCard
					label="Total earnings"
					value={money(earningsQ.data?.total ?? 0)}
					icon={DollarSign}
				/>
				<div className="grid gap-4 md:grid-cols-3">
					<Card title="By staff">
						<EarningsBars data={earningsQ.data?.byStaff ?? []} />
					</Card>
					<Card title="By service">
						<EarningsBars data={earningsQ.data?.byService ?? []} />
					</Card>
					<Card title="By branch">
						<EarningsBars data={earningsQ.data?.byBranch ?? []} />
					</Card>
				</div>
				<Card title="Earnings over time">
					<BarChart
						data={(earningsQ.data?.overTime ?? []).map((p) => ({
							date: p.date,
							revenue: p.revenue,
							bookings: p.bookings,
						}))}
						valueKey="revenue"
						label="Earnings over time"
					/>
				</Card>
			</section>
```

> Note: confirm the exact prop names of `Card` and `StatCard` against their definitions in `@/components/primitives` and adjust (`title` vs `heading`, `icon` vs none) to match — do not invent props. `DollarSign` is already imported at the top of the file.

- [ ] **Step 4: Typecheck / build the site**

Run: `bun run build` (or scoped business-dashboard build/lint)
Expected: PASS — no type errors.

- [ ] **Step 5: Manual smoke check (optional but recommended)**

Start the API (`bun run api:dev`) and the site (`bun run business-dashboard:dev`), sign in as an owner with seeded data (`bun run db:seed:dev`), open the Analytics page, and confirm the Earnings section renders with a total and three breakdown cards that visually reconcile.

- [ ] **Step 6: Commit**

```bash
git add "sites/business-dashboard/src/app/(dashboard)/analytics/page.tsx"
git commit -m "feat(business-dashboard): earnings section on analytics page (#76)"
```

---

## Task 5: owner-app earnings section

**Files:**
- Modify: `apps/owner-app/src/components/screens/AnalyticsScreen.tsx`

Mirror Task 4 using React Native primitives already in the file (`Card`, `money`, `FilterTabs`, `RevenueBars`, `Colors`).

- [ ] **Step 1: Add the earnings query**

Alongside the screen's existing analytics `useQuery` calls, add (`earningsQ.data` is typed via the api-client return — no extra type import needed):

```tsx
	const earningsQ = useQuery({
		queryKey: ["analytics", "earnings", businessId, range],
		queryFn: () => api.analytics.earnings({ businessId: businessId!, range }),
		enabled: !!businessId,
	});
```

(Match the exact `businessId`/`range`/`enabled` expressions used by the other queries in this screen.)

- [ ] **Step 2: Add a native earnings-bar component**

Near `RevenueBars` in the same file, add a horizontal revenue bar list using the existing token/`money()` style:

```tsx
function EarningsBars({
	data,
}: {
	data: { name: string; revenue: number; bookings: number }[];
}) {
	if (data.length === 0)
		return (
			<Text style={{ fontSize: 13, color: Colors.ink400, paddingVertical: 8 }}>
				No data yet.
			</Text>
		);
	const max = Math.max(...data.map((d) => d.revenue), 1);
	return (
		<View style={{ gap: 12 }}>
			{data.slice(0, 8).map((s) => (
				<View key={s.name}>
					<View className="flex-row items-center justify-between" style={{ marginBottom: 4 }}>
						<Text
							numberOfLines={1}
							style={{ fontSize: 13, color: Colors.ink800, flex: 1, marginRight: 8 }}
						>
							{s.name}
						</Text>
						<Text style={{ fontSize: 11, fontWeight: "600", color: Colors.ink500 }}>
							{money(s.revenue)} · {s.bookings}
						</Text>
					</View>
					<View
						style={{ height: 6, backgroundColor: Colors.line, borderRadius: 999, overflow: "hidden" }}
					>
						<View
							style={{
								height: 6,
								width: `${(s.revenue / max) * 100}%`,
								backgroundColor: Colors.primary600,
								borderRadius: 999,
							}}
						/>
					</View>
				</View>
			))}
		</View>
	);
}
```

> Note: verify `Colors.line` / `Colors.ink800` / `Colors.primary600` exist in `../../tokens`; substitute the nearest existing token name if any differ. Do not invent token names.

- [ ] **Step 3: Render the Earnings section**

Add to the screen's `ScrollView` body (after the existing revenue/staff cards), reusing the screen's `Card` + `money()` + `RevenueBars`:

```tsx
			<Card>
				<Eyebrow>Earnings</Eyebrow>
				<Text
					className="font-light"
					style={{ fontSize: 26, letterSpacing: -0.5, color: Colors.ink900, marginTop: 4 }}
				>
					{money(earningsQ.data?.total ?? 0)}
				</Text>
				<Text style={{ fontSize: 12, color: Colors.ink400, marginTop: 8, marginBottom: 4 }}>
					By staff
				</Text>
				<EarningsBars data={earningsQ.data?.byStaff ?? []} />
				<Text style={{ fontSize: 12, color: Colors.ink400, marginTop: 12, marginBottom: 4 }}>
					By service
				</Text>
				<EarningsBars data={earningsQ.data?.byService ?? []} />
				<Text style={{ fontSize: 12, color: Colors.ink400, marginTop: 12, marginBottom: 4 }}>
					By branch
				</Text>
				<EarningsBars data={earningsQ.data?.byBranch ?? []} />
				<Text style={{ fontSize: 12, color: Colors.ink400, marginTop: 12, marginBottom: 4 }}>
					Over time
				</Text>
				<RevenueBars points={earningsQ.data?.overTime ?? []} />
			</Card>
```

> `RevenueBars` expects `{ date: string; revenue: number }[]` — `overTime` rows satisfy that shape. `Eyebrow` and `Card` are already imported in this file.

- [ ] **Step 4: Typecheck the app**

Run: `bun run --filter owner-app typecheck` (or the owner-app's TS check script; fall back to `bunx tsc --noEmit` within `apps/owner-app` if no script exists)
Expected: PASS — no type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/owner-app/src/components/screens/AnalyticsScreen.tsx
git commit -m "feat(owner-app): earnings section on analytics screen (#76)"
```

---

## Task 6: Documentation

**Files:**
- Modify: `docs/guides/api-endpoints.md`
- Modify: `docs/guides/ui-backend-sync.md`
- Modify: `docs/adr/0004-multi-vertical-platform-extension.md`
- Modify: `workers/api/CLAUDE.md`

- [ ] **Step 1: Document the endpoint**

In `docs/guides/api-endpoints.md`, find the Analytics route list and add:

```
- `GET /analytics/earnings?businessId=&range=7|30|90` — reconciled earnings (Completed bookings, discount netted, slot-based): `{ total, byStaff[], byService[], byBranch[], overTime[] }`. Staff null → "Unassigned" bucket.
```

In `workers/api/CLAUDE.md`, under the `## Analytics` section, add the same bullet to the route list:

```
- `GET /earnings?businessId=&range=7|30|90` — reconciled earnings by staff/service/branch + time series (Completed only, discount netted, bucketed by `slot`; null staff → "Unassigned")
```

- [ ] **Step 2: Document the UI wiring**

In `docs/guides/ui-backend-sync.md`, add an entry noting the `analytics.earnings` endpoint → `useQuery(["analytics","earnings",businessId,range])` → Earnings section on both the business-dashboard analytics page and owner-app AnalyticsScreen.

- [ ] **Step 3: Tick the ADR action item**

In `docs/adr/0004-multi-vertical-platform-extension.md`, change action item 8 from `[ ]` to `[x]`.

- [ ] **Step 4: Commit**

```bash
git add docs/guides/api-endpoints.md docs/guides/ui-backend-sync.md docs/adr/0004-multi-vertical-platform-extension.md workers/api/CLAUDE.md
git commit -m "docs(analytics): document /analytics/earnings + tick ADR-0004 item 8 (#76)"
```

---

## Task 7: Final verification

- [ ] **Step 1: Run the full lint + test + build gate**

Run:
```bash
bun run lint
bun run test
bun run build
```
Expected: all green. (Per the repo lint baseline, gate on touched files if the repo-wide Biome run shows pre-existing unrelated failures — but the analytics, api-client, dashboard, and owner-app files you touched must be clean.)

- [ ] **Step 2: Confirm acceptance criteria**

Verify against issue #76:
- Earnings endpoints by staff / service / branch / time series, Completed only, discount netted — Tasks 1–2.
- business-dashboard + owner-app earnings views — Tasks 4–5.
- Tests — Tasks 1–2 (reconciliation integration test + route auth tests).
- Staff commission rates not implemented — confirmed out of scope.

- [ ] **Step 3: Final commit (if any verification fixups were needed)**

```bash
git add -A
git commit -m "chore(analytics): verification fixups for earnings (#76)"
```

---

## Notes for the implementer

- **Reconciliation is the whole point.** If the Task 1 reconciliation test ever fails, the breakdowns are diverging — do not "fix" it by loosening the assertion. The likely cause is a filter that differs between breakdowns; they must all use the identical `where`.
- **Do not touch** `getStaffStats`, `getTopServices`, `getRevenueByDate`, or the `/staff`, `/services`, `/revenue` routes — the general dashboard still depends on them.
- **No schema/migration change** — `branchId`, `serviceId`, `slot` indexes already exist on `bookings`.
- **Frontend prop names:** the plan reuses existing components (`Card`, `StatCard`, `Eyebrow`, `RevenueBars`, `BarChart`). Before wiring, open each component and confirm its exact prop names; adjust the JSX to match rather than inventing props.
