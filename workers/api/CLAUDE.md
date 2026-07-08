# API — agent guide

Stack: **Hono** + **Cloudflare Workers** + **Drizzle ORM** + **D1** (SQLite). Not Bun.serve — this runs on the Cloudflare edge.

## Documentation update policy

- Any feature implementation, refactor, behavior change, API change, schema change, command change, or workflow change must include documentation updates in the same task/PR.
- Update existing docs first (especially [../../docs/README.md](../../docs/README.md), [../../docs/guides/api-query-repository-pattern.md](../../docs/guides/api-query-repository-pattern.md), and related AGENTS/CLAUDE files).
- Any feature implementation or refactor must run lint, tests, and build before completion (`bun run lint`, `bun run api:test`, and `bun run build`, or equivalent scoped commands).
- Do not mark work complete until code and documentation are both updated and consistent.

## Layer order

Route → Service → Repository → DB. No business logic in route handlers.

## Gateway worker split

`workers/api` is the **only public edge**. Domain modules are split across service-bound workers; clients keep calling `/api/v1/*` on the gateway URL.

| Route prefix | Owner | Binding |
| --- | --- | --- |
| `/api/v1/auth/*`, `/api/v1/users/*` | `workers/auth-service` | `AUTH_SERVICE` |
| `/api/v1/services`, `/bookings`, `/team`, `/coupons`, `/reviews`, `/rewards`, `/analytics`, `/campaigns`, `/customers` | `workers/booking-service` | `BOOKING_SERVICE` |
| `/api/v1/products`, `/orders`, `/customer-addresses`, `/payments`, `/khata` | `workers/lpg-service` | `LPG_SERVICE` |
| `/api/v1/businesses`, `/branches`, `/notifications`, `/favourites`, `/demo-requests` | `workers/api` (local) | — |
| `/api/v1/search` | **Vertical dispatcher** — `?vertical=booking` (default) → `BOOKING_SERVICE`; `?vertical=commerce` → `LPG_SERVICE` | both |
| `/api/v1/walk-in` | **Vertical dispatcher** — resolves `branchId → vertical` (D1 + KV `branch:<id>:vertical`, TTL 300 s); fans out `/sync` and fans in `/receipts` across workers | both |

Proxy style in `src/modules/routes.ts`: `apiRoutes.all("/v1/<prefix>/*", (c) => c.env.<BINDING>.fetch(c.req.raw))`.

Booking/commerce business logic, tests, and `AuthorizationService` assertions for those modules live in the respective workers — see [../booking-service/CLAUDE.md](../booking-service/CLAUDE.md) and [../lpg-service/CLAUDE.md](../lpg-service/CLAUDE.md).

## Database migrations

Schema lives in `@repo/core`; migrations output to `src/database/migrations/`. Use drizzle-kit only — edit schema `.ts` first, then `bun run db:generate` in an **interactive terminal**. Every migration must include SQL **and** `meta/NNNN_snapshot.json`. See [../../.cursor/rules/drizzle-migrations.mdc](../../.cursor/rules/drizzle-migrations.mdc).

## Where things live

| Concern                                | Package      | Path                                 |
| -------------------------------------- | ------------ | ------------------------------------ |
| DB schema, repositories, base repo     | `@repo/core` | `packages/core/src/database/`        |
| Job types, QueueProducer               | `@repo/core` | `packages/core/src/queue/`           |
| Email / SMS notifications              | `@repo/core` | `packages/core/src/notifications/`   |
| HTTP DTO types (BaseQueryDto etc.)     | `@repo/core` | `packages/core/src/http/response.ts` |
| Hono app, routes, middleware, services | `@repo/api`  | `workers/api/src/`                   |
| Errors, KV cache, R2 storage           | `@repo/api`  | `workers/api/src/core/`              |

## Module layout

Each domain lives in `src/modules/<name>/`:

```
<name>.routes.ts      # Hono router: validation, auth guards, response shaping
<name>.service.ts     # business logic (availability checks, coupon validation, etc.)
```

Repositories live in `packages/core/src/database/repositories/<name>.repository.ts`.
DB schemas live in `packages/core/src/database/schema/<name>.schema.ts`.

## Auth & RBAC

- `middleware/auth.ts` verifies JWT via `SessionTokens.verify` → sets `c.var.user`
- **Gateway split:** `/api/v1/auth/*` and `/api/v1/users/*` are **proxied** to `workers/auth-service` via the `AUTH_SERVICE` Service Binding so clients keep calling the same public API base URL. Token issuance and user routes live in auth-service — see [../auth-service/CLAUDE.md](../auth-service/CLAUDE.md). This worker keeps `SessionTokens.verify` for local JWT checks on domain routes (`middleware/auth.ts`).
- Gate routes: `requireAuth(["owner"])` or `requireAuth(["owner", "manager"])` from `middleware/auth-guard.ts`; add `{ branchScope: true }` on business-management routes where managers/staff need branch-scope injection into `c.var.scopedBranchIds`. With `branchScope: true`, the guard calls `AUTH_SERVICE` `POST /internal/authorise` to resolve `scopedBranchIds` (owners → `null`, managers/staff → assigned branches).
- Ownership checks (does this user own this resource?) belong in the service, not the route

### Session tokens

`modules/auth/session-tokens.ts` (`SessionTokens`) owns the Talash session token end-to-end — issuing, verifying, and rotating — so the sign rule and the verify rule cannot drift apart. The JWT payload shape (`sub`, `email`, `name`, `role`, `exp`) is **internal** to this module and is never exported across module boundaries.

- `issue(user, device?)` — signs an HS256 access token (15 min TTL) and persists a new refresh token (random UUID, 30 day TTL) via `AuthRepository.createRefreshToken`. Returns `{ user, accessToken, refreshToken, expiresIn }`.
- `verify(token, secret)` — **static**; runs HS256 verification and maps the payload to `AuthUser`. Static so the auth middleware can call it with just `c.env.JWT_SECRET` (no repository). Throws `UnauthorizedError("Invalid or expired token.")` on any failure.
- `rotate(oldRefreshToken, device?)` — validates the presented refresh token (not-found / expired / user-gone all throw `UnauthorizedError`), then **issues the new pair first and deletes the old token after** (documented trade-off: a failed delete leaves both tokens briefly valid; the alternative risks session loss — an atomic D1 batch swap is a follow-up).

`AuthService` constructs a `SessionTokens` from the repo + `JWT_SECRET` it already receives and routes all issuance (`googleSignIn`, `handleGoogleCallback`, `register`, `login`) and rotation (`refresh`) through it. TTLs and HS256 secret usage live only inside `SessionTokens`.

### Google Sign-In flows

Two flows are active. Native Expo builds (mobile-app and owner-app on device) use the **ID-token flow** via `AuthScreenNative.tsx`:

1. The Expo app calls `expo-auth-session`/Google Sign-In natively and receives a Google ID token.
2. The app posts `{ idToken }` to `POST /auth/google/token`.
3. API verifies the RS256 signature against Google's JWKS, calls `findOrCreateUserByGoogle`, and issues Talash `accessToken` + `refreshToken`.

The two Next.js sites (marketing-site, business-dashboard) and the Expo redirect fallback (Expo Go / web) use the **server-side redirect flow** (`GET /auth/google` + `POST /auth/google/callback`):

1. Client calls `GET /auth/google?redirect_uri=<callback>` — API stores a state nonce in KV and returns a Google authorization URL.
2. Client redirects browser / opens in-app browser to that URL.
3. Google redirects to the callback with `?code=&state=`.
4. Client posts `{ code, state, redirect_uri }` to `POST /auth/google/callback`.
5. API validates state, exchanges the code for a Google access token, fetches user profile, calls `findOrCreateUserByGoogle`, and issues Talash `accessToken` + `refreshToken`.

`GOOGLE_CLIENT_ID` supports multiple comma-separated client IDs (web, iOS, Android). `GOOGLE_CLIENT_SECRET` is required for the code exchange in `POST /auth/google/callback`.

### Email / password

`POST /auth/register`, `/login`, `/forgot-password`, `/reset-password` — see [../../docs/guides/email-password-auth.md](../../docs/guides/email-password-auth.md). Password hashes live in `auth_credentials` (PBKDF2-SHA256 via `password-identity.ts`). All sign-in paths converge on `SessionTokens.issue()`. `ALLOWED_RESET_URIS` and `EMAIL_FROM` env vars gate reset links and sender.

#### Sign-in source → role (per-role accounts)

A single Google identity backs **one account per role** — the `users` unique indexes are scoped `(email, role)` / `(phone, role)` / `(googleId, role)` (migration `0010`), so one Gmail can be both a customer `user` and a business `owner` as separate rows. The role is chosen by a **client-declared `source`** field (`modules/auth/sign-in-source.ts`), passed on `POST /auth/google/token` (inline) and `GET /auth/google` (captured into KV state at URL-generation time so it can't be tampered with on the callback):

| `source` | role | Client sending it |
| --- | --- | --- |
| `mobile-app` | `user` | `apps/mobile-app` |
| `marketing-site` | `user` | `sites/marketing-site` |
| `business-app` | `owner` | `sites/business-dashboard`, `apps/owner-app` |

Rules (full rationale in [../../docs/adr/0002-per-role-accounts-via-sign-in-source.md](../../docs/adr/0002-per-role-accounts-via-sign-in-source.md)):

- **`source` is optional; absent ⇒ least-privileged `user`.** Omission can only ever under-provision. A business client that forgets `business-app` fails loud (owner gets a `user` row → `createBusiness` 403), never silently mints an owner. Do **not** change `DEFAULT_SIGN_IN_SOURCE` to a privileged source.
- **`source` may only ever map to a self-service role (`user`/`owner`).** Both are open to any visitor already, so a client choosing its own role is not privilege escalation. `moderator`/`manager`/`staff` are granted **only** by server-side team assignment — never add them to `SOURCE_ROLE_MAP`, or client-declared `source` becomes a privesc vector. A test enforces this.
- **Every client sends `source` explicitly** — the server default is a safety net, not a client contract.
- **Cross-role sign-in is intentional.** A customer signing in on the business-dashboard deliberately gets a fresh empty `owner` account; the API does no cross-role "you already exist as X" lookup. `source` is transient (selects the role, then discarded — not persisted as provenance).

#### GoogleIdentity module + injectable HTTP seam

All Google-protocol identity logic — the highest-risk, least-tested code — lives in `modules/auth/google-identity.ts` (`GoogleIdentity`), behind an **injectable HTTP seam** so the RS256 crypto and the token/userinfo mapping are unit-testable with no real network. `AuthService` depends on this module, not on inline `fetch` calls.

- `type HttpFetch = (url, init?) => Promise<Response>` — the seam. Constructor signature is `new GoogleIdentity(clientId, clientSecret, httpFetch = fetch)`; production uses the global `fetch`, tests inject a fake that returns `new Response(...)`. All three external calls (JWKS, token exchange, userinfo) go through it.
- `verifyIdToken(idToken) → GoogleProfile` — splits the JWT, validates `exp → iss → aud` (short-circuiting **before** the JWKS fetch), fetches Google JWKS, and verifies the RS256 signature.
- `buildAuthUrl(redirectUri, state) → string` — pure URL construction; KV-free (the caller owns the `state` nonce).
- `exchangeCode(code, redirectUri) → GoogleProfile` — token exchange + userinfo via the seam.
- `GoogleProfile` (`{ sub, email, name }`), the issuer/audience validation, the comma-separated multi-platform client-id rule, the "first/web client ID" rule, and the `name ?? email-local-part ?? "User"` fallback all live in the module. Client-id validation is **lazy** (at call time, not in the constructor).

**KV `state` orchestration stays in `AuthService`** (`getGoogleAuthUrl` generates/stores the nonce, `handleGoogleCallback` reads/deletes and validates it), delegating only the Google-protocol pieces (`buildAuthUrl`, `exchangeCode`) to `GoogleIdentity`. Both flows then share the identical `findOrCreateUserByGoogle → sessionTokens.issue` path, so they are byte-identical for clients with no external contract change.

Tested in `__tests__/modules/auth/google-identity.test.ts` with a real `crypto.subtle` RS256 keypair signing tokens that a fake JWKS seam verifies (valid → profile; forged/tampered signature rejected; wrong issuer/audience rejected; `exchangeCode` maps fake token+userinfo to a profile).

## Rate limiting

`middleware/rate-limit.ts` exports `rateLimit({ limit, windowSecs, keyFn? })` — a KV-backed fixed-window limiter. Applied per-IP using the `CF-Connecting-IP` header. Currently active on:

- `GET /auth/google` — 30 req/60 s
- `POST /auth/refresh` — 30 req/60 s
- `POST /auth/google/token` — 20 req/60 s

`POST /auth/google/callback` is intentionally not IP-rate-limited: OAuth state in KV and Google's one-time auth code already protect the exchange; a 20/min per-IP cap caused production sign-in failures (429) for users on shared mobile NAT.

## Session management

`GET /auth/sessions` lists the authenticated user's active refresh token sessions (id, deviceId, deviceName, lastUsedAt, expiresAt). `DELETE /auth/sessions/:id` revokes a specific session. Device info is stored on each refresh token row and populated from the `X-Device-ID` / `X-Device-Name` request headers during `POST /auth/refresh`.

## Request tracing

Hono's built-in `requestId()` middleware (configured in `app.ts`) generates a UUID per request and sets the `X-Request-ID` response header. The ID is available via `c.var.requestId` in all handlers. Queue jobs that trigger from an API call include `requestId` in the payload for cross-service log correlation.

## Booking validation

`BookingsService.create` enforces multiple guards:

1. **Exact slot conflict** — DB partial unique index prevents double-booking the same (branch, service, slot).
2. **Duration-aware overlap** — `countOverlapping` checks if the new booking's time window [slot, slot+duration) overlaps any active booking at the branch.
3. **Working hours** — if `branch_hours` rows exist for the booking day, the slot must fall within `openTime–closeTime` and the branch must not be closed.

## Branches

**Response envelope:** `GET /branches?businessId=` returns `{ data: Branch[], query }` (`PaginatedResponse<Branch>` — all branches for the business as one synthesized page); the single-item routes (`get` / `create` / `update` / `delete`) return `{ data: Branch }` (`SingleResponse<Branch>`). Wrapped via `c.json({ data: … }, N)` with matching `z.object({ data: … })` response schemas. This matches `@repo/api-client` and every consumer (which read `.data`). Do **not** return the raw branch object/array — that was a contract drift (same class as the businesses one) that crashed the mobile business-detail and broke the booking-flow branch list. Hours/availability routes are the exception: `getHours` / `upsertHours` return a raw `BranchHours[]`, `getAvailability` returns a raw `{ date, serviceId, isClosed, slots }`.

## Branch working hours

`GET /branches/:id/hours` returns all `branch_hours` rows for a branch. `PUT /branches/:id/hours` (owner only) upserts rows for one or more days. Each entry has `dayOfWeek` (0=Sun, 6=Sat), `openTime`/`closeTime` (HH:MM), and `isClosed`.

## Reviews

`GET /api/v1/reviews?businessId=` returns published reviews. Each review includes `userName` (reviewer's display name) sourced from a LEFT JOIN on the `users` table in `ReviewsRepository.findPublishedByBusiness` — falls back to `"Guest"` if the user row is deleted. The `Review` type in `@repo/api-client` includes `userName: string`.

`GET /api/v1/reviews/mine` (authenticated, self-scoped) returns the caller's own reviews (Pending + Published, excluding soft-deleted) via `ReviewsRepository.findByUser`, joined with business + service names (`MyReview` shape).

**Response envelope:** `list` (published) returns `{ data: Review[], query }` (`PaginatedResponse<Review>`); `create` / `approve` / `reject` return `{ data: Review }` (`SingleResponse<Review>`). `mine` (`MyReview[]`) and `pending` (`Review[]`) stay **raw arrays** — the api-client types them as bare arrays and consumers read them directly. Match the api-client type per endpoint.

## Staff assignment

`PATCH /bookings/:id/assign` (owner/manager/staff) sets `staffId` on a booking. `staffId` is a nullable FK to `team_members.id`. Pass `{ staffId: null }` to unassign.

## Restore endpoints

Soft-deleted records can be recovered:

- `PATCH /users/:id/restore` — restores a deleted user; **moderator only** (`requireAuth(["moderator"])`)
- `PATCH /businesses/:id/restore` — restores a deleted business; requester must be the original owner

## Delete account

`DELETE /api/v1/users/:id` is authenticated and self-only: the handler asserts `c.var.user.id === id` and returns 403 if they differ. The request body is **required** — exactly one of `{ password: string }` or `{ idToken: string }` (Google ID token from fresh client-side re-auth). `AuthService.verifyAccountAction()` validates the proof before `UsersService.delete()` soft-deletes the row. Rate limit: 5 attempts per 15 minutes per user. `GET /auth/me` exposes `authMethods: { password, google }` so clients can disable unavailable verification options.

The users module splits into three guarded sub-apps: **`selfApp`** (`authenticate`) for `get` / `update` / `delete` / `photo` — each self-only via `c.var.user.id === id`; **`ownerApp`** (`requireAuth(["owner", "moderator"])`) for the `list` enumeration; and **`moderatorApp`** (`requireAuth(["moderator"])`) for `create` and `restore`. All routes require a valid JWT.

**Response envelope:** `get` / `create` / `update` / `delete` return `{ data: User }` (`SingleResponse<User>`); `list` returns `{ data: User[], query }` (already `PaginatedUsersSchema`). `uploadPhoto` returns `{ url }` and `restore` returns a raw `User` (no api-client method) — both stay unenveloped. `create` has no runtime consumer (moderator-only) but is enveloped for module consistency since its api-client generic already declares `SingleResponse`. `UsersService.update` maps the `users.email` / `users.phone` UNIQUE-constraint violations to `ConflictError` (409, "This email/phone number is already in use") so a duplicate contact field returns a readable message instead of a generic 500. Do not add an admin-level delete without an explicit role guard.

`POST /api/v1/users/:id/photo` (authenticated, self-only) is the avatar upload: multipart `file` field, validates content-type (jpeg/png/webp) + size (≤ 5 MB) before any storage call, stores the image in R2 under `users/<id>/<uuid>.<ext>`, sets `users.photoUrl`, and best-effort-deletes the previous object (the old key is derived by stripping any scheme+host from the stored URL — never `new URL()`, so it tolerates legacy scheme-less URLs predating the `PUBLIC_R2_URL` scheme fix). `PUBLIC_R2_URL` must be an absolute `https://` base (see [environment-variables.md](../../docs/guides/environment-variables.md)); `R2Storage` defensively prepends `https://` if it is missing. `photoUrl` is surfaced on the DB-sourced `/me` response (`AuthUserSchema.photoUrl`, optional) and is kept **out of the JWT**.

## Rewards redemption

`POST /rewards/redeem` body: `{ points: number, description?: string }`. Atomically debits points; throws 422 with "Insufficient reward points" if balance is too low.

**Response envelope:** `GET /rewards/history` returns `{ data: RewardTransaction[], query }` (`PaginatedResponse<RewardTransaction>`, single synthesized page). `GET /rewards/balance` (`RewardBalance`) and `POST /rewards/redeem` stay raw objects — the api-client types them raw.

## Team

Owner-only CRUD under `/api/v1/team`. **Response envelope:** `list` returns `{ data: TeamMember[], query }` (`PaginatedResponse<TeamMember>`); `add` / `update` / `remove` return `{ data: TeamMember }` (`SingleResponse<TeamMember>`). The list fix is user-visible — owner-app `context.tsx` and business-dashboard read `(teamQuery.data?.data ?? []).map(...)`, so the raw array silently rendered an empty team list.

## Businesses

Mounted at `/api/v1/businesses` — an intentional public-route rename (the prior path is retired) tracked in ADR-0004 Phase 0; api-client and frontends are updated in later tasks. `BusinessSchema` carries a `vertical` discriminator (`booking` | `commerce`).

**Response envelope:** the single-item routes (`get` / `create` / `update` / `delete` / `restore`) return `{ data: Business }` (`SingleResponse<Business>` in `@repo/api-client`) — wrapped via `c.json({ data: business }, …)` with response schema `z.object({ data: BusinessSchema })`. This matches the list endpoint and every consumer (which read `.data`). Do **not** return the raw business object — that was a contract drift that surfaced as "Business not found" on the customer detail page. Photo routes are the exception: `listPhotos` / `reorderPhotos` return a raw `BusinessPhoto[]`, `uploadPhoto` returns `{ url }`.

- **`vertical` is required on create — no silent default.** `CreateBusinessBodySchema` requires `vertical`; omitting it returns 422 before any DB hit.
- **`vertical` is immutable.** `UpdateBusinessBodySchema` omits it (the schema strips it), and `BusinessesService.update` additionally throws `ValidationError` if `vertical` is present in the payload — a defence-in-depth guard for callers that bypass the route schema.

### Brand palette (white-label)

`BusinessSchema` carries an optional `brandPalette` (`{ primary, accent, foreground, surface }`, all 6-digit hex; `null` ⇒ Talash defaults — see [core `BrandPalette`](../../packages/core/src/database/schema/businesses.schema.ts) + ADR-0003). It is surfaced on the **public** `GET /:id` read (the customer reskin path needs it) and written through the **owner-scoped** `PATCH /:id` (`assertBusinessOwner` enforces that owners cannot theme other businesses; pass `brandPalette: null` to clear). It is also carried on the **search result** rows (`brandPalette` on `BusinessSearchResult`, populated by both the booking and commerce strategies) so the customer app can accent cross-venue list items (#60). Persists via Drizzle `mode: "json"` and rides the `business:<id>` KV cache like any other field.

**WCAG-AA contrast gate (#59).** The route schema validates only hex well-formedness; `BusinessesService.update`/`create` then enforce **WCAG-AA 4.5:1 contrast** on the palette at save (never at customer render — ADR-0003). `modules/businesses/contrast.ts` is the pure core: WCAG relative-luminance + contrast-ratio, and the **six** render pairs (`foreground`/surface, `primary`/surface, white-on-`primary`, ink-on-`accent`, plus the two **#97** derived-ramp pairs `strong`-on-`soft` for subtle buttons / brand badges and white-on-`deep` for `dark` buttons). The derived steps come from `derivePrimaryTints` in **`@repo/tokens`** — the same function the app render boundaries use (`paletteToVars`), so the gate validates exactly the colours that render. A palette with any pair below AA is **rejected** with a `ValidationError` (422) naming the failing pairs and ratios; `brandPalette: null` (revert to defaults) skips the check. The Talash default palette passes its own gate (locked by a test). Tested in `__tests__/modules/businesses/contrast.test.ts` + the service tests.

### Business status transitions

`BusinessesService.update` enforces valid status transitions: `Draft → Active`, `Active → Suspended`, `Suspended → Active`. Any other transition throws 422.

## Coupon date validation

`CouponsService.create` validates that `startsAt < expiresAt` when both are provided.

## Validation helpers

`src/core/http/validation.ts` exports `parseQuery(c, schema)`, `parseBody(c, schema)`, and `formatZodIssues(issues)` — type-safe helpers that throw `ValidationError` (422) on parse failure. `formatZodIssues` joins all Zod issue messages with `"; "` and is shared by `parseQuery`, `parseBody`, and the `createApp()` `defaultHook`.

## Image uploads

All photo-upload paths — user avatar, business / product / service photos — share one validator: `validateImageUpload(file)` in `src/core/storage/image-upload.ts`. It enforces the MIME allowlist (`image/jpeg` · `image/png` · `image/webp`), caps size at **5 MB**, and **derives the stored-object extension from the validated content type — never from the user-supplied `file.name`** (which can be extensionless, junk, or a content-type-confusion vector such as an SVG/HTML payload named `.png`). It throws `ValidationError` (422) on a disallowed type or oversize file. Services call it **after** their ownership/authorization check (so non-owners learn nothing about the upload rules) and before any R2 write. Do not re-derive an extension from `file.name` in a new upload path — call the shared helper.

## App factory

Every `OpenAPIHono` instance must be created via `createApp()` from `src/core/create-app.ts` — never `new OpenAPIHono()` directly. The factory bakes in a `defaultHook` that catches Zod-OpenAPI validation failures and returns a unified **422** response:

```json
{ "ok": false, "code": "VALIDATION_ERROR", "message": "<joined issue messages>" }
```

This ensures all routes share the same error shape for validation failures without per-handler boilerplate.

## Authorization

`AuthorizationService` (`src/core/authorization.ts`) centralises ownership checks for **shell routes still served by this gateway** (`businesses`, `branches`, walk-in dispatch helpers). Booking-vertical checks live in `workers/booking-service`; commerce checks live in `workers/lpg-service`.

Gateway methods:

- `assertBusinessOwner(actorId, businessId)` — actor owns the business
- `assertBranchAccess` / `assertBranchOwner` — branch-level checks

Missing resource → 404; found but not authorized → 403.

**Route handlers** on shell modules must call `c.var.authz` for ownership checks (never inline `business.ownerId !== userId`). **Domain errors** must throw `AppError` subclasses — do not `return c.json({ ok: false, … })` from route handlers (the `errorHandler` maps throws to the unified envelope).

Currently used by gateway shell services: `BusinessesService`, `BranchesService`. Self-scoped (no authz): `FavouritesService`, `DemoRequestsService`, `NotificationsService`.

## Products (commerce vertical)

`/api/v1/products` — branch-scoped CRUD for the LPG/commerce vertical, mirroring the services module. `GET /?branchId=` and `GET /:id` are public; create/update/delete/photo require `owner`/`manager` with branch scope. `ProductsService` chains ownership via `assertProductAccess` (product → branch → business owner). Stock is per branch with a DB `CHECK(stock >= 0)` (the commerce invariant; orders will decrement it atomically). `vertical` on the owning business gates whether this module is surfaced in the UI (see ADR-0004).

**Response envelope (mind the asymmetry):** `get` / `create` / `update` / `delete` return `{ data: Product }` (`SingleResponse<Product>`). **`list` is deliberately NOT enveloped** — it returns a raw `Product[]`, because `@repo/api-client` types `products.list` as `Product[]` and the mobile commerce screens (`OrderDetailSheet`, `CommerceBusinessScreen`, owner-app `productsQuery`) read it as a bare array. Enveloping the list would crash them. By contrast **services** envelopes both single-item (`{ data: Service }`) **and** list (`{ data: Service[], query }`, like branches), and **coupons** envelopes single-item only (its list was already paginated, `validate` stays raw). Match the api-client type per endpoint — don't blanket-envelope.

Full contract and `scopedBranchIds` semantics: see section 18 in [../../docs/guides/api-query-repository-pattern.md](../../docs/guides/api-query-repository-pattern.md).

## Orders (commerce vertical)

`/api/v1/orders` — customer order placement + owner fulfillment queue for the commerce vertical.

### Route table

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/` | User (authenticate) | Place an order; returns 201 with the order snapshot |
| GET | `/` | User (authenticate) | List caller's own orders |
| PATCH | `/:id/cancel` | User (authenticate) | Cancel a Pending/Confirmed order (restores stock) |
| GET | `/branch?branchId=` | Owner/Manager (branchScope) | Fulfillment queue for a branch |
| PATCH | `/:id/status` | Owner/Manager (branchScope) | Advance order through the status machine, or cancel via `status=Cancelled` |
| GET | `/:id` | Owner/Manager (branchScope) | Order detail including line items |

### Atomic placement — `db.batch()` + `CHECK(stock >= 0)`

`OrdersRepository.placeOrder` runs a single `db.batch()` that: decrements each product's stock unconditionally via `stock - quantity`, inserts the `orders` row, and inserts each `order_items` row. The DB-level `CHECK(stock >= 0)` on the `products` table makes oversell impossible: if any decrement would go negative the constraint violation aborts the entire batch — no order row and no partial decrement survive. `OrdersService.create` catches the `CHECK constraint failed` error and maps it to `ConflictError` (409, "One or more items are out of stock"). A `WHERE stock >= qty` conditional would be the trap (the losing batch commits with 0-row match — silent oversell); do not use it.

### Forward-only status machine + cancellation

Forward transitions are **forward-only**: `Pending → Confirmed → OutForDelivery → Delivered`. `ALLOWED_TRANSITIONS` in `OrdersService` enforces this (it never contains `Cancelled`); any non-forward, non-cancel target throws `ValidationError` (422). Setting `status = Delivered` also stamps `deliveredAt`.

**Cancellation** has two entry points that share one restore-aware path (`OrdersService.doCancel`): the customer route `PATCH /:id/cancel` (authorized via `assertCustomerOwnsOrder`) and the owner route `PATCH /:id/status` with `status=Cancelled` (authorized via `assertOrderAccess`). `updateStatus` special-cases `Cancelled` **before** the `ALLOWED_TRANSITIONS` check and delegates to `doCancel` — there is no separate owner `/:id/cancel` route (it would be shadowed by the customer route). `doCancel` is only allowed when the order is `Pending` or `Confirmed` (else 422); it runs `OrdersRepository.cancelAndRestore`, a `db.batch()` that restores each line's stock and flips the status to `Cancelled`. Cancellation is **atomic and idempotent**: `cancelAndRestore` restores stock and flips to `Cancelled` only while the order is `Pending`/`Confirmed` (status-predicated `db.batch()` writes), so a concurrent or duplicate cancel cannot double-restore stock. Forward transitions use a compare-and-swap on the loaded status; a lost race returns `422`. A duplicate cancel on an already-`Cancelled` order is idempotent success. Guest/walk-in orders (`userId` null) are cancelled but enqueue no customer notification.

**Notifications.** Every owner-driven forward transition (via `updateStatus`) and every cancellation (owner or customer, via `doCancel`) enqueues a `notification.order_status_changed` job (`{ orderId, status }`) through the `QueueProducer` injected into `OrdersService` (6th constructor arg, wired in `installOrdersService` from `SharedDeps.queue`). The queue worker creates an in-app notification for the customer and sends an Expo push if the customer has a push token. Notification schema: `notifications.order_id` column (present in the squashed `0000_initial_migration`), `type = "order"` for forward transitions or `"order_cancelled"` for cancellations (a distinct type so the mobile client renders a struck-through-package icon; booking cancellations keep `"cancel"`), `go = "orders"`, `orderId` — surfaced on the notification DTO and `AppNotification` in `@repo/api-client`. Order **placement** does not enqueue a notification.

### Snapshotting

Order placement snapshots `unit_price` from `product.price` at the moment of creation (stored in `order_items.unit_price`); subsequent price changes do not affect placed orders. The delivery address fields (`deliveryLine`, `deliveryArea`, `deliveryCity`, `deliveryLat`, `deliveryLng`) are copied from the customer address at placement; editing or deleting the address later does not affect the order record.

### `business_id` denormalisation

`orders.business_id` is denormalised (stored directly rather than derived via `branch → business`). This keeps the khata debit aggregation query (`Σ delivered order totals per (business, customer)`) index-only on `orders_business_user_idx` with no join. `OrdersService.create` populates it from `branch.businessId` and it must never change after creation. The khata debit aggregation that reads it is **implemented** — see the Payments + Khata sections below.

### Repository query allowlist

`OrdersRepository.findAll` allowlist: `filterable: ["status", "branchId", "businessId", "userId"]`, `sortable: ["createdAt", "total", "status"]`, `searchable: []`.

## Payments (commerce vertical)

`/api/v1/payments` — owner-recorded cash receipts for the khata ledger.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/` | Owner | Record a payment; returns 201 with the payment row |
| DELETE | `/:id` | Owner | Void (soft-delete) a payment; returns 204 |

Auth: both routes require `authenticate`; `PaymentsService` calls `AuthorizationService.assertBusinessOwner(actorId, businessId)` to verify ownership before inserting or voiding. Amount must be a positive integer (validated in the service before the auth check).

**Void = soft-delete.** Setting `deletedAt` excludes the payment from the `Σ payments` leg of the derivation — the balance self-corrects immediately. No hard-delete path exists.

**`payments.order_id` is an audit-only tag** — it lets the owner optionally note which order a cash receipt relates to, but it is **never used in the khata balance derivation** (which is relationship-level: `Σ delivered-order totals − Σ payments` per `(business, customer)`). Do not add code that derives per-order payment allocation from this column.

## Khata (commerce vertical)

`/api/v1/khata` — derived balance view for the owner (no stored balance column).

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/dues?businessId=` | Owner | List all customers with `due > 0` for the business, ordered by due desc |
| GET | `/customers/:userId?businessId=` | Owner | Full per-customer ledger: delivered orders, payment history, `{ due, totalDelivered, totalPaid }` |

Auth: both routes require `authenticate`; `KhataService` calls `AuthorizationService.assertBusinessOwner` before querying.

**Derived balance rule:** `due = Σ delivered-order totals − Σ payments` per `(business, customer)`. There is no `balance` column in the DB — the figure is computed on every request by `KhataRepository.customerDue` via two aggregation queries on `orders` (status = `Delivered`, `deletedAt IS NULL`) and `payments` (`deletedAt IS NULL`). Both legs are covered by dedicated composite indexes (`orders_business_user_idx`, `payments_business_user_idx`). The `payments` table ships in the squashed `0000_initial_migration`.

## Customer Addresses

`/api/v1/customer-addresses` — fully self-scoped address book for authenticated customers. All routes require `authenticate` only (no owner/manager role gate).

### Route table

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/` | User | List caller's addresses |
| POST | `/` | User | Create an address; 201 on success |
| PATCH | `/:id` | User | Update an address (partial; at least one field required) |
| DELETE | `/:id` | User | Delete an address (hard delete via `BaseRepository.deleteOne`) |

### Single-default invariant

If a create or update payload includes `isDefault: true`, `CustomerAddressesService` calls `CustomerAddressesRepository.clearDefault(userId)` first to clear all of the user's other defaults before creating/updating the row. This preserves the invariant that at most one address per user has `isDefault = true`.

## Errors

Throw `AppError` subclasses from `src/core/errors.ts`:
`NotFoundError` · `UnauthorizedError` · `ForbiddenError` · `ConflictError` · `ValidationError` · `TooManyRequestsError` · `GatewayTimeoutError`

Validation errors produced by the `createApp()` `defaultHook` use the shape above (422). `AppError` subclasses are caught by `middleware/exceptions.ts` and mapped to their respective status codes.

## Query & repository

- Parsed query is available via `c.get("parsedQuery")` (set by `middleware/query-parser.ts`)
- Validate with `baseQueryDto` / `paginatedQueryDto` from `@repo/core/src/http/response`
- `BaseRepository` handles sort, search, filters, field selection, soft-delete, and restore (`restoreOne`)
- All `BaseRepository` static methods take `db: DbClient` as first arg — pass `this.db` from the domain repo
- `paginatedQueryDto` accepts optional `cursor` for keyset pagination — see guide section 16
- `BaseRepository.findAll` accepts an optional `QueryAllowlist` (exported from `base.repository.ts`) with three fields:
  - `filterable` — which `?filter[field]=` keys are honored.
  - `searchable` — which columns `?search=` scans. An explicit `?fields=` may **narrow** the search to a subset but is intersected with `searchable`, so it can never widen past the allowlist (a caller can't smuggle a non-searchable PII column in via `fields`).
  - `sortable` — which columns `?sort=` accepts; a request for any other column falls back to the default `(createdAt, id)` order.
  - `selectable` — which columns the list response may return; `?fields=` is intersected with it and an empty intersection floors to the full set (never `SELECT *`), so an internal column never leaks. `UsersRepository` uses it to keep `googleId`/`pushToken` out of `GET /users`.
- **`findAll` is opt-in / safe-by-default:** when a repository passes no allowlist, `findAll` substitutes an empty one (nothing filterable/searchable/sortable) so a new list route can't accidentally expose internal columns. The `undefined`-means-all-columns behavior is retained only for the by-id lookup paths (`findOne`/`updateOne`/`deleteOne`). Define the allowlist as `private static readonly queryAllowlist: QueryAllowlist` and pass it to `BaseRepository.findAll`. See `BusinessesRepository`, `BookingsRepository`, `BranchesRepository`, `CouponsRepository`, and `UsersRepository`; see guide section 19 for full details.
- Full reference: [../../docs/guides/api-query-repository-pattern.md](../../docs/guides/api-query-repository-pattern.md)

## Cursor-based pagination

Pass `?cursor=<token>` on any list endpoint (the token is opaque — pass back the `nextCursor` from the previous page; `""` or omitted = first page). When present, `BaseRepository.findAll` switches to **keyset pagination on the stable composite key `(createdAt, id)`** (no `COUNT(*)`), honoring the requested `sortBy` direction (`asc`/`desc`); a malformed cursor degrades to the first page. Response: `mode: "cursor"`, `nextCursor: <opaque token | null>`, `total: 0`. Requires `createdAt` + `id` columns (every domain table has them via `timestamps()`).

## Health check & timeout

`GET /health` — D1 probe, returns `{ status, db }`, 503 on error. Not guarded by the timeout.
All `/api/*` routes are wrapped in a 15 s `requestTimeout` middleware (`middleware/timeout.ts`) — handlers exceeding the limit throw `GatewayTimeoutError` (504).

## KV caching

`BusinessesService` caches profiles at `business:<id>` with a 5 min TTL. Invalidated on update/delete/restore/photo upload. KV param is optional — tests omit it.

## Analytics

Owner/manager routes under `/api/v1/analytics`:

- `GET /overview?businessId=&range=7|30|90` — booking counts, revenue, new vs returning customers
- `GET /revenue` — daily revenue time series (Completed bookings only)
- `GET /services` — top 10 services by booking count
- `GET /peak` — peak hours heatmap (day × hour, all statuses)
- `GET /earnings?businessId=&range=7|30|90` — reconciled earnings by staff/service/branch + time series (Completed only, discount netted, bucketed by `slot`; staffless bookings → "Unassigned")

## Bookings list

- `GET /api/v1/bookings` — customer's own bookings, returns `{ data: Booking[], query }` (`PaginatedResponse<Booking>`, single synthesized page).
- `GET /api/v1/bookings/branch?branchId=&businessId=&status=&limit=` — owner/manager branch bookings; accepts either `branchId` or `businessId` (returns all branches for the business); returns `{ data: Booking[], query }`. The list caps via `slice(0, limit)`; `query.total`/`query.hasNextPage` reflect the pre-slice count.
- `GET /api/v1/bookings/export?businessId=&status=` — CSV download (`text/csv` attachment), owner/manager auth required.

**Response envelope:** every single-item booking route (`get` / `create` / `confirm` / `complete` / `cancel` / `assign`) returns `{ data: Booking }` (`SingleResponse<Booking>`); both lists return `{ data, query }`. This matches `@repo/api-client` and every consumer (which read `.data`) — returning the raw object/array was a contract drift that rendered the marketing-site booking-detail page "Booking not found". The **paired mobile edit** lives in `apps/mobile-app/src/components/BookingDetailSheet.tsx` (reads `freshQuery.data?.data?.status`). Exceptions: `calendar` returns a raw `CalendarBooking[]`; `export` is CSV.

## Search

`GET /api/v1/search?vertical=booking|commerce&q=&city=&area=&lat=&lng=&category=&minPrice=&maxPrice=&minRating=&sortBy=recommended|rating|price&limit=`

**Gateway dispatcher** (`src/modules/routes.ts`): reads `vertical` (default `"booking"`) and proxies the raw request to `BOOKING_SERVICE` or `LPG_SERVICE`. Each worker implements only its strategy:

- **Booking** (`workers/booking-service`, `booking-strategy.ts`) — Active businesses with `eq(vertical, "booking")`; D1 `LIKE` text search; with `TALASH_AI` and `sortBy=recommended`, re-ranks via Workers AI embeddings.
- **Commerce** (`workers/lpg-service`, `commerce-strategy.ts`) — filters `eq(vertical, "commerce")`; ranks by `area` or device proximity (`lat`/`lng`, Haversine over nearest branch).

Returns `{ data: SearchResultRow[], aiRanked: boolean }` (`result.ts`). `area`, `lat`, `lng` are commerce-only query params.

## Walk-in dispatch

`GET/POST /api/v1/walk-in/*` is handled by `walkInDispatcherApp` in `src/modules/walk-in/` (not a full walk-in implementation). The gateway:

- Resolves `branchId → vertical` via D1 with KV cache (`branch:<id>:vertical`, TTL 300 s)
- Routes single-branch paths (`/context`, `/submit`, `/branch-qr`, `/sessions`) to `BOOKING_SERVICE` or `LPG_SERVICE`
- **`POST /sync`** — splits queued entries by vertical, calls both workers, merges `{ synced }`
- **`GET /receipts`** — calls both workers, merges `{ bookings, orders }`

Booking walk-in logic: [../booking-service/CLAUDE.md](../booking-service/CLAUDE.md). Commerce walk-in: [../lpg-service/CLAUDE.md](../lpg-service/CLAUDE.md). Spec: [../../docs/superpowers/specs/2026-06-12-walk-in-qr-lan-sync-design.md](../../docs/superpowers/specs/2026-06-12-walk-in-qr-lan-sync-design.md).

## Cloudflare bindings

All resource bindings use the `TALASH_` prefix. Defined in `wrangler.jsonc`, typed in `worker-configuration.d.ts`:

| Binding          | Type          | Used for                                              |
| ---------------- | ------------- | ----------------------------------------------------- |
| `TALASH_DB`      | `D1Database`  | Primary database                                      |
| `TALASH_KV`      | `KVNamespace` | Auth session / rate-limit cache / OAuth state         |
| `TALASH_STORAGE` | `R2Bucket`    | File/image storage                                    |
| `TALASH_QUEUE`   | `Queue`       | Job queue producer                                    |
| `TALASH_AI`      | `Ai`          | Optional (search re-ranking runs in booking-service)  |
| `TALASH_EMAIL`   | `SendEmail`   | Currently unused — OTP email was retired; binding kept pending infra cleanup |
| `AUTH_SERVICE`   | Service       | Proxy `/auth`, `/users`                               |
| `LPG_SERVICE`    | Service       | Proxy commerce prefixes + commerce search/walk-in dispatch |
| `BOOKING_SERVICE`| Service       | Proxy booking prefixes + booking search/walk-in dispatch |

## Environment variables

| Variable               | Default | Purpose                                                                        |
| ---------------------- | ------- | ------------------------------------------------------------------------------ |
| `JWT_SECRET`           | —       | Signs access tokens (required)                                                 |
| `GOOGLE_CLIENT_ID`     | —       | Google OAuth client ID (required for Google sign-in; comma-separated for multi-platform) |
| `GOOGLE_CLIENT_SECRET` | —       | Google OAuth client secret — must be in `.dev.vars` locally, never in `wrangler.jsonc` |

## Testing

Two-layer strategy: **service unit tests** (mock repos, test business logic) and **route integration tests** (mock services, test HTTP via `app.request()`). Tests run in Node.js — no Workers runtime.

```sh
bun run test          # run once
bun run test:watch    # watch mode
```

Test files live in `src/__tests__/modules/<name>/`. Key helpers:

- `src/__tests__/helpers/create-test-app.ts` — `createTestApp(services)` factory; registers all module apps including `favouritesApp`, `demoRequestsApp`, `staffAvailabilityApp`
- `src/__tests__/helpers/auth.ts` — `createTestToken()`, `authHeader()`, `TEST_ENV`

**Tests:** `payments` and `khata` each have service + route tests; `khata` additionally has a real-DB integration test (`khata.repository.integration.test.ts`) that verifies the `Σ delivered − Σ payments` derivation SQL against an in-memory SQLite instance (the only check of the actual derivation — the service/route tests mock the repositories).

Full reference: [../../docs/guides/testing.md](../../docs/guides/testing.md)

## Dev

```sh
bun run api:dev              # from monorepo root → http://localhost:8787
bun run booking-service:dev  # required for booking routes locally
bun run auth-service:dev     # required for /auth and /users locally
bun run lpg-service:dev      # required for commerce routes locally
bun run dev:all              # starts auth, lpg, booking, api, queue, scheduled, frontends
bun run api:cf-typegen       # regenerate worker-configuration.d.ts
```
