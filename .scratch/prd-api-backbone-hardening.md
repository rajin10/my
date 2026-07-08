## Problem Statement

The `workers/api` worker is built on a thin set of shared backbone primitives — the generic `BaseRepository`, the request query/DTO layer, the auth/RBAC middleware, the service-injection middleware, and the error/response envelope. Every module leans on these, so a defect or gap in the backbone is a defect in every module at once.

A focused review of that backbone surfaced five issues. As a venue owner or customer, the symptoms are:

- **Pagination silently returns the wrong rows.** When a list endpoint is paginated by cursor, "next page" skips and repeats records, so an owner scrolling their bookings or a customer browsing venues can miss items or see duplicates.
- **Cross-owner access keeps slipping through.** Ownership ("does this owner actually own this venue/branch/service?") is re-implemented by hand in every service method. We have already shipped cross-venue access bugs from this pattern. Each new endpoint is another chance to forget the check.
- **Clients get two different error shapes.** A business-rule failure returns `{ ok: false, code, message }`, but a request-validation failure returns Hono's default Zod error shape. The mobile and web clients have to handle both, and adapter code has grown to paper over it.
- **The query layer can expose any column.** Filter/search/sort operate over every column of a table with no allowlist. It is currently contained only because most list routes hand-declare narrow query schemas — a fragile, easy-to-break invariant.
- **Adding a module means editing one central file.** Every service is instantiated in a single fat middleware, so each new module edits a shared chokepoint.

## Solution

Harden the backbone so that correctness and authorization are enforced *by the shared primitives*, not re-derived in each module. From the user's perspective nothing new appears in the product — list endpoints page correctly, cross-owner requests are reliably rejected with `403`, and every error response has the same shape — but the platform stops leaking the same class of bug through every new feature.

This PRD covers all five backbone findings as one hardening epic (F1–F5), sequenced so the highest-severity correctness/authorization fixes land first.

## User Stories

1. As a venue owner, I want cursor-paginated lists to return each record exactly once in a stable order, so that I never miss or double-count my bookings.
2. As a customer, I want to browse venue lists page after page without seeing duplicates or gaps, so that I can trust what I'm scrolling through.
3. As a venue owner, I want list endpoints to honor the `sort`/`sortBy` I requested even when paginating by cursor, so that ordering is consistent across pages.
4. As an API consumer, I want paginated responses to carry correct `hasNextPage`/`nextCursor` metadata under the UUID-keyed schema, so that my client knows when to stop fetching.
5. As a venue owner, I want any attempt to read or modify a venue, branch, service, coupon, or booking I don't own to be rejected with `403`, so that my data is isolated from other owners.
6. As a manager, I want my access scoped to the branches I'm assigned to, enforced consistently, so that I can't act on branches outside my remit.
7. As a platform maintainer, I want ownership enforced by one shared resource-guard primitive instead of hand-written checks in each service, so that a new endpoint can't silently ship without the check.
8. As a platform maintainer, I want the two authorization paths (`requireRole` and `requireVenueStaff`) reconciled into one coherent model, so that route authorship has one obvious way to gate access.
9. As a mobile client developer, I want request-validation failures to return the same `{ ok: false, code, message }` envelope as business-rule errors, so that I have one error-handling path.
10. As a web client developer, I want a single documented error contract for the API, so that adapter code stops growing to reconcile shapes.
11. As an API consumer, I want validation errors to include a machine-readable `code` and a human-readable `message`, so that I can branch on the code and surface the message.
12. As a platform maintainer, I want the generic query layer to only filter/search/sort over an explicit per-resource allowlist, so that a future public list route can't accidentally expose an internal column.
13. As a security reviewer, I want column-level query power to be opt-in per resource rather than on-by-default, so that defense-in-depth doesn't depend on every route author remembering to narrow the schema.
14. As a platform maintainer, I want to add a new module without editing a single central service-injection file, so that modules are decoupled from one another.
15. As a venue owner, I want soft-deleted records to stay excluded from my lists and lookups after these changes, so that deleted data doesn't reappear.
16. As a platform maintainer, I want every backbone change covered by tests at both the HTTP-route and service seams, so that regressions in the shared primitives are caught before they reach a module.
17. As a platform maintainer, I want the existing 270+ test suite to remain green after the refactor, so that the hardening is provably behavior-preserving where behavior shouldn't change.

## Implementation Decisions

**Scope:** Five findings, sequenced by severity. F1 (pagination) and F2 (authorization) are the correctness/security spine and land first; F3 (error contract) is a focused contract change; F4 (query allowlist) and F5 (service-injection coupling) are robustness/decoupling and may be staged last.

**F1 — Cursor pagination keyset (`BaseRepository.findAll`).**
- Primary keys are `text` UUIDs (`crypto.randomUUID()`), so keyset-by-`id` (`WHERE id > cursor ORDER BY id ASC`) is lexicographic over random values — incorrect. Replace with a **stable monotonic keyset on `(createdAt, id)`**, since `createdAt` is `notNull` ISO-8601 on every table via the `timestamps()` helper and `id` is a unique tiebreaker.
- Cursor mode must honor the requested `sort`/`sortBy` rather than hardcoding ascending. The cursor becomes an opaque encoding of the last row's `(createdAt, id)` (existing `stringToHex`/`hexToString` helpers are available for opaque encoding).
- Preserve the "fetch one extra row to detect `hasNextPage`" approach and the offset-mode default. Tables lacking the assumed columns must degrade safely.

**F2 — Authorization backbone.**
- Introduce a reusable **resource-ownership guard** that, given a resource type and an id, loads the resource and asserts the authenticated user owns it (or is an in-scope manager/staff via `scopedBranchIds`), throwing `ForbiddenError`/`NotFoundError` consistently. Services stop hand-rolling `if (resource.ownerId !== ownerId) throw new ForbiddenError(...)`.
- Reconcile the two authorization mechanisms: `requireRole` (pure role gate) and `requireVenueStaff` (role gate + `scopedBranchIds` injection). Define one coherent model — role-gating at the route/middleware layer, resource-ownership via the shared guard at the service entry — and document when each applies.
- Cross-domain ownership (e.g. a service belongs to a branch belongs to a venue belongs to an owner) must resolve through the shared repositories already wired for that purpose, not ad-hoc joins per service.
- Behavior contract is unchanged: unauthorized cross-owner access returns `403`; missing resource returns `404`.

**F3 — Error/response contract.**
- Set a `defaultHook` on the `OpenAPIHono` instances so Zod request-validation failures are converted into the `AppError` envelope (`{ ok: false, code, message }`) with a `VALIDATION_ERROR` code and `422` (matching the existing `ValidationError`), instead of Hono's default Zod error shape.
- Document the unified error contract. Success responses keep their current shapes (`ApiResponse` / `PaginatedResponse`); this change is limited to making *errors* uniform. Any success-envelope unification beyond that is out of scope here.

**F4 — Per-resource query allowlist.**
- The generic filter/search/sort in `BaseRepository` currently spans all columns; expose an explicit **allowlist of queryable/searchable/sortable fields per resource**, so column-level query power is opt-in. Default to a safe (empty or minimal) allowlist when a resource doesn't declare one.
- This is defense-in-depth: it must not change the behavior of routes that already declare narrow query schemas.

**F5 — Service-injection decoupling (`middleware/services.ts`).**
- Reduce the central fat middleware so adding a module doesn't require editing one shared file. Options to evaluate during implementation: a per-module service registration array, or lazy/getter-based instantiation. Instantiation is cheap (no I/O), so the goal is **decoupling**, not performance.
- Lowest priority; may be deferred if F1–F4 consume the slice.

**Cross-cutting:** No change to the public route surface or success-response data shapes except where a finding explicitly requires it. Soft-delete exclusion (`deletedAt is null`) and the existing DTO parsing (`paginatedQueryDto`) semantics are preserved.

## Testing Decisions

**What makes a good test here:** assert *external behavior* of the backbone through the seams modules actually use — HTTP status/body and service return values — not the internals of `BaseRepository` or the guard. A good test says "a cursor list returns each row once in the requested order" or "an owner requesting another owner's venue gets `403`", never "the where-clause array contains N predicates."

**Both seams (per decision):**
- **HTTP-route seam (integration)** — prior art: `workers/api/src/__tests__/modules/<module>/<module>.routes.test.ts`, using `createTestApp` + `createTestToken`/`authHeader` helpers with a mocked service. Use this seam for: validation errors now returning the unified envelope (F3), cross-owner access returning `403` (F2), and role/scope gating. This exercises the real middleware chain.
- **Service seam (unit)** — prior art: `workers/api/src/__tests__/modules/<module>/<module>.service.test.ts`. Use this seam for: the new resource-ownership guard's edge cases (owner vs manager-in-scope vs out-of-scope), and pagination keyset correctness (next-page cursor returns disjoint, correctly-ordered rows; `hasNextPage` accuracy; sort honored).
- **Repository/pagination** — keyset behavior (F1) is logic best pinned at the repository/service seam with representative UUID-keyed fixtures across `createdAt` boundaries, including the tie case where two rows share a `createdAt`.

**Modules to test:** the shared primitives via at least two representative modules that already have both test files (e.g. `venues`, `bookings`), plus any module whose query schema is widened by F4. Keep the existing 270+ suite green; treat any required change to an existing test as a signal to re-confirm the behavior contract.

## Out of Scope

- Unifying the *success* response envelope (adding `ok: true`, normalizing bare-object vs `{data,query}` shapes). F3 covers errors only.
- Rewriting modules' business logic beyond replacing hand-rolled ownership checks with the shared guard.
- Changing the public route surface, URL structure, or auth token format.
- Rate-limiting, CORS, timeout, and secure-headers middleware (not implicated by the findings).
- The static-only `BaseRepository` class shape — biome-ignored with a documented rationale; cosmetic, explicitly not addressed.
- Frontend/`api-client` adapter changes, except as a downstream beneficiary of the unified error contract.

## Further Notes

- Severity order from the review: **F1 (correctness)** and **F2 (authorization)** are the spine — land them first and independently verifiable. F3 is a small, high-value contract fix. F4 and F5 are robustness/decoupling and safe to stage last or split into a follow-up if the slice grows.
- F2 directly targets a class of bug already shipped in this codebase (cross-venue access), per prior audit history — the shared guard is the structural fix, not another point patch.
- F4 is currently *contained, not safe*: only narrow per-route query schemas prevent column exposure. The allowlist makes safety structural so a future public list route can't regress it.
- Implementer should confirm with the maintainer whether F4+F5 stay in this PRD or split into a follow-up once F1–F3 are scoped, to keep the slice shippable.
