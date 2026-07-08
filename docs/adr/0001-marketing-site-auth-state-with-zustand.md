# Marketing-site auth state: zustand store with token as sole credential

- **Status:** accepted
- **Date:** 2026-06-08
- **Scope:** `sites/marketing-site` only (not the Expo apps or business-dashboard)

## Decision

The marketing site's client-side auth state lives in a **zustand store** (`src/stores/auth-store.ts`) that replaces the previous TanStack Query `["auth","me"]` path as the single source of truth for UI auth state. The store holds `user` and `status` (`'unknown' | 'authenticated' | 'unauthenticated'`), with `persist` + `devtools` middleware.

Four rules govern it:

1. **The token is the sole credential; the persisted `user` and auth cookies are display-only caches.** `tokenStore` (synchronous `localStorage` adapter in `@repo/api-client`) remains the credential store because the api-client reads it synchronously. `webTokenStore` also sets a **`talash_session` hint cookie** (and `talash_user` display cookie after `auth.me()`) so SSR/middleware can detect a likely session before client boot. JWTs are never stored in cookies. A persisted `user` or cookie hint is never trusted without a live token — on boot, no token means immediately `unauthenticated` and cookies are cleared.
2. **`unknown` renders a neutral UI slot unless the session-hint cookie is present.** Without a cookie hint, the server and first client render emit `unknown`, so the Nav renders a neutral placeholder — never "Sign in" — until persist rehydrates. With a hint cookie (and optional `talash_user` display cookie), `useAuth()` treats the session as `authenticated` optimistically on the first paint while `auth.me()` revalidates; a 401 clears tokens and cookies. Middleware redirects unauthenticated requests away from `/account` and `/bookings/*` before HTML is sent.
3. **The store is a pure module; query-cache purging happens in React.** `signOut()` only clears tokens and resets store state. A subscription in `AuthProvider` watches the `→ unauthenticated` transition and calls `queryClient.clear()` (so one user's cached bookings/rewards can't leak to the next on a shared browser). `onUnauthorized` in `src/lib/api.ts` calls the store's `signOut()`, funnelling every logout path through one action.
4. **Cross-tab logout sync is deliberately deferred.** Tabs are not kept in lockstep; a stale tab self-corrects when its next authenticated request 401s. Revisit only if a real complaint surfaces.

## Considered options

- **Keep TanStack Query as the auth source and mirror into zustand.** Rejected: two sources of auth truth that can drift — the duplication trap.
- **Trust persisted `user` as `authenticated` without revalidation.** Rejected: faster, but the UI can assert a logged-in state behind a dead token.
- **Inject `queryClient` into the store** so `signOut` purges the cache directly. Rejected: adds hidden global mutable state to the store and complicates its unit tests.

## Consequences

- `auth.me()` runs once per full load to revalidate (one extra request); acceptable for the freshness guarantee.
- The store is unit-testable with no React or query-client setup.
- Returning users see ~1 frame of neutral nav before Profile appears — imperceptible, and the deliberate cost of avoiding a wrong-state flash.
