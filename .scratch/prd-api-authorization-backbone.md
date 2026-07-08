> Part of the `workers/api` backbone hardening epic (#23). This PRD breaks out finding **F2 (authorization backbone)** as a standalone, AFK-ready unit.

## Problem Statement

As a venue owner, I trust that my data — my venues, branches, services, coupons, bookings, team, and reviews — is visible and editable only by me and the staff I assign. Today that guarantee is enforced by ad-hoc code copied into every service: each method re-resolves the resource up to its owning venue and compares `ownerId` by hand, and manager/staff access is separately re-checked against an assigned-branch list. The same logic appears under different names (`assertAccess`, `assertOwnership`, inline `if (venue.ownerId !== actorId)`) with inconsistent error messages (some return a generic "Forbidden" with no detail). Because the check is a convention rather than a structural guarantee, a single missed or subtly-wrong check exposes one owner's data to another — and this codebase has already shipped cross-venue access bugs of exactly this kind.

From a maintainer's perspective: every new endpoint is a fresh opportunity to forget the check or resolve the ownership chain incorrectly, and there are two parallel route-gating mechanisms (`requireRole` and `requireVenueStaff`) with no single obvious way to authorize a route.

## Solution

Make authorization a property of shared backbone primitives instead of something each service re-derives. Introduce one reusable authorization guard that owns the ownership-resolution chains (resource → owning venue → owner) and the branch-scope rule, exposing a small, consistent API that services call instead of hand-rolling checks. Converge the two route-gating mechanisms into one coherent model. Externally nothing changes — owners and staff see the same access they have today, cross-owner requests still return `403`, missing resources still return `404` — but a forgotten or malformed check stops being possible by construction, and authorization behavior becomes uniform and testable in one place.

## User Stories

1. As a venue owner, I want any read or write to a venue I don't own to be rejected with `403`, so that other owners can never see or change my venue.
2. As a venue owner, I want the same protection on my branches, so that a branch is only manageable by its venue's owner (and assigned staff).
3. As a venue owner, I want the same protection on my services, so that another owner cannot create, edit, or delete services under my branches.
4. As a venue owner, I want the same protection on my coupons, so that coupon configuration is isolated to my venue.
5. As a venue owner, I want the same protection on my bookings, so that another owner cannot view or act on bookings at my branches.
6. As a venue owner, I want the same protection on my team members, so that staff assignments are managed only by me.
7. As a venue owner, I want the same protection on my reviews moderation (approve/reject/list pending), so that only I can moderate reviews for my venue.
8. As a manager, I want my access limited to the branches I'm assigned to, so that I cannot act on branches outside my remit even within the same venue.
9. As a staff member, I want my access limited to my assigned branches, so that I only operate where I'm scheduled.
10. As a venue owner, I want a request for a resource that doesn't exist to return `404`, distinct from a `403` for a resource I'm not allowed to touch, so that error semantics are predictable.
11. As an API consumer, I want a consistent, informative error body when authorization fails, so that I'm not sometimes given a detailed message and sometimes a bare "Forbidden".
12. As a maintainer, I want one shared guard that resolves ownership chains, so that I stop copying `venue.ownerId !== actorId` into every service method.
13. As a maintainer, I want the cross-domain resolution (service → branch → venue → owner, coupon → venue → owner, booking → branch → venue → owner, etc.) defined once, so that a change to the ownership model is made in a single place.
14. As a maintainer, I want one configurable way to gate a route by role and (optionally) inject branch scope, so that I don't have to choose between two similar-but-different middlewares.
15. As a maintainer, I want adding a new owner-scoped endpoint to require an explicit authorization declaration, so that "no check" is a visible omission rather than a silent default.
16. As a security reviewer, I want every owner-scoped service method to route through the shared guard, so that I can audit authorization by reading one module instead of every service.
17. As a security reviewer, I want the branch-scope rule (`scopedBranchIds` null means owner/unrestricted; non-null means limited to listed branches) expressed once, so that its semantics can't drift between modules.
18. As a maintainer, I want the existing test suite to stay green after the refactor, so that the change is provably behavior-preserving where behavior shouldn't change.
19. As a maintainer, I want new tests that assert cross-owner and out-of-scope access are rejected at the HTTP boundary, so that regressions in the shared guard are caught before release.
20. As a venue owner whose manager was unassigned from a branch, I want that manager's access to that branch to stop immediately, so that scope reflects current assignments.

## Implementation Decisions

**A shared authorization guard.**
- Introduce one authorization/ownership guard primitive that centralizes the logic currently duplicated as `assertAccess` (services), `assertOwnership` (team), and inline `ownerId` comparisons (branches, coupons, reviews, bookings, venues).
- It exposes two consistent operations: **owner-access assertion** (does this actor own the venue that ultimately contains this resource?) and **branch-scope assertion** (is this branch within the actor's `scopedBranchIds`, where `null` means unrestricted/owner).
- The guard resolves ownership chains declaratively per resource type rather than each caller re-walking the chain: venue (direct `ownerId`), branch → venue, service → branch → venue, coupon → venue, booking → branch → venue, team member → venue, review → venue.
- It collaborates with the already-shared repositories (venues, branches, services, bookings, coupons, team) that `injectServices` constructs and reuses for cross-domain checks. Services receive the guard as a dependency instead of importing repositories solely to perform ownership lookups.

**Error contract (behavior-preserving).**
- Resource not found → `404` (NotFoundError). Resource found but not owned / out of scope → `403` (ForbiddenError). This matches today's behavior; the change is that the mapping is produced in one place with one consistent, informative message, eliminating the bare `ForbiddenError()` cases.

**Converge the two route gates.**
- Replace the `requireRole` / `requireVenueStaff` split with a single configurable authorization middleware that gates by allowed roles and optionally resolves and injects `scopedBranchIds` for venue-staff routes. Behavior is preserved: role-only routes keep role-only gating; venue-management routes keep branch-scope injection.
- `scopedBranchIds` semantics are fixed and documented: `null` for owners (unrestricted within their venues); the assigned-branch array for managers/staff, sourced from team membership.

**Scope of refactor.**
- Modules whose services currently hand-roll ownership: venues, branches, services, coupons, bookings, reviews, team. Each is migrated to call the shared guard.
- Branch management is currently gated `requireRole("owner")` only (managers excluded) while bookings/services use venue-staff scope. This inconsistency is **surfaced and preserved** under the unified middleware unless the maintainer decides otherwise during triage — changing who can manage branches is a product decision, not part of this refactor.

**Non-goals baked in.**
- No change to the public/unauthenticated read surface. No change to authentication (JWT verification, token shape) or to role definitions. No new roles. No database schema changes.

## Testing Decisions

**What makes a good test here:** assert *external authorization behavior*, not the guard's internals. A good test states "owner B requesting owner A's branch gets `403`" or "a manager not assigned to a branch gets `403` creating a service there" — never "the guard called `branchesRepo.findOne` once". Tests must be able to survive the guard being refactored internally.

**Both seams (per the epic decision):**
- **HTTP-route seam (integration)** — prior art: `*.routes.test.ts` per module, using the `createTestApp` + `createTestToken`/`authHeader` helpers with a mocked service. Use this seam to assert the end-to-end contract: authenticated owner succeeds; different owner gets `403`; missing resource gets `404`; manager/staff out-of-scope gets `403`. The existing bookings route tests already exercise `scopedBranchIds` and are the model.
- **Service/guard seam (unit)** — prior art: `*.service.test.ts` (e.g. the rewards/venues service tests) with mocked repositories. Use this seam to test the guard's resolution chains directly: each resource type resolves to the correct owner; owner mismatch throws `403`; not-found throws `404`; branch-scope `null` vs assigned-array vs out-of-array. Cover every chain (venue, branch, service, coupon, booking, team, review).

**Modules to test:** the shared guard (all resolution chains) plus at least the migrated services with the richest chains (services, bookings, reviews) at both seams. The full existing suite (270+) must stay green; any change required to an existing test is a signal to re-confirm the behavior contract before editing it.

## Out of Scope

- The other backbone findings: F1 (cursor pagination — already has an implementation plan), F3 (error/response envelope), F4 (query-layer field allowlist), F5 (service-injection decoupling).
- Changing *which* roles may perform an action (e.g. whether managers can manage branches) — surfaced but not decided here.
- Authentication, token issuance/verification, OAuth, and role assignment.
- Any database schema or migration change.
- Customer-facing ownership (a customer acting on their own booking) beyond preserving current behavior.
- Rate-limiting, CORS, timeout, and other middleware unrelated to authorization.

## Further Notes

- This finding is the spine of the backbone review: it targets a class of bug already shipped in this codebase (cross-venue access). The shared guard is the structural fix — it makes "forgot the check" and "resolved the chain wrong" hard to do, rather than patching one endpoint at a time.
- The refactor is intended to be behavior-preserving. The strongest signal of success is that the existing suite stays green while new cross-owner/out-of-scope tests pass, and the duplicated `assertAccess`/`assertOwnership`/inline-`ownerId` code collapses into one guard.
- Recommended sequencing for the implementer: build and unit-test the guard against all resolution chains first; migrate one module end-to-end (services or bookings — they exercise both owner and branch-scope paths) to validate the API; then migrate the rest; finally converge the route middleware. Keep each module migration as its own commit so behavior preservation is reviewable per module.
- Coordinate with #23: when this lands, check off F2 there.
