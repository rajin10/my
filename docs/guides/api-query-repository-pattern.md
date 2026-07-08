# API Query + Repository Pattern

This guide documents the current conventions for parsing query parameters, validating inputs, and using the shared repository pattern.

## 1. Global Query Parsing

Query parsing is done once for all requests via middleware:

- File: `workers/api/src/middleware/query-parser.ts`
- Registration: `workers/api/src/app.ts`
- Context key: `parsedQuery`

Behavior:

- Uses `qs` parser through `parseQueryString`.
- Supports comma-separated lists and dotted paths.
- Stores parsed object in `c.set("parsedQuery", ...)`.

## 2. Query DTO Contracts

DTOs are defined in `packages/core/src/http/response.ts` (`@repo/core`).

### BaseQueryDto

- `sort?: string`
- `sortBy?: "asc" | "desc"` (default: `desc`)
- `search?: string`
- `fields?: string[]` (supports comma-separated input)
- `filters?: Record<string, string>` (supports object or JSON string)
- `withDeleted?: boolean` (default: `false`)

### PaginatedQueryDto

Extends `BaseQueryDto` with:

- `page?: number` (coerced, positive, default `1`)
- `limit?: number` (coerced, positive, max `100`, default `10`)

## 3. Route Pattern

Routes should validate `c.get("parsedQuery")` with Zod DTOs.

Example pattern:

1. Parse query with `baseQueryDto.safeParse(...)` or `paginatedQueryDto.safeParse(...)`.
2. Return `422` for invalid query payloads.
3. Parse and validate body with route-specific Zod schema for writes.
4. Call service methods (which delegate to repositories).

Reference implementation:

- `workers/auth-service/src/modules/users/users.routes.ts` (auth-service)
- `workers/api/src/modules/businesses/businesses.routes.ts` (gateway domain module)

## 4. BaseRepository Contract

Shared dynamic logic lives in `packages/core/src/database/repositories/base.repository.ts`.

All domain repositories (`packages/core/src/database/repositories/<name>.repository.ts`) delegate their CRUD to its static methods.

Implemented methods:

- `create`
- `findAll`
- `findOne`
- `updateOne`
- `deleteOne`

### Shared behavior

- Dynamic sort key resolution (`createdAt`, fallback to `id`, then first column)
- Search/filter composition
- Dynamic field selection
- Lookup by one or many keys
- Unified where-clause builder

### Soft-delete behavior

If a table has `deletedAt`:

- Read/update/delete exclude soft-deleted rows by default.
- Pass `withDeleted=true` to include deleted rows in matching logic.
- `deleteOne` performs soft delete by updating `deletedAt` (and `updatedAt` when present).

If a table does not have `deletedAt`:

- `deleteOne` performs hard delete.

## 5. Conventions for New Modules

When adding a new module:

1. Add schema to `packages/core/src/database/schema/<name>.schema.ts` and re-export from `packages/core/src/database/schema/index.ts`.
2. Add repository to `packages/core/src/database/repositories/<name>.repository.ts` using `BaseRepository`.
3. Add service to `workers/api/src/modules/<name>/<name>.service.ts` (HTTP-layer business logic).
4. Add routes to `workers/api/src/modules/<name>/<name>.routes.ts`. Create the Hono app via `createApp()` from `src/core/create-app.ts`.
5. Co-locate the service installer in the module's `workers/api/src/modules/<name>/index.ts`: `export const install<Name>Service: ServiceInstaller = (c, deps) => c.set("<name>Service", new <Name>Service(...))`. `ServiceInstaller` is exported from `middleware/shared-deps.ts`; shared repositories, `authz`, `storage`, `queue`, `kv`, and `env` arrive via `deps` (`SharedDeps`). There is no longer a central `service-factories.ts` — each module owns its wiring.
6. In `workers/api/src/modules/routes.ts`, import the module's app **and** its installer, mount the route, and add the installer to the `serviceInstallers` array passed to `injectServices`. This is the single file edited per module.

### HTTP services (workers/api)

| Service | Module | Auth pattern |
|---|---|---|
| `AnalyticsService` | `analytics` | `assertBusinessOwner` on every method |
| `CustomersService` | `customers` | `assertBusinessOwner` on every method |
| `CampaignsService` | `campaigns` | `assertBusinessOwner`; `send` counts segment recipients |
| `StaffAvailabilityService` | `staff-availability` | `assertTeamMemberAccess` with `scopedBranchIds` |
| `BookingsService` | `bookings` | `assertBranchAccess` / `assertBusinessOwner`; `listByBusiness`, `exportCsv`, `calendar` for staff routes |
| `FavouritesService` | `favourites` | Self-scoped (userId); throws `ConflictError` / `NotFoundError` |
| `DemoRequestsService` | `demo-requests` | Public create; rate limit on route |
| `SearchService` | `search` | Delegates to `bookingSearch` / `commerceSearch` strategies |

## 6. Status Code Conventions

Current route conventions:

- `422`: validation errors for query/body
- `404`: record not found for update/delete operations
- `200`: success responses via `apiResponse` or `paginatedResponse`

If create endpoints require strict REST semantics, return `201` in route handlers.

## 7. Booking slot uniqueness

A partial unique index on `(branch_id, service_id, slot)` where `status IN ('Pending', 'Confirmed')` prevents double-booking at the DB level. If `BookingsRepository.create()` throws a `UNIQUE constraint failed` error, `BookingsService.create()` maps it to a `ConflictError` (409) so the slot race never surfaces as a 500.

## 8. Coupon redemption atomicity

`CouponsRepository.incrementUsage` guards the update with `usedCount < maxUses` in the WHERE clause and returns a boolean indicating whether the row was updated. `CouponsService.applyUsage` throws `ConflictError` if the boolean is false (coupon just hit its limit). In `BookingsService.create`, `applyUsage` fires **before** the booking insert so an exhausted coupon fails cleanly without creating a booking. If the insert subsequently fails (slot race), `revertUsage` compensates.

## 9. Soft-delete and unique indexes

Unique indexes on `users.email`, `users.phone`, `users.googleId`, and `coupons.code` are partial indexes (`WHERE deleted_at IS NULL`) so soft-deleted rows do not block re-registration or re-use of the same value.

## 10. Branch working hours

`branch_hours` table stores per-branch opening hours. Each row covers one `day_of_week` (0=Sun, 6=Sat) with `open_time`/`close_time` (HH:MM strings) and `is_closed`. A unique index on `(branch_id, day_of_week)` prevents duplicates. `BookingsService.create` fetches the hours row for the booking's day and validates the time window if present.

## 11. Staff assignment

`bookings.staff_id` is a nullable FK to `team_members.id` (`ON DELETE SET NULL`). Set via `PATCH /bookings/:id/assign { staffId }`. Owners and managers can assign; staff can assign within their scope.

## 12. One-review-per-booking

A partial unique index `reviews_booking_id_unique ON reviews(booking_id) WHERE booking_id IS NOT NULL` ensures at most one review per booking at the DB level. `ReviewsService.submit` catches the `UNIQUE constraint failed` error and maps it to `ConflictError` (409).

## 13. Business status transitions

`BusinessesService.update` enforces: `Draft → Active`, `Active → Suspended`, `Suspended → Active`. Any other `status` transition in a PATCH body throws `ValidationError` (422).

## 14. Rewards redemption

`POST /rewards/redeem { points, description }` atomically decrements `reward_points.balance` using a `WHERE balance >= points` guard in the UPDATE. Returns `{ newBalance }` on success or throws 422 if insufficient.

## 15. BaseRepository DB injection

`BaseRepository` static methods no longer call `getDB()` internally. All six methods (`create`, `findAll`, `findOne`, `updateOne`, `deleteOne`, `restoreOne`) now accept `db: DbClient` as their first argument.

Domain repositories pass `this.db`:

```ts
async findAll(query: PaginatedQueryDto) {
  return BaseRepository.findAll(this.db, bookingsSchema, query);
}
```

`UsersRepository` now requires a `db` argument in its constructor (previously it was zero-arg). `injectServices` passes the shared `db` instance.

This removes the `cloudflare:workers` ambient dependency from `@repo/core` so the package is runnable in plain Node.js test environments without stubs.

## 16. Cursor-based pagination

List endpoints support keyset (cursor) pagination via the `cursor` query parameter,
in addition to offset pagination (`page`/`limit`).

- Pass `cursor=` (empty string) to request the first page in cursor mode. The response
  includes `query.nextCursor` — an opaque hex token. Pass it back as `cursor` for the
  next page. `nextCursor` is `null` on the last page.
- Cursor mode keysets on `(createdAt, id)` and honors the sort **direction** (`sortBy=asc|desc`).
  It does **not** support sorting by an arbitrary `sort` column — use offset pagination for that.
- A malformed or tampered cursor degrades to the first page rather than erroring.
- `total` and `totalPages` are `0` in cursor mode (no `COUNT(*)`). `page` is ignored.
- Cursor mode is stable under concurrent inserts and preferred for large or fast-changing lists.

Response shape in cursor mode:

```json
{
  "data": [...],
  "query": {
    "mode": "cursor",
    "nextCursor": "<opaque token or null>",
    "hasNextPage": true,
    "total": 0,
    "totalPages": 0
  }
}
```

`BaseRepository.findAll` automatically enters cursor mode when `query.cursor !== undefined`
and both `createdAt` and `id` columns exist on the table. The cursor codec lives in
`packages/core/src/http/cursor.ts` (`encodeCursor`/`decodeCursor`).

## 18. Authorization guard

Owner-scoped service methods must not hand-roll ownership checks. Use the shared
`AuthorizationService` (`workers/api/src/core/authorization.ts`), which is constructed
in `injectServices` and passed as a dependency to services that need it.

It centralizes the ownership-resolution chains and the branch-scope rule:

- `assertBusinessOwner(actorId, businessId)` — actor owns the business; returns the business.
- `assertBranchAccess(actorId, branchId, scopedBranchIds)` — owner (`scopedBranchIds null`)
  owns the business containing the branch, or manager/staff is in the assigned-branch list.
- `assertBranchOwner(actorId, branchId)` — owner-only branch assertion; returns the branch.
- `assertServiceAccess(actorId, serviceId, scopedBranchIds)` — branch-scoped access to a
  service; returns the service.
- `assertBookingAccess(actorId, bookingId, scopedBranchIds)` — branch-scoped access to a
  booking (staff view); returns the booking.
- `assertCustomerOwnsBooking(userId, bookingId)` — customer acting on their own booking;
  returns the booking.
- `assertCouponOwner(actorId, couponId)` — owner-only coupon; returns the coupon.
- `assertReviewOwner(actorId, reviewId)` — owner-only review; returns the review.
- `assertTeamMemberOwner(actorId, memberId)` — owner-only team member; returns the member.

**Contract:** missing resource → 404 (`NotFoundError`); found but not authorized → 403
(`ForbiddenError`). Methods that resolve a resource return it so the caller does not
re-fetch.

**`scopedBranchIds` semantics:** `null` means owner (unrestricted within their businesses);
a non-null array means manager/staff limited to those branch IDs. This rule is defined
once here and must not be re-implemented inline in services.

New owner-scoped endpoints must call the guard rather than comparing `ownerId` inline.

All owner-scoped modules (`services`, `branches`, `coupons`, `team`, `reviews`,
`bookings`) now route through the shared guard. To migrate a future module, follow
the same pattern: characterize the current 403/404 contract in a real-DB test using
`createTestDb` + `seedChain`, then replace inline ownership checks with the
appropriate guard method.

## 19. QueryAllowlist — restricting filterable, searchable, sortable, and selectable columns

`QueryAllowlist` is exported from `packages/core/src/database/repositories/base.repository.ts` and accepted as an optional fourth argument to `BaseRepository.findAll`. It governs the generic list query layer only; `findOne`/`updateOne`/`deleteOne` (by-id lookups) are unaffected.

```ts
export interface QueryAllowlist {
  filterable?: string[]; // allowed ?filter[field]= keys
  searchable?: string[]; // columns ?search= may scan
  sortable?: string[]; // columns ?sort= accepts
  selectable?: string[]; // columns the list response may return
}
```

### Semantics

- **`filterable`**: when set, `?filter[field]=value` requests whose `field` is not in the list are silently ignored (the filter is dropped, not errored).
- **`searchable`**: when set, `?search=` scans only these columns. A caller-supplied `?fields=` is **intersected** with `searchable` — it can narrow the search to a subset but never widen past the allowlist, so a non-searchable column (e.g. PII like `googleId`) can't be reached by smuggling it through `fields`.
- **`sortable`**: when set, `?sort=col` is honored only if `col` is in the list; otherwise the request falls back to the default `(createdAt, id)` order. Sort direction (`sortBy=asc|desc`) is always honored.
- **`selectable`**: when set, the list response projects only these columns, and `?fields=` is **intersected** with them — so an internal column never appears in the response, by default or via `?fields=`. An empty intersection floors to the full `selectable` set; it never falls through to `SELECT *`. Unlike `filterable`/`searchable`, an empty/`undefined` `selectable` means "no projection constraint" (returns all columns), so column-limiting is opt-in. `UsersRepository` uses this to keep `googleId`/`pushToken` out of the user list.
- **Safe by default:** when `findAll` is called with **no** allowlist, it substitutes an empty one — nothing is filterable, searchable, or sortable — so a new list route can't accidentally expose internal columns. Column-level query power is opt-in. (The `undefined`-means-all-columns shortcut survives only on the by-id lookup paths, which don't take an allowlist.)

### Adding an allowlist to a repository

Declare it as `private static readonly queryAllowlist: QueryAllowlist` and pass it to `BaseRepository.findAll`:

```ts
import { BaseRepository, type QueryAllowlist } from "./base.repository";

export class WidgetsRepository {
  constructor(private readonly db: DbClient) {}

  private static readonly queryAllowlist: QueryAllowlist = {
    filterable: ["status", "category"],
    searchable: ["name", "description"],
    sortable: ["createdAt", "name", "status"],
  };

  async findAll(query: PaginatedQueryDto) {
    return BaseRepository.findAll(
      this.db,
      widgetsSchema,
      query,
      WidgetsRepository.queryAllowlist,
    );
  }
}
```

### Repositories with allowlists

| Repository | `filterable` | `searchable` | `sortable` |
|---|---|---|---|
| `BusinessesRepository` | `status`, `city`, `category` | `name`, `description`, `city` | _(default)_ |
| `BookingsRepository` | `status`, `branchId`, `serviceId`, `userId` | _(empty — no freetext search)_ | _(default)_ |
| `BranchesRepository` | `businessId`, `city` | `name`, `city`, `address` | _(default)_ |
| `CouponsRepository` | `businessId`, `status`, `type` | `code` | _(default)_ |
| `UsersRepository` | `role` | `name`, `email`, `phone` | _(default)_ |
| `OrdersRepository` | `status`, `branchId`, `businessId`, `userId` | _(empty — no freetext search)_ | `createdAt`, `total`, `status` |

`OrdersRepository` also owns `order_items` access (via `findItems(orderId)`) and exposes two atomic `db.batch()` methods outside the `BaseRepository` pattern: `placeOrder(order, items)` (decrements stock + inserts order + items in one batch; `CHECK(stock >= 0)` aborts on oversell) and `cancelAndRestore(orderId, items, updatedAt)` (restores stock + sets status to Cancelled in one batch). These batch methods throw the raw constraint error on violation; the service layer maps it to a 409.

> **Note:** `googleId` and `pushToken` are intentionally excluded from `UsersRepository.queryAllowlist` (`filterable`, `searchable`, **and** `selectable`) — they are PII / device credentials and must not be externally filterable, searchable, or returned in the user list. `UsersRepository` declares `selectable: ["id", "name", "email", "phone", "role", "createdAt", "updatedAt"]`, so `GET /users` never returns `googleId`/`pushToken` (by default or via `?fields=`). `GET /users/:id` (a by-id lookup) is not projection-constrained.
>
> `businessId` is included in `CouponsRepository.queryAllowlist.filterable` because `findAllByBusiness` injects it as an internal filter — removing it would silently break business-scoping for that method.
#### Route authorization

All routes that require a signed-in user must gate with `requireAuth` from
`middleware/auth-guard.ts`. There is one function for both use cases:

```ts
// Role-only gate (most routes)
privateApp.use("*", authenticate, requireAuth(["owner"]));

// Role gate + scopedBranchIds injection (business-management routes open to managers/staff)
privateApp.use("*", authenticate, requireAuth(["owner", "manager"], { branchScope: true }));
```

With `branchScope: true`, the middleware calls auth-service
`POST /internal/authorise` via the `AUTH_SERVICE` Service Binding (not
`AuthorizationService.resolveBranchScope` directly) and stores the result in
`c.var.scopedBranchIds`: `null` for owners (unrestricted) or the user's assigned
branch IDs for managers/staff. Services read `scopedBranchIds` to scope their
queries.

Do **not** import from the deleted `middleware/rbac.ts` or `middleware/team-scope.ts`.

## 17. Known Gaps / Future Work

- Add integration tests for `withDeleted`, filters, search, and field projection.
- SMS delivery for `sms.otp` queue jobs is not yet integrated — the queue handler logs a warning and acks without delivery.
- Push notification handlers are not deduplicated across at-most-once vs at-least-once delivery — double delivery sends two pushes (minor UX annoyance, not a data integrity risk; rewards.credit is idempotent).
