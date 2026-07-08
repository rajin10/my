# Plan: Mobile UI ↔ Backend Sync — Multi-Phase Rollout

> **Archived (complete, June 2026).** Living conventions: [ui-backend-sync.md](../guides/ui-backend-sync.md). Index: [docs/README.md](../README.md).

> **Status:** Complete — customer A1–A5 and owner B1–B6 implemented. Post-rollout: calendar day-view cards are tappable (`BookingDetailSheet`), `adaptCalendarBooking` adapter added.

## Context

The backend (`workers/api`) and `@repo/api-client` are fully implemented. The two Next.js sites are wired end-to-end. The gap is now entirely in the **Expo apps**:

| App | Path | Audience | Primary state |
| --- | --- | --- | --- |
| Customer app | `apps/mobile-app` | Bookers | Monolithic `AppProvider` in `context.tsx` |
| Owner app | `apps/owner-app` | Venue operators | Monolithic `AppProvider` in `context.tsx` |

Both apps share `@repo/api-client`, SecureStore token storage, React Query, and Google sign-in (`auth.googleSignIn`). Neither app follows the web layering pattern (dedicated hooks file → screen → route) consistently — logic is split between `context.tsx` and orphaned hook files.

### Current sync snapshot

| Area | mobile-app | owner-app | Web reference |
| --- | --- | --- | --- |
| Auth sign-in/out | ✓ Google + logout | ✓ Google + logout | ✓ |
| Auth session restore (`auth.me`) | ✓ | ✓ (via venue check) | ✓ marketing-site |
| Active sessions UI | ✓ | ✗ | ✓ marketing-site |
| Search / discovery | ✓ `search.venues` | — | ✓ |
| Venue detail (branches + services) | ✓ `useVenueDetail` | △ partial | ✓ marketing-site |
| Booking **create** | ✓ `api.bookings.create` | — | ✓ marketing-site |
| Booking list / cancel | ✓ (labels still weak) | ✓ | ✓ |
| Booking complete / assign | — | ✓ (Today/Bookings/Calendar cards + `BookingDetailSheet`) | ✓ business-dashboard |
| Coupons validate at checkout | ✓ `coupons.validate` | — | ✓ marketing-site |
| Rewards balance / history | ✓ | — | ✓ |
| Rewards redeem | ✓ | — | ✓ marketing-site |
| Reviews list + create | ✓ | ✓ approve/reject | ✓ |
| Owner onboarding persist | — | ✓ `goLive()` → API | ✓ business-dashboard |
| Venue / branch settings | — | ✓ update/delete + hours | ✓ business-dashboard |
| Analytics / customers | — | ✓ | ✓ business-dashboard |
| Campaigns | — | ✓ | ✓ business-dashboard |
| Branch working hours | — | ✓ | ✓ business-dashboard |
| Active sessions UI (owner) | — | ✓ | ✓ marketing-site |
| Auth session restore (owner) | — | ✓ `auth.me` | ✓ marketing-site |

**Critical blockers (resolved in A1–A3 / B1–B2)**

1. ~~**mobile-app:** `confirmBooking()` never calls API~~ — fixed; venue detail loads via `useVenueDetail`.
2. ~~**owner-app:** `goLive()` local-only~~ — fixed; branches sync from `api.branches.list`.

**Rollout complete.** Optional follow-ups: richer booking customer names when branch list omits `customerName`.

### Out of scope (no backend API today)
- ~~**Favourites** — local-only; no favourites module~~ — **implemented** (June 2026): server-synced via `/v1/favourites`; `useFavouriteVenues` hook in mobile-app; `FavouritesScreen` uses hook; see [ui-backend-sync.md](../guides/ui-backend-sync.md)
- **Chat / call** in owner-app (`comms.tsx`) — mock UI
- **OTP / email-password auth** — Google-only by design ([apps/mobile-app/AGENTS.md](apps/mobile-app/AGENTS.md), [apps/owner-app/AGENTS.md](apps/owner-app/AGENTS.md))
- **Customer profile edit** via `users.update` — admin-oriented endpoint; defer unless a customer self-service route is added to the API

---

## Cross-cutting rules (both apps)

Apply on every phase:

1. **API client → hook/mutation → screen → route** — add missing client methods first (most already exist).
2. **Cache invalidation via `queryClient.invalidateQueries()`** — never `refetch()` on query results.
3. **FormData uploads** — venue/service photos use field name `file` (API expects `file`, not `photo`). Do not set `Content-Type` manually.
4. **Query param creates** — `branches.create` and `services.create` pass `venueId` / `branchId` as query params (already fixed in api-client).
5. **401 handling** — keep existing `onUnauthorized` → clear tokens → navigate to sign-in; invalidate query cache on sign-out.
6. **Prefer hooks over growing `context.tsx`** — extract new queries/mutations into `src/hooks/useCustomerData.ts` (mobile) or extend `src/hooks/useOwnerData.ts` (owner); context should orchestrate navigation and compose hooks, not duplicate them.
7. **Adapters** — add `src/lib/adapters.ts` per app (mirror `sites/business-dashboard/src/lib/adapters.ts`) for API → UI type mapping; stop inlining adapters in context.
8. **Documentation** — update app `AGENTS.md` and [ui-backend-sync.md](../guides/ui-backend-sync.md) in the same PR as each phase.

### Shared query keys (align with web)

| Key | Used for |
| --- | --- |
| `["venue", "owner"]` | Owner's first venue |
| `["branches", venueId]` | Branch list |
| `["services", branchId]` | Services per branch |
| `["bookings"]` / `["bookings", "branch", venueId]` | Owner branch bookings |
| `["my-bookings"]` | Customer bookings (infinite pages) |
| `["rewards", "balance"]` / `["rewards", "history"]` | Rewards |
| `["auth", "sessions"]` | Active sessions |

---

## Part A — Customer app (`apps/mobile-app`)

Phases ordered by user impact. Each phase is independently shippable; implement in order.

---

### Phase A1 — Auth hydration & session restore

**Goal:** Signed-in users stay signed in across app restarts; account tab reflects token state.

| Gap | Change | File |
| --- | --- | --- |
| Token present but UI shows signed out | On mount: if token → `api.auth.me()` → set user state | `src/context.tsx` or new `src/hooks/useAuth.ts` |
| Account gated on stale local user | Gate authenticated UI on token + `me` query, not only post-sign-in state | `src/components/screens/AccountScreen.tsx` |
| Duplicate unused hook | Wire or delete | `src/hooks/useBookings.ts`, `src/hooks/useRewards.ts` |

**Pattern:** Mirror `sites/marketing-site/src/hooks/useAuth.ts`.

**Verify:** Kill app with valid token → relaunch → Account shows profile without re-sign-in.

---

### Phase A2 — Venue detail (branches + services)

**Goal:** Tapping a search result loads a bookable venue menu.

| Gap | Change | File |
| --- | --- | --- |
| Search adapter stubs empty branches/services | New `useVenueDetail(venueId)` — parallel `venues.get`, `branches.list`, `services.list`, `reviews.list` | `src/hooks/useVenueDetail.ts` |
| Venue screen shows empty menu | Bind hook data to branch/service UI; pass real IDs into booking flow | `src/components/screens/VenueScreen.tsx` |
| Photos empty | Map `venue.photos` / API image URLs into `PhotoGallery` | same |
| Search adapter | Stop zeroing branches/services in `adaptVenue` when detail hook will load them | `src/hooks/useVenueSearch.ts` |

**Verify:** Search → open venue → see real branches and services from API.

---

### Phase A3 — Real booking flow

**Goal:** End-to-end booking creation matches marketing-site checkout.

| Gap | Change | File |
| --- | --- | --- |
| Local-only confirm | Replace `confirmBooking` with `api.bookings.create` mutation; body: `{ serviceId, branchId, venueId, slot, couponCode? }` | `src/context.tsx` |
| Hardcoded slots | Generate slot grid from selected date + service duration (mirror marketing-site `generateSlots` logic) | `src/components/screens/BookingScreen.tsx` |
| Fake coupon | `useMutation` → `api.coupons.validate({ code, venueId })`; pass `couponCode` on create | same |
| Confirm screen | Show API booking id / status | `src/components/screens/ConfirmScreen.tsx` |
| Local booking fallback | Remove merge of `localBookings` when API is available; require auth to book | `src/context.tsx` |

**Reference:** `sites/marketing-site/src/app/book/[venueId]/page.tsx`

**Verify:** Network tab shows `POST /api/v1/bookings` with ISO slot; booking appears in Bookings tab and marketing-site account.

---

### Phase A4 — Bookings list, reviews & rewards parity

**Goal:** Match marketing-site account behaviour.

| Gap | Change | File |
| --- | --- | --- |
| Blank venue/service names in list | Enrich `adaptApiBooking` — batch-fetch or cache `venues.get` / `services.get` / `branches.get` by IDs from list rows | `src/lib/adapters.ts`, `src/context.tsx` |
| Cancel optimistic update wrong shape | Fix infinite-query page update in cancel mutation | `src/context.tsx` |
| Review on Confirmed not Completed | Move review CTA to **Completed** rows; add Completed to upcoming/past filters | `src/components/screens/BookingsScreen.tsx` |
| Reviewed state lost on restart | Derive from API or persist reviewed booking IDs in SecureStore | `src/context.tsx` |
| No rewards redeem | Redeem input + `api.rewards.redeem`; invalidate balance + history | `src/components/screens/RewardsScreen.tsx` |
| Unused rewards hook | Wire into screen or delete | `src/hooks/useRewards.ts` |

**Verify:** Cancel updates list correctly; review only on completed bookings; redeem reduces balance.

---

### Phase A5 — Sessions & account polish

**Goal:** Security parity with marketing-site account page.

| Gap | Change | File |
| --- | --- | --- |
| No sessions UI | Query `auth.listSessions()`; revoke button per row (`deviceName ?? deviceId`) | `src/components/screens/AccountScreen.tsx` |
| Notifications bell always empty | Hide bell or show honest empty state until notifications API exists | `src/components/screens/SearchScreen.tsx`, `NotificationsScreen.tsx` |

**Verify:** Sessions list shows device names; revoke removes session server-side.

---

## Part B — Owner app (`apps/owner-app`)

Phases ordered by user impact. Implement in order — later phases assume venue exists in the API.

---

### Phase B1 — API-backed setup (onboarding)

**Goal:** New owners persist venue, branch, and service to the backend — mirror web `OnboardingScreen`.

| Gap | Change | File |
| --- | --- | --- |
| `goLive()` is local-only | Replace with sequential mutations: `venues.create` → `branches.create` → `services.create` | `src/context.tsx`, `src/components/SetupFlow.tsx` |
| No venue-null guard | After auth: if `venues.list` empty → `/(setup)/`; if venue exists → skip setup | `src/app/index.tsx` or `context.tsx` |
| Missing create hooks | Add `useCreateVenue`, `useCreateBranch`, `useCreateService` | `src/hooks/useVenueData.ts` or `useOwnerData.ts` |
| Returning user with no venue | Same redirect as web — not only `isNewUser` from Google | `src/context.tsx` `handleAuthed` |

**Reference:** `sites/business-dashboard/src/components/screens/OnboardingScreen.tsx`

**Verify:** Complete setup → rows in D1 for venue, branch, service; relaunch app → lands on tabs, not setup.

---

### Phase B2 — Venue & branch sync

**Goal:** UI chrome uses API data, not stale local state.

| Gap | Change | File |
| --- | --- | --- |
| `localVenue.branches` not from API | Sync `apiBranches` into venue model on fetch; branch switcher reads API names | `src/context.tsx` |
| `toggleStatus` / `updateVenue` local-only | Wire to `api.venues.update` (Draft → Active transitions) | `src/context.tsx`, `src/components/sheets.tsx` `EditVenueSheet` |
| `addBranchToVenue` local-only | Wire to `api.branches.create` | `src/context.tsx`, `AddBranchSheet` |
| Service create fails “Branch not found” | Resolve `branchId` from `apiBranches`, not `venue.branches` strings | `src/context.tsx` |
| Team grouped by empty local branches | Group by `apiBranches` | `src/components/screens/MoreScreen.tsx` (team section) |
| Calendar branch picker desync | Use `apiBranches` consistently | `src/components/screens/CalendarScreen.tsx` |

**Verify:** Existing API user opens app → branch switcher populated; add service succeeds; status toggle hits API.

---

### Phase B3 — Booking lifecycle (complete + assign)

**Goal:** Operator booking management matches business-dashboard Phase 2.

| Gap | Change | File |
| --- | --- | --- |
| No mark complete | Add `completeBooking` mutation → `api.bookings.complete` | `src/context.tsx` |
| No staff assign | Add `assignStaff` mutation → `api.bookings.assign` | same |
| Missing Completed status | Widen `Booking.status` in `data.ts`; add Completed tab/filter | `src/data.ts`, `BookingsScreen.tsx` |
| No UI actions | Complete button on Confirmed rows; staff picker (team list) | `BookingsScreen.tsx`, `sheets.tsx` `BookingDetailSheet` |
| Today tab | Optional: mark complete from Today pending/confirmed cards | `TodayScreen.tsx` |

**Reference:** `sites/business-dashboard/src/components/screens/BookingsScreen.tsx`

**Verify:** Confirm → assign staff → mark complete; Completed tab shows row.

---

### Phase B4 — Venue settings & branch operations

**Goal:** Settings parity with business-dashboard Phase 4.

| Gap | Change | File |
| --- | --- | --- |
| Branch edit/delete local-only | Wire `branches.update`, `branches.delete` | `src/components/sheets.tsx`, `MoreScreen.tsx` `VenueScreen` |
| No branch hours | `useBranchHours` + `useUpsertBranchHours`; hours editor sheet per branch | new sheet + hooks in `useOwnerData.ts` |
| Photo upload no invalidation | After `venues.uploadPhoto`, invalidate `["venue", "owner"]` | `EditVenueSheet`, `ServicesScreen.tsx` (service photo too) |
| Placeholder photo gallery | Show API `photos` URLs after upload | `VenueScreen` in `MoreScreen.tsx` |

**Reference:** `sites/business-dashboard/src/components/screens/SettingsScreen.tsx`

**Verify:** Edit branch name persists; hours save via `PUT /branches/:id/hours`; uploaded photo appears in gallery.

---

### Phase B5 — Campaigns

**Goal:** Owner can create, edit, send, and delete campaigns from mobile.

| Gap | Change | File |
| --- | --- | --- |
| Feature missing entirely | New overlay route + screen | `src/app/campaigns.tsx`, `src/components/screens/CampaignsScreen.tsx` |
| No nav entry | Link from More → Insights or Marketing section | `MoreScreen.tsx` |
| Stack registration | Add to root stack | `src/app/_layout.tsx` |
| Hooks | `useCampaigns`, create/update/send/delete mutations | `src/hooks/useOwnerData.ts` |

**Reference:** Port from `sites/business-dashboard/src/components/screens/CampaignsScreen.tsx`

**Verify:** Create draft campaign → edit → send; appears in list with Sent status.

---

### Phase B6 — Account, sessions & code health

**Goal:** Polish and reduce context bloat.

| Gap | Change | File |
| --- | --- | --- |
| No `auth.me` on launch | Hydrate owner name/email from API | `src/context.tsx` |
| No sessions UI | List + revoke on Account screen | `MoreScreen.tsx` `AccountScreen` |
| Adapters inline in context | Extract to `src/lib/adapters.ts` | new file + context refactor |
| Dead hook files | Merge `useVenueData.ts` into `useOwnerData.ts` or wire all exports | `src/hooks/*` |
| Customer name stub in bookings | Enrich adapter when API adds fields, or join customer data | `src/context.tsx` |

**Verify:** Type-check passes; hooks file is single source for owner queries; no duplicate query logic in context.

---

## Implementation order (recommended)

Work **Part A and Part B in parallel** where teams split, but within each part follow phase order:

```
A1 → A2 → A3 → A4 → A5          (customer — booking path is sequential)
B1 → B2 → B3 → B4 → B5 → B6     (owner — onboarding before settings)
```

**Suggested PR slicing**

| PR | Scope | Apps |
| --- | --- | --- |
| 1 | Auth hydration | both (A1 + partial B6) |
| 2 | Customer venue detail + booking create | mobile-app A2 + A3 |
| 3 | Owner onboarding + branch sync | owner-app B1 + B2 |
| 4 | Booking lifecycle | owner-app B3 + mobile-app A4 |
| 5 | Settings + campaigns | owner-app B4 + B5 |
| 6 | Sessions + hooks refactor | both A5 + B6 |

---

## Critical files touched (by app)

### mobile-app

| File | Phases |
| --- | --- |
| `src/context.tsx` | A1, A3, A4 |
| `src/hooks/useVenueDetail.ts` | A2 (new) |
| `src/hooks/useAuth.ts` | A1 (new) |
| `src/lib/adapters.ts` | A2, A4 (new) |
| `src/components/screens/VenueScreen.tsx` | A2 |
| `src/components/screens/BookingScreen.tsx` | A3 |
| `src/components/screens/BookingsScreen.tsx` | A4 |
| `src/components/screens/RewardsScreen.tsx` | A4 |
| `src/components/screens/AccountScreen.tsx` | A1, A5 |

### owner-app

| File | Phases |
| --- | --- |
| `src/context.tsx` | B1–B4, B6 |
| `src/components/SetupFlow.tsx` | B1 |
| `src/hooks/useOwnerData.ts` | B1, B3–B5 |
| `src/lib/adapters.ts` | B6 (new) |
| `src/data.ts` | B3 |
| `src/components/screens/BookingsScreen.tsx` | B3 |
| `src/components/sheets.tsx` | B2, B3, B4 |
| `src/components/screens/MoreScreen.tsx` | B2, B4, B5, B6 |
| `src/components/screens/CampaignsScreen.tsx` | B5 (new) |
| `src/app/campaigns.tsx` | B5 (new) |

### Shared

| File | Phases |
| --- | --- |
| `packages/api-client/src/endpoints/*.ts` | Only if new methods needed (most exist) |
| `docs/guides/ui-backend-sync.md` (see [guide](../guides/ui-backend-sync.md)) | All |
| `apps/mobile-app/AGENTS.md` | A3+ |
| `apps/owner-app/AGENTS.md` | B1+ |

---

## Verification

After each phase:

```sh
# Type-check (from monorepo root)
cd apps/mobile-app && bunx tsc --noEmit
cd apps/owner-app && bunx tsc --noEmit

# Unit tests
cd apps/mobile-app && bun run test
cd apps/owner-app && bun run test

# API smoke
bun run api:dev   # http://localhost:8787
```

### Golden paths

| Phase | Golden path |
| --- | --- |
| A1 | Sign in → force-quit → relaunch → still signed in |
| A2 | Search → venue → see services per branch |
| A3 | Select service → slot → optional coupon → confirm → `POST /bookings` |
| A4 | Cancel booking; review completed booking; redeem points |
| A5 | View sessions → revoke one |
| B1 | New owner setup → venue + branch + service in DB |
| B2 | Toggle Draft/Active; add branch via sheet |
| B3 | Confirm booking → assign staff → complete |
| B4 | Edit branch; set Mon–Sun hours; upload venue photo |
| B5 | Create campaign → send |
| B6 | Account shows `me`; adapters extracted; tests green |

### Manual API check

Run `bun run api:dev` and `bun run mobile-app:dev` / owner-app start. Use Flipper or Metro logs to confirm correct endpoints. Seed data: `bun run db:seed:dev`.

---

## Backend gaps to watch (optional follow-ups)

These are **not blockers** for the phases above but improve mobile UX:

| Need | Why | Possible API change |
| --- | --- | --- |
| Enriched customer booking list | Avoid N+1 fetches for venue/service names on list rows | Extend `GET /bookings` DTO with `serviceName`, `venueName`, `branchName` |
| Customer profile patch | Account “edit profile” on mobile | `PATCH /auth/me` or customer-scoped profile route |
| ~~Notifications feed~~ | Done — `GET/PATCH/POST /api/v1/notifications`; queue persists rows; owner bell wired | — |
| ~~Venue photo list~~ | Done — `GET /api/v1/venues/:id/photos`; owner + customer galleries | — |
| ~~Favourites~~ | ~~Customer favourites tab~~ | ~~New favourites module~~ — **Done** (June 2026): server-synced via `/v1/favourites`; see Out of scope note above |

Track these separately — do not block mobile rollout on API changes unless product requires them.

---

## Related docs

- [ui-backend-sync-rollout.md](ui-backend-sync-rollout.md) — completed web rollout (archived)
- [ui-backend-sync.md](../guides/ui-backend-sync.md) — wiring conventions
- [apps/mobile-app/AGENTS.md](../../apps/mobile-app/AGENTS.md) — customer app guide
- [apps/owner-app/AGENTS.md](../../apps/owner-app/AGENTS.md) — owner app guide
- [google-auth.md](../guides/google-auth.md) — Google OAuth
