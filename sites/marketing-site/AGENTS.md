# Marketing Site — agent guide

Customer-facing Next.js web app. Stack: **Next.js 15** + **OpenNext/Cloudflare** + **TanStack Query** + **Tailwind v4**.

**Deployed on Cloudflare Pages** via `open-next.config.ts`. Runtime is the Cloudflare Workers edge (not Node.js).

## Documentation update policy

- Any feature implementation, refactor, or behavior change must include documentation updates in the same task/PR.
- Update this file, `docs/feature-map.md`, and cross-repo docs when affected.
- Run lint, type-check, and build before marking work complete (`bun run lint`, `bun run build` from monorepo root).

## Layout

```
src/app/                  # Next.js app router pages
  page.tsx                # Homepage (server component — renders SearchSection)
  search/                 # /search full-filter search page
  businesses/[id]/            # Business detail (split: page.tsx server + BusinessClient.tsx router + Booking/CommerceBusinessClient.tsx)
  book/[businessId]/         # Booking flow (client component, multi-step)
  bookings/[id]/          # Booking detail / cancellation
  account/                # Profile, sessions, notifications, bookings (composes _components/)
  account/_components/    # ProfileCard (name/phone/member-since), BookingsSection (upcoming/past), partition-bookings, ReviewsSection (my written reviews)
  login/                  # Google OAuth entry
  download/               # App store links (Google Play / App Store via env)
  for-business/           # Lead-gen page with demo request form
src/components/           # Shared UI components
src/hooks/                # useAuth, useToast
src/lib/                  # api.ts, token-store.ts, app-links.ts, search-categories.ts
```

## Key conventions

- **Colour scheme:** `next-themes` via `ColorSchemeProvider` in `Providers` (system default). `Nav` includes `ColorSchemeToggle`. Root `layout.tsx` uses `suppressHydrationWarning` on `<html>`. Dark neutrals/surfaces: `@repo/tokens/dark.css`.
- **No `next/image` for dynamic/remote URLs** — use plain `<img>` for images from R2/external sources. `next/image` requires `width`/`height`/`fill` props and breaks without them. Static local images can still use `<Image>`.
- **Auth**: Google OAuth redirect flow via `api.auth.getGoogleUrl()` → browser redirect → `GET /auth/callback?code=&state=`, plus email/password on `/login` and `/register`. Client auth state lives in a **zustand store** (`src/stores/auth-store.ts`) — the single source of truth for UI auth state (`user` + `status`: `unknown | authenticated | unauthenticated`). `tokenStore` (`@repo/api-client`) holds the raw tokens in **localStorage** (sole credential) and mirrors a **session-hint cookie** (`talash_session`) plus display cache (`talash_user`) for SSR. Root `layout.tsx` reads cookies via `readAuthInitialState()` and passes `initialAuth` into `Providers` → `useAuth()` merges hint + store. `src/middleware.ts` guards `/account` and `/bookings/*`. `bootstrapAuthSession()` rehydrates persist, reconciles with the token, and calls `auth.me()`. After OAuth callback or email/password sign-in, use `window.location.replace` (not `router.replace`). See [ADR 0001](../../docs/adr/0001-marketing-site-auth-state-with-zustand.md) and [email-password-auth.md](../../docs/guides/email-password-auth.md).
- **API client**: `api` from `src/lib/api.ts`. Base URL from `NEXT_PUBLIC_API_URL` env var (defaults to `http://localhost:8787`).
- **Queries**: TanStack Query throughout — `staleTime` of 60–300 s depending on data freshness needed. Use `invalidateQueries` after mutations. Query options live in shared factories (`src/lib/queries.ts`) taking the API caller as a param, so the **server prefetch** (token-less `src/lib/api.server.ts`) and client `useQuery` produce identical keys and hydrate without a refetch. See the business-detail split below and [ui-backend-sync](../../docs/guides/ui-backend-sync.md).

## Business detail page — server/client split

`/businesses/[id]/` is split into two files to support OG metadata:

| File                         | Type                              | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page.tsx`                   | Server component                  | `export const revalidate = 300` (intended ISR). `serverApi` now forwards `next: { revalidate: 300 }` on every read (`ApiClientConfig.next`), but the route still renders **on demand**: it is dynamic regardless (root layout reads `cookies()`), and — more to the point — **no OpenNext incremental-cache override is wired** (`open-next.config.ts`), so on Cloudflare Workers the Data Cache has nowhere to persist across requests. The `next` forwarding only dedupes within a single render until `r2IncrementalCache` (+ an R2 binding + bucket) is added; that is the remaining step to make ISR effective. `generateMetadata` and the body share a per-request `QueryClient` (`getServerQueryClient`) and the token-less `serverApi`, so the OG fetch doubles as the prefetch (no double-fetch). Prefetches business/photos/branches/reviews (`prefetchBusinessDetail`, `allSettled`), then renders `<HydrationBoundary state={dehydrate(qc)}><BusinessClient id={id} /></HydrationBoundary>`. A 404 → `notFound()`; other failures degrade to a client fetch. Per-branch services/hours + favourites stay client-only. |
| `BusinessClient.tsx`         | Client component (`"use client"`) | **Thin vertical router** — fetches the business, reads `vertical`, and delegates to the matching experience via the registry.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `BookingBusinessClient.tsx`  | Client component                  | The booking (salon/spa) experience: business/branches/services/reviews/hours/favourites/coupons/similar-businesses queries.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `CommerceBusinessClient.tsx` | Client component                  | The commerce (LPG) experience — placeholder until #71+.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `businessExperiences.ts`     | Registry                          | `vertical → experience` map (ADR-0004). **Add a vertical here — never branch on `vertical` inside a client.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

**Do not add `"use client"` to `page.tsx`** — it must remain a server component for metadata to work. **Vertical-aware (ADR-0004):** `BusinessClient` picks the experience by `business.vertical` (`booking` default until the fetch resolves, so the common case shows the booking skeleton).

### Tenant brand boundary (#65)

The venue detail page is a **single-tenant** context, so `BusinessClient` wraps the experience in `<BrandThemeBoundary palette={business.brandPalette}>` (`src/components/BrandThemeBoundary.tsx`) — the web mirror of the mobile `vars()` boundary ([ADR-0002](../../docs/adr/0002-themeable-scope-and-boundary.md), #55).

- It overrides the **themeable** custom properties (`--color-primary`, `--color-accent`, `--color-surface`) inline on a `display: contents` wrapper, so descendants' `bg-primary`/`text-primary`/`bg-accent`/`bg-surface` repaint in the venue's brand. `palette={null}` → Talash defaults. **Static roles** (ink/line/status) are never themed; `foreground` is deferred.
- Mapping lives in `src/lib/theme-vars.ts` (`paletteToVars`, `THEMEABLE_VARS`) — the pure, tested core mirroring mobile. Trusts its input (hex + WCAG-AA enforced server-side at save, #59).
- Works because Tailwind v4 emits `bg-primary` as `var(--color-primary)` (`@theme` in `@repo/tokens/theme.css`); the inline override cascades.
- **Venue reskin (#99, #60-equivalent):** the booking flow now carries its own boundary — `book/[businessId]` and `bookings/[id]` each wrap their content in `<BrandThemeBoundary palette={business.brandPalette}>` (palette from the page's own business query), scoped to the route so it never leaks into cross-venue list/search pages. The shared `@repo/ui` Button/Badge brand variants now repaint inside the boundary too (#97 web follow-up — `dark`/`ghost` buttons in the booking flow, `subtle`/`primary`, Badge `primary`; mapped to the same derived role tokens as ui-native, see [ADR-0002](../../docs/adr/0002-themeable-scope-and-boundary.md)). The remaining page-level raw-ramp refs below stay intentionally static. On the detail page, the favourite hover-border migrated to flat `hover:border-primary` (brand on `bg-surface`, a WCAG-AA-gated pair, #59). **Intentionally kept on the raw ramp** (do not flatten without #97's contrast-safe tokens): the back-to-search link and branch-pin icons (`text-primary-{600,700}` on `bg-paper` — not a gated pair, so flat `text-primary` can't guarantee contrast), and the "More in {city}" similar-business card titles (cross-venue — flattening would make a sibling venue adopt the current venue's brand).

## Booking flow — availability API

`/book/[businessId]/page.tsx` loads slots via `api.branches.getAvailability(branchId, { date, serviceId })`:

- Server applies branch hours, past-slot filtering, and booking overlap/conflict rules.
- `isClosed` drives the closed-day message; empty `slots` shows the no-slots copy.

**Do not reimplement slot generation client-side** — use the availability endpoint.

## i18n (light)

`src/lib/i18n.ts` — `t(key)` returns Bengali when `navigator.language` starts with `bn`. Wired on nav “Get the app” CTAs first; expand keys as needed.

## Image handling

- Business cover photos: `coverPhotoUrl` from `api.search.businesses` (`EnrichedSearchResult`).
- Service photos: `s.photoUrl` from the `Service` type — shown as `56×56` thumbnail in service rows on business detail.
- All rendered with plain `<img className="w-full h-full object-cover" />`.
- `Photo` component (`src/components/Photo.tsx`) accepts `uri` prop for a remote URL; falls back to gradient + icon.

## Homepage components

| Component       | Notes                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Hero`          | Collage of top-3 rated businesses fetched client-side via `api.search.businesses({ sortBy: "rating", limit: 3 })`                                            |
| `CategoryStrip` | 6 category tiles; clicking pushes `?category=` to URL                                                                                                        |
| `BusinessGrid`  | Grid of search results; skeleton loading (6 card-shaped pulses); heart button for logged-in users; "View all" → `/search`                                    |
| `SearchSection` | Takes `{q, category, city}` as **props** (NOT `useSearchParams`) so the Hero + grid render server-side; navigation handlers rebuild the URL via `useRouter`. |

**Home is server-rendered (SSR).** `app/page.tsx` is an async server component: it reads `searchParams`, prefetches the grid + Hero queries via `serverApi`/`prefetchHomeDiscovery`, and wraps `SearchSection` in `<HydrationBoundary>`. `SearchSection` must stay prop-driven — re-introducing `useSearchParams()` there brings back the CSR bailout that excludes the grid from SSR HTML. The route is dynamic regardless (root `layout.tsx` reads `cookies()`).

## Similar businesses

`BusinessClient` queries `api.search.businesses({ category, city, limit: 4 })` once the business loads, filters out the current business, and shows up to 3 cards in a "More in {city}" section at the bottom of the page.

## App download & growth

- **Get the app** (`Nav.tsx`) links to `/download`.
- Store URLs: `NEXT_PUBLIC_PLAY_STORE_URL` (default: `talash.bd` on Google Play), optional `NEXT_PUBLIC_APP_STORE_URL`.
- Footer discover/company links point at real routes (not `#` placeholders).
- Footer shows `v{version}` from `package.json` via `src/lib/version.ts`. Bump with `bun run version:bump` or `bun run cli version bump --groups sites` (see [CLI guide](../../docs/guides/cli.md#version-sites-workers-apps)).

## SEO

- Global OG image: `/public/og-default.svg` (referenced in root `layout.tsx`).
- `src/app/sitemap.ts` and `src/app/robots.ts` — set `NEXT_PUBLIC_SITE_URL` in production.
- `src/app/not-found.tsx` — branded 404.

## Query errors

Use `QueryError` (`src/components/QueryError.tsx`) for failed TanStack queries on home grid, search, and business detail — do not show empty states when the API failed.

## OG / business metadata

`generateMetadata` in `businesses/[id]/page.tsx` produces:

- `title`: `{business.name} — Talash`
- `description`: business `description` (truncated to 160 chars) or a generated sentence
- `openGraph.images` + `twitter.images`: first business photo URL if available
- Falls back to empty metadata on any fetch error

## Dev

```sh
bun run marketing-site:dev   # from monorepo root → http://localhost:3000
bun run build                # full monorepo build (includes this site)
```

## Testing

```sh
cd sites/marketing-site && bun run test
```

Tests in `src/__tests__/`. Covers: shared component rendering (e.g. `Stars`).
