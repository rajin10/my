# Marketing-site auth-user account features — design

- **Date:** 2026-06-08
- **Site:** `sites/marketing-site` (`@repo/marketing-site`)
- **Status:** Approved design, grilled — ready for implementation planning
- **Scope shape:** One spec covering **four sequential phases** (0–3). The coupons wallet is **explicitly deferred** to its own future brainstorm.
- **Related:** [ADR 0001 — marketing-site auth state with zustand](../../adr/0001-marketing-site-auth-state-with-zustand.md) records the Phase 0 architecture and its rejected alternatives.

## Context

The customer web app already ships a working authenticated account area:

- `/account` (`src/app/account/page.tsx`) — a single **673-line client component** rendering profile (name edit, email, sign out, delete account), rewards (balance/history/redeem), active sessions (list/revoke), bookings (list/cancel/review), notifications, and saved venues.
- `useAuth()` (`src/hooks/useAuth.ts`) — auth state derived from a **TanStack Query** `["auth","me"]` call, gated behind a `hasToken` flag set in a `useEffect`.
- `tokenStore` (`webTokenStore` from `@repo/api-client`) — **synchronous** localStorage adapter for raw access/refresh tokens; the api-client's `getToken()` reads it inline.
- `Nav` (`src/components/Nav.tsx`) — already swaps "Sign in" for the profile link + notification bell based on `useAuth().user`.
- OAuth callback (`src/app/auth/callback/page.tsx`) sets tokens then redirects; `onUnauthorized` (in `src/lib/api.ts`) clears tokens + redirects to `/login`.

So the requested "profile page + activity + resources" is ~80% already built. This work **adds new auth-user features** on top, plus a **zustand-based auth-state foundation** that the show/hide UI and route guards build on.

### Known pain points this work resolves

- `useAuth`'s `hasToken` is set in a `useEffect`, so the first render always shows logged-out state (flash).
- `signOut` is implemented inconsistently — a full `window.location.href` reload in `useAuth`, a `tokenStore.clearTokens()` + `router.replace` in the account page.
- After the OAuth callback, the `me()` query is not primed, forcing a refetch.

## Goals

Add new authenticated-user capabilities to the marketing site and put auth UI-state on a clean, single-source-of-truth footing.

### In scope

- `sites/marketing-site/src/` — auth store, profile/booking/review components, avatar UI.
- `packages/api-client/src/` — new endpoint methods + type additions (Phases 2–3).
- `workers/api/src/` — new authed routes/services (Phases 2–3).
- `packages/core/src/` — reviews repository method + a users schema migration (Phases 2–3).

### Out of scope

- `sites/business-dashboard`, both Expo apps (they keep their existing auth approach; the zustand store is **marketing-site-local**, not a shared package).
- Coupons wallet (deferred — see below).
- Any change to the OAuth provider flow itself (Google-only stays Google-only).

## Decisions log

| Decision | Choice | Rationale |
|---|---|---|
| Overall goal | Add new features (existing page stays) | User confirmed the existing account page is fine. |
| Auth source of truth | **zustand replaces** the TanStack Query `["auth","me"]` auth path | Single client-side source; avoids the duplicate-state drift trap. |
| Persisted auth | **Persist `user`** via zustand `persist` middleware | No logged-out flash on reload; `auth.me()` revalidates in the background. |
| Token storage | **Keep `tokenStore`** for raw tokens | api-client needs synchronous token access; clean split — tokenStore = credential, zustand = identity/UI. |
| Code structure | **Extract components** under `account/_components/` | The page is already 673 lines; new sections must not push it past 900. Lift existing sections out only as touched. |
| Coupons wallet | **Defer entirely** | No `user_coupon` concept exists; "wallet" is an undefined product decision needing its own spec. |

---

## Phase 0 — Auth state with zustand (foundation)

**Touches:** marketing-site only.

### Components

- **`src/stores/auth-store.ts`** — zustand store.
  - **State:** `user: AuthUser | null`, `status: 'unknown' | 'authenticated' | 'unauthenticated'`.
  - **Actions:** `setUser(user)` (→ `status: 'authenticated'`), `signOut()` (clears `tokenStore`, sets `user: null` / `status: 'unauthenticated'`, clears the query client).
  - **Middleware:** `persist` (localStorage key e.g. `talash-auth`, `partialize` to persist **only `user`**) + `devtools` (dev only).
  - **SSR safety:** treat the first render as `status: 'unknown'` and flip after client hydration (mirrors today's `hasToken`-in-effect behaviour) to avoid a Next hydration mismatch; use the persist `onRehydrateStorage` / a `hasHydrated` flag.
- **`AuthProvider`** (in `src/components/Providers.tsx`) — single bootstrap effect: if `tokenStore.getAccessToken()` exists and `status === 'unknown'`, call `api.auth.me()` → `setUser`, else `signOut`. Replaces per-component query gating.
- **`useAuth` refactor** — becomes a thin selector over the store, returning the same `{ user, isLoading, signOut }` shape so `Nav`, the `/account` guard, and other consumers need minimal edits. `isLoading` = `status === 'unknown'` while a token is present.

### Wiring changes (polish)

- **OAuth callback** (`auth/callback/page.tsx`): after `tokenStore.setTokens(...)`, call `api.auth.me()` → `setUser` before `router.replace(next)` so the store is primed (no post-login refetch).
- **`onUnauthorized`** (`src/lib/api.ts`): call the store's `signOut` so UI state clears alongside tokens.
- **Single `signOut`**: Nav, account page, and `onUnauthorized` all use the store action — no more inconsistent implementations.

### Grilled decisions (see ADR 0001)

- **Token is the sole credential; persisted `user` is a display-only cache.** No token on boot → immediately `unauthenticated`, ignoring any cached `user`.
- **`unknown` renders a neutral Nav slot** (not "Sign in") — server + first client render both emit it, dodging the hydration mismatch and the logged-out flash. `authenticated` is **optimistic** from cache, revalidated silently; a 401 flips to `unauthenticated`.
- **Store stays a pure module.** `signOut()` only clears tokens + resets state. `AuthProvider` subscribes to the `→ unauthenticated` transition and calls `queryClient.clear()` (prevents one user's cached data leaking to the next on a shared browser).
- **Cross-tab logout sync deferred** — a stale tab self-corrects on its next 401.

### Migration points (verified by exploration)

- **Blast radius is contained:** `useAuth` keeps its `{ user, isLoading, signOut }` shape, so its 5 consumers (`Nav`, account, `bookings/[id]`, `VenueClient`, `book/[venueId]`) need no changes. `["auth","me"]` is read only inside `useAuth`.
- **Name-edit refresh:** `account/page.tsx` currently does `invalidateQueries(["auth","me"])` after `users.update`. With the query removed, this **must** become a store refresh (re-call `auth.me()` → `setUser`, or optimistic `setUser({ ...user, name })`) or the renamed user won't reflect.
- **Guard simplification (polish):** the account page's `tokenStore` + `user` + `isLoading` triple-condition redirect can collapse to `status === 'unauthenticated'`.

### Testing

- Unit test the store: `setUser` → authenticated; `signOut` → unauthenticated + tokens cleared.
- Verify `Nav` shows "Sign in" when `status !== 'authenticated'` and the profile link/bell when authenticated.

### Docs

- Update `sites/marketing-site/AGENTS.md` (the **Auth** convention note) to describe the zustand store as the auth source of truth and `tokenStore` as credential-only.

---

## Phase 1 — Profile details + booking tabs

**Touches:** marketing-site only (no backend).

### Profile details

- `auth.me()` / `AuthUser` does **not** include `phone`, so `ProfileCard` fetches the full record via `api.users.get(user.id)` to seed the current **phone** and **"member since"** (`createdAt`).
- Save via `api.users.update(user.id, { phone })` — inline-edit pattern mirroring the existing name edit. The self-scoped `users.update(user.id, …)` path is already proven in the current page (name edit + delete account).
- **Verified:** the `selfApp` in `workers/api/src/modules/users/index.ts` guards `GET /api/v1/users/:id` with `authenticate` + `if (c.var.user.id !== id) throw ForbiddenError`, and `UserSchema` returns `phone`, `createdAt`, `updatedAt`. Zero backend change needed.
- **Phone uniqueness:** `users_phone_idx` is a unique index, so saving a phone already used by another account fails the constraint. The edit form must surface that error ("phone already in use") rather than a generic failure.

### Booking tabs

- Partition the already-fetched bookings into Upcoming/Past with a tab toggle. No new API call (the page already calls `api.bookings.list()`).
- **Partition rule (hybrid, anchored to "will I still attend this?"):**
  - **Upcoming** = status ∈ {`Pending`, `Confirmed`} **AND** `slot ≥ now`.
  - **Past** = everything else (terminal statuses, *or* an elapsed slot regardless of status — so a `Confirmed`-but-elapsed booking drops to Past, where the `Completed`-targeted review CTA already lives).
- **Client-side partition** — the hybrid rule can't be expressed as a server `status` filter (`Confirmed` spans both tabs by date). Deep per-tab pagination is a future enhancement, not built now.
- Sort Upcoming soonest-first, Past most-recent-first.

### Components

- Extract `src/app/account/_components/ProfileCard.tsx` (profile block + new phone/member-since fields).
- Extract `src/app/account/_components/BookingsSection.tsx` (bookings list + Upcoming/Past tabs, including the existing cancel + review flows).

### Testing

- Component render tests for the tab partition logic and the phone edit form.

### Docs

- None required (frontend-only, no new API surface).

---

## Phase 2 — Reviews I've written

**Touches:** `packages/core` + `workers/api` + `packages/api-client` + marketing-site (full vertical slice).

- **core** (`packages/core/src/database/repositories/reviews.repository.ts`): add `listByUser(userId, pagination)` — filter by `reviewsSchema.userId` (the `reviews_user_id_idx` index already exists) **and `deletedAt IS NULL`**, returning **both `Pending` and `Published`** statuses, joining venue + service names, newest-first.
- **api worker** (`workers/api/src/modules/reviews/`): add `reviewsService.listByUser(userId)` and a new route `GET /api/v1/reviews/mine` on the **existing `userApp`** (already `authenticate`-gated, hosts `submit`). `userId` comes from `c.var.user` — self-scoped, no path param to spoof. Today the service only exposes `listPublished(venueId)` and `listPending(ownerId, venueId)`, so this is genuinely net-new.
- **Grilled decision:** the list shows the user's **own Pending reviews** (badged "Awaiting approval") alongside Published — moderation gates *public* visibility on the venue page, not whether the author sees their own review. **Read-only** (no edit/delete — no such endpoint exists; deliberate boundary).
- **api-client** (`packages/api-client/src/endpoints/reviews.ts`): add `listMine({ page?, limit? })`.
- **site:** `src/app/account/_components/ReviewsSection.tsx` — venue name, `Stars` component, review text, date.

### Testing

- api worker: route + service tests for `/reviews/mine` (auth required; returns only the caller's reviews).
- core: repository test for `listByUser` filtering.

### Docs

- `docs/guides/api-endpoints.md` (new route) and `docs/feature-map.md` (new integration). Same PR.

---

## Phase 3 — Profile photo

**Touches:** `packages/core` (schema migration) + `workers/api` + `packages/api-client` + marketing-site.

- **core:** migration adding `photoUrl` (text, nullable) to the `users` table (`packages/core/src/database/schema/users.schema.ts`); generate the Drizzle migration.
- **types** (`packages/api-client/src/types.ts`): add `photoUrl: string | null` to `User` **and** `AuthUser` — additive/backward-compatible (mobile/owner/dashboard consumers ignore it).
- **photoUrl propagation (grilled):** keep `photoUrl` **out of the JWT** (mutable display data). `/me` already reads from the DB (`authService.getUser`), so adding `photoUrl` to the DB projection + `AuthUserSchema` makes a new avatar appear on the next `me()` — **no token refresh needed**. Every handler returning `AuthUserSchema` (login, refresh, `/me`) must populate the field — contained to the auth-service projection.
- **api worker:** `POST /api/v1/users/me/photo` (or `/:id/photo` on the existing `selfApp`) — FormData field name **`file`** (matches the `parseBody` convention), upload via `R2Storage`, set `users.photoUrl`. **Self-only auth** — bind to the authenticated user; do **not** copy the owner-scoped check from venue/service upload.
  - **Storage strategy (grilled):** **random key per upload** (`users/{userId}/{uuid}.{ext}`) **+ best-effort delete of the previous object** (read current `photoUrl` first). Random keys avoid stale-CDN; deleting the old object avoids R2 orphan accumulation (an avatar is single-valued, unlike venue galleries). A failed delete leaves one orphan — acceptable, not a correctness bug.
  - **Upload validation (grilled):** reject content-types outside `image/jpeg | image/png | image/webp`; cap size (~5 MB). No server-side resize (Workers can't without Cloudflare Images). The venue endpoint skips validation; this user-facing one must not.
- **api-client** (`packages/api-client/src/endpoints/users.ts`): add `uploadPhoto(file)`.
- **site:** avatar upload control in `ProfileCard`, photo-or-initials fallback (`Photo` component pattern). Surface the avatar in `Nav` (now that `photoUrl` rides on `AuthUser`).

### Testing

- api worker: upload route test (auth required; writes only the caller's `photoUrl`).
- Manual: upload an image, confirm it renders and survives reload.

### Docs

- `docs/guides/api-endpoints.md` (new route), `docs/feature-map.md`, and `sites/marketing-site/AGENTS.md` / relevant core docs for the schema change. Same PR.

---

## Deferred — Coupons wallet

Dropped from this work by decision. There is **no `user_coupon` / claimed / wallet concept** in the schema today — coupons are strictly per-venue promo codes (`coupons.schema.ts`: `venueId`, `code`, `type`, `value`, `maxUses`, `usedCount`, `status`, `expiresAt`). "Wallet" is therefore a product decision, not an implementation. When revisited, it gets its own brainstorm → spec → plan, choosing among:

1. **Read-only "codes I've used"** — derive from `bookings.couponCode`; feasible today with no new model (a history list, not a wallet).
2. **Claimable codes** — a new `user_coupons` table so users can claim/save codes; significant backend design.
3. **Auto-applied offers** — surface coupons applicable to venues the user booked/favourited; read-only discovery, moderate query work.

---

## Cross-cutting

### Sequencing

Phase 0 first (foundation everything else leans on), then 1 → 2 → 3 in risk-ascending order. Each phase is independently shippable.

### Verification (per phase, before "done")

- `bun run lint`
- `bun run test` (or scoped: `cd sites/marketing-site && bun run test`; `workers/api` vitest for backend phases)
- `bun run build`

### Documentation policy (repo hard rule)

Any API or schema change ships its doc updates in the **same PR**. Phases 2 and 3 each carry explicit docs line items above.

## Open verification points (resolve during planning, not blockers)

- ~~**Phase 1:** self-`GET /api/v1/users/:id` authorisation~~ — **resolved:** `selfApp` guards it; `UserSchema` returns `phone` + `createdAt`.
- **Phase 3:** confirm the R2 storage binding (`TALASH_STORAGE`, `PUBLIC_R2_URL`) is injected for a users-photo route the same way it is for venues/services (`shared-deps` / `services` middleware), and decide the final route shape (`/users/me/photo` vs `/users/:id/photo` on `selfApp`).
