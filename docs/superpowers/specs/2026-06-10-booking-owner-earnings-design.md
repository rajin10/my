# Booking owner earnings — design

**Issue:** [#76](https://github.com/hasib-devs/Talash/issues/76) — Parallel: booking owner earnings (extend analytics by staff/service/branch/time)
**Source:** [ADR-0004](../../adr/0004-multi-vertical-platform-extension.md) action item 8
**Blocked by:** #69 (Phase 0 rename) — **closed**, so this is unblocked.
**Date:** 2026-06-10

## Goal

Extend the existing `analytics` module so booking owners see earnings broken down by **staff**, **service**, **branch**, and **over time**. All data is already present on `bookings` (`staffId`, `serviceId`, `branchId`, `price`, `discount`, `slot`, `status`). This is a parallel track to the commerce work; the only shared prerequisite (Phase 0 rename) is done.

Staff **commission rates** are explicitly out of scope. Earnings here means gross revenue net of discount attributed to a dimension — not staff payout.

## Core principle: one reconciled dataset

The defining constraint of this feature is **reconciliation**: an owner who looks at "earnings by staff" and "earnings over time" for the same range expects both to sum to the same total. The existing general-analytics methods do **not** satisfy this, because they bucket by different date columns:

- `getRevenueByDate` (time series) filters by **`slot`**
- `getStaffStats`, `getTopServices`, `getOverview`, `getCouponStats` filter by **`createdAt`**

So a booking created in January for a February slot lands in January under "by staff" but February under "over time." Tolerable for a general dashboard; a correctness defect for an earnings view.

**Decisions (confirmed):**

1. **Date basis — `slot` (service date).** Earnings are recognised when the service is delivered. Matches the existing time series. Single basis across all four breakdowns.
2. **Unassigned bucket.** Completed bookings with `staffId IS NULL` still earned money and appear in the branch/time totals. They are grouped into a single `"Unassigned"` staff row so `sum(byStaff) === total`.
3. **Surface — extend the existing Analytics screens.** Add an "Earnings" section to the current business-dashboard page and owner-app screen; no new route/tab.

All four breakdowns are computed under **one identical filter set**, in one repository method, so reconciliation is guaranteed by construction rather than by keeping separate queries in sync.

Shared filter for every breakdown:

```
branchId IN (active branches of business)
  AND deletedAt IS NULL
  AND status = 'Completed'
  AND slot BETWEEN startDate AND endDate
```

Net earnings per booking = `price - discount`.

## Architecture (Approach A — consolidated endpoint)

One consolidated `GET /api/v1/analytics/earnings` endpoint returns all four breakdowns plus the grand total. Chosen over sibling per-dimension routes (`/branches`, `/service-earnings`, …) because:

- Reconciliation becomes a structural property (one query pass, one filter set), not a discipline that four routes must uphold.
- The existing `/analytics/services` (popularity by count, all statuses) and `/analytics/staff` routes stay **untouched** — the general dashboard keeps its current cards; earnings is a cleanly separated concern.
- The frontend earnings section fetches once.

Trade-off accepted: the response shape differs from the one-metric-per-route convention used elsewhere in the module. Justified by the reconciliation requirement that is the whole point of the feature.

### 1. Repository — `packages/core/src/database/repositories/analytics.repository.ts`

Add **one** method, leaving all existing methods unchanged:

```ts
export interface EarningsBreakdownRow {
  revenue: number;
  bookings: number;
}

export interface Earnings {
  total: number; // sum(price - discount), Completed, slot in range
  byStaff: (EarningsBreakdownRow & { teamMemberId: string | null; name: string })[];
  byService: (EarningsBreakdownRow & { serviceId: string; name: string })[];
  byBranch: (EarningsBreakdownRow & { branchId: string; name: string })[];
  overTime: (EarningsBreakdownRow & { date: string })[]; // date = substr(slot,1,10)
}

async getEarnings(businessId: string, range: AnalyticsRange): Promise<Earnings>
```

- Reuses the existing private `getBranchIds(businessId)` helper; returns an all-zero/empty `Earnings` when the business has no branches.
- One grouped query per dimension, all sharing the filter above. `total` is taken as `sum(price - discount)` over the same filter (and asserted equal to the sum of each breakdown in tests).
- **`byStaff` Unassigned handling:** do **not** filter `staffId IS NOT NULL`. Group by `staffId`; rows where `staffId IS NULL` collapse to one entry `{ teamMemberId: null, name: "Unassigned" }`.
- Names resolved with the join patterns already in the file: `branchesSchema.name`; `servicesSchema.name`; `teamMembersSchema → usersSchema.name`. Missing names fall back to the id (mirrors `getStaffStats` / `getTopServices`).
- `overTime` mirrors `getRevenueByDate`'s `substr(slot,1,10)` grouping and ordering, but inside this method so it shares the identical filter.

Indices already exist for `branchId`, `serviceId`, and `slot` — no schema or migration change.

### 2. API route — `workers/api/src/modules/analytics/index.ts`

Add `GET /analytics/earnings`:

- Query: the existing `RangeQuery` (`businessId`, `range ∈ {7,30,90}` default `30`).
- Guard: existing `assertBusinessOwner(user.id, businessId)` + module-level `requireAuth(["owner","manager"])` + `authenticate`. No new auth surface.
- Response: a new `AnalyticsEarnings` OpenAPI schema matching `Earnings`.
- Handler mirrors the existing routes: validate query → assert owner → `new AnalyticsRepository(getDB()).getEarnings(businessId, getRange(Number(range)))`.

### 3. API client — `packages/api-client/src/endpoints/analytics.ts`

Add the `Earnings` (and row) interfaces and:

```ts
earnings: (params: { businessId: string; range?: AnalyticsRange }) =>
  client.get<Earnings>("/api/v1/analytics/earnings", params),
```

Export the new types from the package index alongside the existing analytics types.

### 4. Frontend — business-dashboard

`sites/business-dashboard/src/app/(dashboard)/analytics/page.tsx`: add an **"Earnings"** section, sharing the existing range selector and `money()` formatting:

- A total-earnings stat (reuse `StatCard`).
- Three horizontal-bar breakdowns — by staff, by service, by branch — reusing the existing `ServiceBars`-style horizontal-bar component (generalise its props or add a thin sibling; no new chart engine).
- Over-time uses the existing `BarChart` on `overTime`.

Wiring follows the established `useQuery` + `api.analytics.earnings({ businessId, range })` pattern already used on this page.

### 5. Frontend — owner-app

`apps/owner-app/src/components/screens/AnalyticsScreen.tsx`: same "Earnings" content using existing primitives (`Card`, `RevenueBars`, `FilterTabs`, `money()`). Add the endpoint to the api-client usage; keep adapters/wiring in `src/hooks` / existing screen pattern rather than expanding `context.tsx`.

### 6. Tests

- **Repository** (`workers/api/src/__tests__/.../analytics`, real-D1 style if the suite supports it, else focused unit): 
  - Reconciliation: `sum(byStaff.revenue) === sum(byService.revenue) === sum(byBranch.revenue) === sum(overTime.revenue) === total`.
  - Unassigned bucket present (and only present) when a Completed booking has `staffId = null`.
  - Non-Completed bookings (Pending/Confirmed/Cancelled) excluded.
  - Discount netted (`price - discount`, not `price`).
  - Slot-based windowing: a booking whose `slot` is outside the range is excluded even if `createdAt` is inside.
- **Route** (`workers/api/src/__tests__/modules/analytics/analytics.routes.test.ts`): add `getEarnings` to the `AnalyticsRepository` mock; assert `401` (no auth), `403` (customer role), `200` (owner) for `/api/v1/analytics/earnings`, matching the existing per-route tests.

## Out of scope

- Staff commission rates / payouts.
- Changing or deprecating the existing `/analytics/services` (popularity) and `/analytics/staff` routes — they remain for the general dashboard.
- Any schema/migration change.

## Documentation updates (same PR)

- `docs/guides/api-endpoints.md` — add the `/analytics/earnings` route.
- `docs/guides/ui-backend-sync.md` — earnings endpoint → hook → screen wiring.
- ADR-0004 — tick action item 8.

## Acceptance criteria mapping

| Issue AC | Covered by |
| --- | --- |
| Earnings endpoints: staff / service / branch / time series (Completed; discount netted) | `getEarnings` + `/analytics/earnings` (§1–2) |
| business-dashboard + owner-app earnings views | §4–5 |
| Tests | §6 |
| Staff commission rates out of scope | Out of scope section |

## Scope summary

~1 repository method, 1 route, 1 client method + types, 2 screen additions, 2 test files, 3 doc touch-ups. No schema or migration change.
