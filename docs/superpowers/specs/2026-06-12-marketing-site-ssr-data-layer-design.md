# Marketing Site — SSR / data-fetching layer

**Status:** Approved (design) · **Date:** 2026-06-12 · **Owner:** Hasib

## Problem

`sites/marketing-site` fetches all page data **client-side** via TanStack Query, so:

- **LCP/perf** — the business-detail hero image and the homepage grid/Hero collage load only *after* JS hydrates and a fetch round-trip completes. `generateMetadata` already fetches business + photos server-side, then **throws them away** and the client refetches both (review finding **#3**).
- **SEO/indexability** — the homepage grid, Hero, and business-detail body never reach the SSR HTML, so crawlers see empty skeletons. The homepage's `SearchSection` reads `useSearchParams()`, which triggers Next's client-side-rendering bailout and suppresses SSR of the whole Hero + grid subtree.
- **Structural root** — there is no server `QueryClient` / `HydrationBoundary`, so even routes with a server component can't hand prefetched data to the client (review "no SSR QueryClient").

## Goal

Introduce a server-side prefetch + hydration layer so high-value surfaces render their data server-side, **while staying inside the existing "TanStack Query throughout" convention** (we add a prefetch in front of the existing client queries; we do **not** move data-fetching into async server components).

Success criteria:

- Business-detail renders business name, meta, and hero image in raw HTML; LCP image served without a client round-trip; double-fetch (#3) eliminated.
- Homepage default (no-filter) Hero + grid render server-side (indexable, fast), route stays static.
- No tokens or auth-gated data on the server; favourite/heart state stays client-only.
- Edge-safe (OpenNext/Cloudflare Workers). _Route-level ISR caching is a follow-up (see B) — not delivered in Phase 1._

## Non-goals

- Rewriting data-fetching into RSC-native async server components (convention break, larger churn).
- Server-rendering filtered/search permutations (low/negative SEO value, would force dynamic rendering).
- Fixing the per-branch `services`/`hours` N+1 (finding #17) — that needs an API aggregate endpoint and belongs to the separate "API contract" track.

## Feasibility (verified)

- `createApi(config: ApiClientConfig)` returns the full `TalashApi`; `ApiClientConfig` has `baseUrl` required and `getToken`/`onUnauthorized`/`tryRefresh` all optional (`packages/api-client/src/client.ts:12-18`, `index.ts:147`). A token-less server caller is `createApi({ baseUrl })` — no `window`/localStorage. Public endpoints never 401, so refresh/`onUnauthorized` never fire server-side.
- Server→client state-passing precedent already exists: `layout.tsx:41` does `readAuthInitialState(await cookies())` → `initialAuth` → `Providers`. Dehydrated query state follows the same seam.
- `dehydrate`/`HydrationBoundary` are pure JS; ISR `revalidate` runs through OpenNext's incremental cache. No Node APIs.

## Architecture — infrastructure (built once)

1. **Server API caller** — `src/lib/api.server.ts` with `import "server-only"`:
   ```ts
   export const serverApi = createApi({ baseUrl: vars.API_URL });
   ```
   Public reads only; kept out of client bundles by `server-only`.

2. **Per-request server QueryClient** — `src/lib/query-client.server.ts`:
   ```ts
   import { cache } from "react";
   export const getServerQueryClient = cache(() => makeQueryClient());
   ```
   One client per request (React `cache()`), shared across that request's prefetches, isolated between requests.

3. **Shared query-options factories** — `src/lib/queries.ts` (no `"use client"`, no `window` imports). Each returns `queryOptions({ queryKey, queryFn, staleTime })` with **keys identical to today's** so server-dehydrated entries match client `useQuery`:
   ```ts
   export const businessQuery = (c: TalashApi, id: string) =>
     queryOptions({ queryKey: ["business", id], queryFn: () => c.businesses.get(id), staleTime: 300_000 });
   export const businessPhotosQuery = (c, id) =>
     queryOptions({ queryKey: ["business-photos", id], queryFn: () => c.businesses.listPhotos(id), staleTime: 300_000 });
   export const branchesQuery = (c, id) =>
     queryOptions({ queryKey: ["branches", id], queryFn: () => c.branches.list(id, { limit: 10 }), staleTime: 300_000 });
   export const reviewsQuery = (c, id) =>
     queryOptions({ queryKey: ["reviews", id], queryFn: () => c.reviews.list({ businessId: id, limit: 20 }), staleTime: 120_000 });
   export const searchBusinessesQuery = (c, params) =>
     queryOptions({ queryKey: ["search", "businesses", params], queryFn: async () => (await c.search.businesses(toApiParams(params))).data.map(adaptBusiness), staleTime: 60_000 });
   export const featuredBusinessesQuery = (c) =>
     queryOptions({ queryKey: ["search", "businesses", { sortBy: "rating", limit: 3 }], queryFn: () => c.search.businesses({ sortBy: "rating", limit: 3 }), staleTime: 600_000 });
   ```
   The factory takes the caller as a param: client components pass browser `api`, server passes `serverApi`. `adaptBusiness` moves from `BusinessGrid` into `src/lib/adapters.ts` (existing adapter convention) and is reused on both sides so the cached shape matches.

4. **HydrationBoundary pattern** — each server page prefetches into `getServerQueryClient()`, then wraps the client subtree in `<HydrationBoundary state={dehydrate(qc)}>`. Client `useQuery(...)` finds data in cache → no round-trip.

**Client-side change is mechanical:** `useQuery({queryKey, queryFn})` → `useQuery(businessQuery(api, id))` etc. Same keys, same behavior, now hydratable.

## B. Business detail — Phase 1 (tracer bullet)

`src/app/businesses/[id]/page.tsx`:

- `export const revalidate = 300;` sets the **intended** ISR window. **Caveat (verified):** the route **renders on demand** — server-rendered, indexable, fast, but **not edge-cached** (the build reports it as `ƒ` Dynamic). Two reasons: (1) the route is dynamic regardless (root layout reads `cookies()`), and (2) — the binding one — **no OpenNext incremental-cache override is wired** (`open-next.config.ts`), so on Cloudflare Workers the Data Cache cannot persist across requests. The SEO/LCP win (data in HTML, no client round-trip) does **not** depend on any of this.
  - **ISR plumbing — done (inert):** `ApiClientConfig.next` now lets a caller forward `next: { revalidate }`, and `serverApi` sets `revalidate: 300` (`api.server.ts`). This is the prerequisite, **proven only at the unit level** (the request forwards `next`) — it is **not** evidence that caching works. Until an incremental cache (`r2IncrementalCache` + an R2 binding + bucket) is wired, the forwarded `revalidate` only dedupes within a single render. Wiring that override + creating the bucket + deploying is the remaining step to make ISR effective (deferred by owner — needs infra provisioning, unverifiable locally).
- A `cache()`-wrapped `loadBusinessBundle(id)` (business + photos via `serverApi`) is called by **both** `generateMetadata` *and* the page body — deduped within the request. The body seeds the QueryClient via `qc.setQueryData(businessQuery(serverApi,id).queryKey, …)` / `businessPhotosQuery` from that already-loaded result (no second fetch) → **eliminates the double-fetch (#3)**.
- Body additionally `prefetchQuery(branchesQuery(serverApi,id))` and `prefetchQuery(reviewsQuery(serverApi,id))` (single calls), then renders `<HydrationBoundary state={dehydrate(qc)}><BusinessClient id={id} /></HydrationBoundary>`.
- **Scope boundary:** per-branch `services`/`hours` stay client-side (server-rendering them is the N+1, finding #17 — out of scope). `favourites/check` stays client-only (auth). So H1, hero image, business meta, branches, and reviews land in SSR HTML; services hydrate after.
- **404:** `businesses.get` 404 → `notFound()` (proper crawler 404, not a soft empty state).

Client edits: `BusinessClient` and `BookingBusinessClient` switch their `["business",id]`/`["business-photos",id]`/`["branches",id]`/`["reviews",id]` `useQuery` calls to the shared factories with browser `api`. Keys unchanged.

## C. Home — Phase 2 ✅ (implemented)

Blocker: the home page wrapped `SearchSection` in `<Suspense>` because it called `useSearchParams()`, forcing the Hero+grid subtree to client-render (CSR bailout) — so the grid never reached the SSR HTML.

**Realization (corrects the spec's earlier "stay static"):** the home route is *already* dynamically rendered (`ƒ` in the build) — the root `layout.tsx` reads `cookies()` via `readAuthInitialState`, which opts every route into dynamic rendering. So "keep home static" was never achievable, and reading `searchParams` server-side adds **no** caching cost.

**Built:** the home `page.tsx` reads `searchParams` server-side, derives `{q, category, city}`, prefetches `searchBusinessesQuery({q,category,city})` + `featuredBusinessesQuery()` (`prefetchHomeDiscovery`, `allSettled`), then renders `<HydrationBoundary>` around `SearchSection`. `SearchSection` now takes `{q, category, city}` as **props** instead of calling `useSearchParams()` (navigation handlers use `useRouter` + rebuild the URL from props), removing the bailout; the `<Suspense>` wrapper is gone. Hero/CategoryStrip/BusinessGrid render server-side from the prefetched cache for the current URL state; filter clicks `router.push` → the dynamic route re-renders server-side with the new state.

**Verified live (default + filtered):** Hero, the grid, and CategoryStrip all appear in the raw SSR HTML.
- **Default `/`** → grid renders the non-filtering branch (`Curated for you` / `Editor's picks` / `Businesses coming soon`), **no loading skeleton** (zero `animate-pulse`), proving the prefetch hydrated server-side rather than falling through to `isLoading`.
- **Filtered `/?category=Spa & massage`** → grid flips to the filtering branch (`Results` / `No businesses match your search`) and the `<h2>` interpolates the literal category (`0 businesses · Spa &amp; massage`) into raw HTML — proving the full `searchParams → props → SearchSection → BusinessGrid` chain renders server-side, not just the default input. Still zero `animate-pulse`.

## D. Search — Phase 3 (optional)

Leave client-driven, or add a light default prefetch for first paint. Low priority — filter permutations should not be indexed.

## Cross-cutting

- **Error handling:** prefetches use `Promise.allSettled`; a failed prefetch (API down) falls through to the existing client fetch + `QueryError` retry UI — no page crash. Business 404 is the one hard-fail → `notFound()`.
- **Edge/OpenNext:** `server-only` keeps `serverApi` out of client bundles; ISR via OpenNext incremental cache; no Node APIs.
- **Auth:** nothing auth-gated is prefetched; no tokens server-side. Favourite heart hydrates post-mount exactly as today (no change to the existing client-only auth behavior).
- **Freshness:** prefetched queries carry their `staleTime`; client paints instantly from cache, then background-refetches per `staleTime`.

## Testing

- **Unit:** query-options factories (key/param correctness), `adaptBusiness` after the move, `serverApi` is token-less.
- **Hydration contract (load-bearing):** render `BusinessClient` with a `QueryClient` pre-seeded via the factory keys → assert **no network fetch fires** (proves dehydration dedup). Fits the existing vitest + RTL + jsdom setup.
- **Manual/Lighthouse:** `curl <url> | grep` for business name + hero in raw HTML; confirm LCP improves. (Full RSC-HTML assertions are awkward in vitest; the hydration-contract test covers the dedup guarantee.)

## Phasing

- **Phase 1** ✅ — infrastructure + business-detail.
- **Phase 2** ✅ — home Hero + grid SSR (prop-driven `SearchSection`).
- **Phase 3** — search (optional, not started).

## Deferred decisions (not Phase-1 blockers)

1. ~~**Home depth (Phase 2):** full default-grid SSR vs. lighter prefetch-and-hydrate.~~ **Resolved:** full SSR — and since the route is already dynamic (layout reads cookies), `searchParams` is read server-side and *all* filter states SSR (not just the default), at no extra caching cost.
2. **Business-detail services in SSR:** left client-side to avoid worsening the N+1; revisit if/when the API aggregate endpoint lands (separate "API contract" track).

## Documentation impact (per repo policy)

Update on implementation: `sites/marketing-site/AGENTS.md` (data-fetching conventions, server caller, ISR), `docs/guides/ui-backend-sync.md` (server prefetch + HydrationBoundary pattern), and `docs/feature-map.md` if applicable.

## References

- Review findings #3, #15/#16, "no SSR QueryClient", #17 (N+1, out of scope).
- `packages/api-client/src/client.ts:12-18`, `index.ts:147` (`createApi`).
- `sites/marketing-site/src/app/layout.tsx:41` (server→client state precedent).
- TanStack Query v5 Advanced SSR (`queryOptions`, `dehydrate`, `HydrationBoundary`, `cache()`).
