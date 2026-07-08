# Manager branch-scoped access — analytics, customers, campaigns

- **Date:** 2026-06-12
- **Status:** Approved (design) — pending implementation plan
- **Area:** `workers/api` (`@repo/api`) + `packages/core` (`@repo/core`)
- **Origin:** `workers/api` code review, findings **L2** (route-layer ownership duplication / no service layer) and **L3** (`requireAuth(["owner","manager"])` but owner-only check → managers always 403).

## Problem

`analytics`, `customers`, and `campaigns` each:

1. Allow `manager` in the route guard, but authorize with a **local, hand-rolled** `assertBusinessOwner` that passes **owners only** — so a manager is admitted by the guard and then always gets 403 (L3). The docs ("Owner/manager routes under `/api/v1/analytics`") show managers were *intended* to have access.
2. Define a duplicate local `assertBusinessOwner` and instantiate repositories inline in route handlers (27 `new XRepository(getDB())` sites), bypassing the central `AuthorizationService` and the documented **Route → Service → Repository** layering (L2). These three modules are the codebase's only violators of its own layering rule.

## Goals

- Grant **managers branch-scoped access** to analytics, customers, and campaigns: a manager sees only the data for the branches they are assigned to; owners keep full (all-branches) access.
- Resolve L2 by introducing the missing service layer for these three modules and routing all ownership checks through `AuthorizationService`.
- No database schema migration.

## Non-goals / out of scope

- No `createdBy`/branch column on campaigns (no migration). Campaigns stay business-level, shared records.
- No new branch-level joins for dimensions that are not branch-attributable in the current schema (review stats, coupon-definition list) — see Decision 3.
- No change to staff role behaviour (staff are out of scope for these three modules).

## Decisions (resolved during brainstorming)

1. **Surfaces:** all three modules, and **managers may send campaigns** (recipients scoped to their branches' customers).
2. **Campaign ownership:** **shared, no schema change.** Any actor authorized for the business (owner or branch-manager) may view/create/edit/send/delete any of the business's campaigns. Send recipients = the **sender's** branch scope; `recipientCount` reflects whoever sent. Accepted wrinkle (documented): a manager can send/delete an owner's draft, and send is one-shot.
3. **Non-branch-attributable analytics dimensions:** `getReviewStats` (reviews key off `businessId`) and the coupon-**definition** list in `getCouponStats` (coupons are business-level) are shown **business-wide** to an authorized manager. Reviews are public and coupons are business config, so this is low-risk. Everything booking-derived is branch-scoped.
4. **Architecture:** **full service layer** (Approach B) — introduce `AnalyticsService` / `CustomersService` / `CampaignsService`, closing L2 fully alongside L3.

## Design

### Data flow

```
Route (requireAuth([...], { branchScope: true }) injects c.var.scopedBranchIds)
  → Service.method(actorId, businessId, scopedBranchIds, …)
     → authz.resolveBusinessBranchScope(actorId, businessId, scopedBranchIds) → allowedBranchIds   (or 403 / 404)
     → repo.aggregate(allowedBranchIds, …)
  → Response
```

### 1. Authorization primitive — `AuthorizationService.resolveBusinessBranchScope`

`resolveBusinessBranchScope(actorId: string, businessId: string, scopedBranchIds: string[] | null): Promise<string[]>`

- **Owner** (`scopedBranchIds === null`): call `assertBusinessOwner(actorId, businessId)` (throws `NotFoundError` if the business is missing, `ForbiddenError` if not owned). Return **all** non-deleted branch IDs of the business.
- **Manager** (`scopedBranchIds` is an array): compute `allowed = businessBranchIds ∩ scopedBranchIds`. If `allowed` is empty → throw `ForbiddenError("You are not assigned to this business")`. Otherwise return `allowed`.

This method is the single place that both **authorizes** the actor against the business and yields the **scope** the data layer must use.

### 2. `BranchesRepository.findIdsByBusiness(businessId): Promise<string[]>`

New public method returning non-deleted branch IDs for a business. It **replaces** the duplicated private `getBranchIds` in `AnalyticsRepository` and `CustomersRepository`, centralizing branch resolution. Used by `resolveBusinessBranchScope`.

### 3. Repository changes (`@repo/core`)

Re-key the booking-derived methods from `businessId` → the pre-resolved `branchIds` (they already filter on `inArray(bookingsSchema.branchId, …)` internally):

- **`AnalyticsRepository`** — `getOverview`, `getRevenueByDate`, `getTopServices`, `getPeakHours`, `getStaffStats`, `getEarnings` take `branchIds: string[]`. **Exceptions:** `getReviewStats` keeps `businessId`; `getCouponStats` takes **both** `businessId` (coupon definitions) and `branchIds` (redemption counts via bookings).
- **`CustomersRepository`** — `listByBranches(branchIds)` and `getCustomerVisits(branchIds, userId)` (both already filter by the resolved branch set).
- **`CampaignsRepository`** — unchanged. `findByBusiness(businessId)` still lists all of a business's campaigns (campaigns are business-level).

Remove the now-unused private `getBranchIds` from `AnalyticsRepository` and `CustomersRepository`.

> Verify during implementation that no other consumer (`@repo/queue`, `@repo/scheduled`, CLI) calls the re-keyed methods; if so, update call sites. Expectation: these are API-only.

### 4. Services (`@repo/api`)

Three new services, each constructed in its module's installer with its repo(s) + `authz`, matching every other module.

- **`AnalyticsService(analyticsRepo, authz)`** — one method per analytics route. Each method calls `resolveBusinessBranchScope` (authorize + scope), then the repo. `getReviewStats`/`getCouponStats` still authorize via the primitive but pass `businessId` so managers get business-wide figures for those two dimensions.
- **`CustomersService(customersRepo, authz)`** — `list(actorId, businessId, scopedBranchIds)` and `visits(actorId, businessId, userId, scopedBranchIds)`; resolve scope, call `listByBranches` / `getCustomerVisits`.
- **`CampaignsService(campaignsRepo, customersRepo, authz)`** — `list` / `create` / `update` / `send` / `delete`. Each resolves scope against the relevant `businessId` (from the body on create, or from the fetched campaign on id-addressed routes) to authorize. **`send`** computes recipients from `customersRepo.listByBranches(senderBranchIds)` filtered by the campaign's segment, then stamps `recipientCount` + `status = Sent`.

### 5. Routes (`@repo/api`)

For `analytics`, `customers`, `campaigns`:

- Guard → `requireAuth(["owner","manager"], { branchScope: true })` (injects `c.var.scopedBranchIds`).
- Delete the 3 local `assertBusinessOwner` functions and every inline `new XRepository(getDB())`.
- Handlers delegate to the services, passing `c.var.user.id`, the `businessId`, and `c.var.scopedBranchIds`.
- Add `installAnalyticsService` / `installCustomersService` / `installCampaignsService`; register them in `modules/routes.ts`. Following the existing installer pattern (e.g. `installUsersService`), each installer **constructs its repo(s) from `db`** and takes `authz` from `SharedDeps` — both `db` and `authz` are already present, so **no new `SharedDeps` fields are required** (`CampaignsService` also constructs a `CustomersRepository` from `db`).

### 6. Edge cases

- Manager assigned to no branch of the business → **403**.
- Business with zero branches → owner: empty data set (branchIds empty, repos already return empty); manager: **403** (empty intersection).
- Owner requesting a business they don't own → **403** (`assertBusinessOwner`).
- Bogus `businessId` → owner **404** (`assertBusinessOwner`), manager **403** (empty intersection, no existence disclosure). Accepted asymmetry.

## Testing

- **`resolveBusinessBranchScope`**: owner owns → all branches; owner not-owner → 403; business missing → 404; manager in-business → intersection; manager out-of-business → 403.
- **Each service**: owner sees all-branch data; manager sees only their branches; manager out-of-business → 403; campaign `send` recipient count reflects the sender's scope (owner = business-wide, manager = their branches).
- **Repos**: update existing `analytics`/`customers` repo + route tests for the re-keyed signatures; keep/add an integration check that branch filtering is applied.
- Full `@repo/api` and `@repo/core` suites green; lint + typecheck on touched files.

## Documentation

- `workers/api/CLAUDE.md`: update the **Analytics**, **Customers**, and a new/updated **Campaigns** section to document manager branch-scoped access, the business-wide review/coupon-definition exception, and the shared-campaign / sender-scope send semantics; add `resolveBusinessBranchScope` to the **Authorization** section and add the three services to the "used by" list.
- `packages/core/CLAUDE.md`: note `BranchesRepository.findIdsByBusiness` and the re-keyed analytics/customers repo method signatures.

## Affected files (indicative)

- `packages/core/src/database/repositories/branches.repository.ts` (+`findIdsByBusiness`)
- `packages/core/src/database/repositories/analytics.repository.ts` (re-key; drop private `getBranchIds`)
- `packages/core/src/database/repositories/customers.repository.ts` (re-key; drop private `getBranchIds`)
- `workers/api/src/core/authorization.ts` (+`resolveBusinessBranchScope`)
- `workers/api/src/modules/analytics/{analytics.service.ts,index.ts}`
- `workers/api/src/modules/customers/{customers.service.ts,index.ts}`
- `workers/api/src/modules/campaigns/{campaigns.service.ts,index.ts}`
- `workers/api/src/types/index.ts` (new `analyticsService`/`customersService`/`campaignsService` context vars) and `workers/api/src/modules/routes.ts` (register the 3 installers). `SharedDeps`/`injectServices` need no change (installers self-construct repos from `db`).
- Tests under `workers/api/src/__tests__/**` and `packages/core` as needed.
