# Business Dashboard — agent guide

Owner-facing Next.js web app. Stack: **Next.js 15** + **OpenNext/Cloudflare** + **TanStack Query** + **Tailwind v4**.

**Deployed on Cloudflare Pages** via `open-next.config.ts`. Runtime is the Cloudflare Workers edge (not Node.js).

## Documentation update policy

- Any feature implementation, refactor, or behaviour change must include documentation updates in the same task/PR.
- Update this file, [docs/feature-map.md](../../docs/feature-map.md), and cross-repo docs when affected.
- Run lint, type-check, and build before marking work complete (`bun run lint`, `bun run build` from monorepo root).

## Layout

```
src/app/
  page.tsx                    # Redirect to /overview or /login
  login/                      # Google OAuth entry
  auth/callback/              # OAuth code exchange
  (dashboard)/
    layout.tsx                # Sidebar + Topbar shell; business gate
    onboarding/               # First-time owner setup (business → branch → service)
    overview/                 # Dashboard home
    bookings/                 # Booking list + lifecycle actions
    calendar/                 # Day/week calendar view
    services/                 # Service CRUD + photos
    analytics/                # Revenue, peak hours, review/coupon/staff stats
    reviews/                  # Pending review moderation
    coupons/                  # Coupon management
    customers/                # Customer list + visit history
    campaigns/                # Marketing campaigns
    team/                     # Staff roster + availability
    settings/                 # Branches, hours, business photos, archive
    account/                  # Profile, sessions, delete account
src/components/
  screens/                    # Presentational screens (props in, events out)
  Sidebar.tsx, Topbar.tsx
  data.ts                     # UI types + NAV config
src/hooks/
  useOwnerData.ts             # All owner queries + mutations
src/context/
  toast.tsx                   # Toast provider + useToast
src/lib/
  api.ts, adapters.ts, query-client.ts
```

## Key conventions

- **Colour scheme:** `next-themes` via `ColorSchemeProvider` in `Providers` (system default). `Topbar` includes `ColorSchemeToggle`. Root `layout.tsx` uses `suppressHydrationWarning` on `<html>`. Dark neutrals/surfaces: `@repo/tokens/dark.css`.
- **Screen / page split:** `*Screen.tsx` components are presentational; `app/(dashboard)/*/page.tsx` wires hooks and passes props. Follow this pattern for new features.
- **Hooks:** All API wiring lives in `src/hooks/useOwnerData.ts`. See [ui-backend-sync.md](../../docs/guides/ui-backend-sync.md) for layering rules.
- **Auth:** Google OAuth redirect via `api.auth.getGoogleUrl()` → `/auth/callback` → `api.auth.googleCallback()`. Tokens managed via `webTokenStore` from `@repo/api-client` (re-exported as `tokenStore` from `src/lib/api.ts`); backed by `localStorage`.
- **API client:** `api` from `src/lib/api.ts`. Base URL from `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8787`).
- **Queries:** TanStack Query with `staleTime` 15–60 s for operational data. Use `invalidateQueries` after mutations — not `refetch()`.
- **File uploads:** `FormData.append("file", file)` — the API reads field name `file`, not `photo`.
- **Money:** BDT via `money()` in `data.ts` (`en-BD` locale).

## Owner onboarding

`/onboarding` runs a 3-step wizard (`OnboardingScreen`):

1. `useCreateBusiness` → `api.businesses.create`
2. `useCreateBranch` → `api.branches.create`
3. `useCreateService` → `api.services.create`

Same sequence as `owner-app` `SetupFlow`. Dashboard layout redirects new owners without a business to `/onboarding`.

## Application version

`package.json` `version` is shown in `AppFooter` (`src/components/AppFooter.tsx`) on dashboard, onboarding, and login screens. Bump with `bun run version:bump` or `bun run cli version bump --groups sites` (see [CLI guide](../../docs/guides/cli.md#version-sites-workers-apps)).

## Dashboard shell

`(dashboard)/layout.tsx`:

- Loads `useMyBusiness()` — first business from `api.businesses.list({ limit: 1 })`
- Redirects unauthenticated users to `/login`
- Redirects owners without a business to `/onboarding` (except when already on onboarding)
- Passes `pendingCount` (pending reviews) to sidebar badge

## Navigation

Sidebar routes from `NAV` in `data.ts`: overview, bookings, calendar, services, analytics, reviews, coupons, customers, campaigns, team, settings. Account is in the Topbar.

## Hooks reference (`useOwnerData.ts`)

| Hook | API | Purpose |
| --- | --- | --- |
| `useMyBusiness` | `businesses.list` | Owner's business |
| `useBranches` | `branches.list` | Branches for business |
| `useBranchBookings` | `bookings.listBranch` | Business-scoped bookings |
| `useBookingCalendar` | `bookings.calendar` | Calendar grid |
| `useConfirm/Cancel/Complete/Assign` | booking patches | Lifecycle |
| `useServices` / `useAllBranchServices` | `services.list` | Per-branch services |
| `useCreate/UpdateService` | `services.create/update` | Service CRUD |
| `useUploadServicePhoto` / `useDeleteServicePhoto` | `services.uploadPhoto/deletePhoto` | Service images |
| `useBranchHours` / `useUpsertBranchHours` | `branches.getHours/upsertHours` | Opening hours |
| `useBusinessPhotos` + photo mutations | `businesses.listPhotos`, upload/delete/reorder | Gallery |
| `usePendingReviews` / approve/reject | `reviews.pending`, patch | Moderation |
| `useCoupons` / `useCreateCoupon` | `coupons.*` | Discount codes |
| `useTeam` / add/update | `team.*` | Staff roster |
| `useStaffAvailability` / upsert | `staffAvailability.*` | Per-member schedule |
| `useSearchUsers` | `users.list` | Add-staff user lookup |
| `useNotifications` + mark read | `notifications.*` | In-app feed |
| `useDeleteBusiness` / `useRestoreBusiness` | `businesses.delete/restore` | Archive / restore |
| `useCurrentUser` | `auth.me` | Account page |

## Danger zone patterns

- **Archive business:** `SettingsScreen` — `useDeleteBusiness`, confirmation before mutate
- **Delete account:** `account/page.tsx` — `api.users.delete(userId)`, then logout redirect

## Analytics page

Queries: `api.analytics.overview`, `revenue`, `services`, `peak`, `reviews`, `coupons`, `staff`, `earnings` — all accept `businessId` + `range` (7|30|90).

## Bookings export

`BookingsScreen` can export CSV via `api.bookings.exportCsv` → `Blob` download.

## Dev

```sh
bun run business-dashboard:dev   # from monorepo root → http://localhost:3001 (or next default port)
```

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_API_URL` if not using localhost.

## Testing

```sh
cd sites/business-dashboard && bun run test
```

Tests in `src/__tests__/`. Covers adapter mappings.

## Related docs

- [docs/guides/ui-backend-sync.md](../../docs/guides/ui-backend-sync.md) — wiring conventions
- [docs/guides/api-endpoints.md](../../docs/guides/api-endpoints.md) — full API index
- [apps/owner-app/AGENTS.md](../../apps/owner-app/AGENTS.md) — mobile owner parity reference
