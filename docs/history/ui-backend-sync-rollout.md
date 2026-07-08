# Plan: UI ↔ Backend Sync — Multi-Phase Rollout

> **Archived (complete, June 2026).** Living conventions: [ui-backend-sync.md](../guides/ui-backend-sync.md). Index: [docs/README.md](../README.md).

> **Status (complete):** All five phases implemented. Phase 5a (owner onboarding) added in the final pass.

## Context

The backend (`workers/api`) has 79 routes across 14 modules — all fully implemented. The `@repo/api-client` package exposes methods for nearly all of them. The gap is entirely on the frontend: the two Next.js sites have screens and pages that don't call the API endpoints they need, or are missing UI entirely for features that are backend-ready.

This plan closes every gap in 5 independently-shippable phases, ordered by user impact. Each phase builds on the previous and the phases should be implemented in order.

---

## Phase 1 — Customer Quick Wins (marketing-site)

**Goal:** Close the most user-visible gaps in `sites/marketing-site`. All UI-only — no API client changes.

| Gap                       | Change                                                                                                        | File                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Logout doesn't hit server | Wrap `tokenStore.clearTokens()` in `try { await api.auth.logout() } finally { ... }`                          | `sites/marketing-site/src/app/account/page.tsx` |
| Can't cancel a booking    | Add `useMutation` → `api.bookings.cancel(id)`, show Cancel button on Confirmed/Pending rows                   | same                                            |
| Can't write a review      | Add "Leave a review" button on Completed bookings, inline star+text form → `api.reviews.create(...)`          | same                                            |
| Rewards never shown       | Add two queries (`api.rewards.balance()`, `api.rewards.history()`), render a Rewards card above bookings list | same                                            |

Also widen `Booking.status` in `sites/business-dashboard/src/components/data.ts` to include `"Completed"` so the Completed filter works in Phase 2.

---

## Phase 2 — Booking Lifecycle Completeness (business-dashboard)

**Goal:** Operators can mark bookings complete, assign staff, and fully manage services.

### 2a — Mark booking complete (UI-only)

- Add `useCompleteBooking()` hook to `useOwnerData.ts` (pattern: same as `useConfirmBooking`)
- Add "Mark complete" action to Confirmed rows + "Completed" tab in `BookingsScreen.tsx`
- Wire in `sites/business-dashboard/src/app/(dashboard)/bookings/page.tsx`

### 2b — Assign staff to booking (API client + UI)

**API client first:**

- `packages/api-client/src/endpoints/bookings.ts`: add `assign: (id, body: { staffId: string }) => client.patch(...)`
- Export from `packages/api-client/src/index.ts`

**Then UI:**

- Add `useAssignStaff()` hook to `useOwnerData.ts`
- Add `team: TeamMember[]` + `onAssign` props to `BookingsScreen`; render inline `<select>` on Confirmed rows
- Wire in `bookings/page.tsx` (team list already available via `useTeam`)

### 2c — Edit service (UI-only)

- Add `useUpdateService()` hook to `useOwnerData.ts` (pattern: `{ id, body } => api.services.update(id, body)`)
- Add `EditServiceModal` inside `ServicesScreen.tsx` — mirrors `AddServiceModal`, pre-populates fields
- Wire pencil button and `onUpdate` prop in `services/page.tsx`

### 2d — Service photo upload (UI-only)

- Add `useUploadServicePhoto()` hook (FormData pattern: `fd.append("photo", file)`)
- Hidden `<input type="file">` per card; trigger on existing upload placeholder
- Wire `onUploadPhoto` in `services/page.tsx`

---

## Phase 3 — Coupon Checkout + Staff Management

**Goal:** Coupon discounts active at booking; team "Coming soon" replaced with real UI.

### 3a — Coupon input at checkout (UI-only)

- File: `sites/marketing-site/src/app/book/[venueId]/page.tsx`
- In Step 3: add collapsible "Have a coupon?" section with code input + "Apply" button
- Inline `useMutation` → `api.coupons.validate({ code, venueId })`; show discount row in summary; pass `couponCode` to `createBooking.mutate`
- Ensure `ValidateCouponResponse` is exported from `packages/api-client/src/index.ts` (add if missing)

### 3b — Add staff member (UI-only, replaces "Coming soon")

- Add `useSearchUsers(query)` hook to `useOwnerData.ts` (enabled when `query.length >= 2`)
- Refactor `AddStaffModal` in `TeamScreen.tsx`: replace name text input with debounced email/name search + user dropdown; hidden `userId` from selection
- Add `useAddTeamMember()` hook; wire in `team/page.tsx`

### 3c — Edit team member (UI-only)

- Add `useUpdateTeamMember()` hook; add `EditTeamMemberModal` (role + title fields); wire pencil button in `TeamScreen.tsx` and `team/page.tsx`

---

## Phase 4 — Analytics + Branch Operations (business-dashboard)

**Goal:** Complete the analytics view and give owners full branch/venue management.

### 4a — Peak hours heatmap (UI-only)

- File: `sites/business-dashboard/src/app/(dashboard)/analytics/page.tsx`
- Add `peakQ` query using `api.analytics.peak()`; add `PeakHeatmap` component (7 days × 24 hours grid, cell opacity = `count / maxCount`); add card below existing four

### 4b — Edit campaign (UI-only)

- File: `sites/business-dashboard/src/components/screens/CampaignsScreen.tsx`
- Add pencil icon to draft campaign rows; `editingCampaign` state; `EditCampaignModal` mirroring `CampaignBuilder`; call `api.campaigns.update(id, body)` on save

### 4c — Branch CRUD (UI-only)

- Add `useUpdateBranch()` and `useDeleteBranch()` hooks to `useOwnerData.ts`
- Add `EditBranchModal`; wire pencil + trash buttons in `SettingsScreen.tsx` + `settings/page.tsx`

### 4d — Branch working hours (API client + UI)

**API client first:**

- `packages/api-client/src/endpoints/branches.ts`: add `getHours(id)` → `client.get(...)` and `upsertHours(id, body)` → `client.put(...)` (or `patch` — verify backend method in `workers/api/src/modules/branches/index.ts`)
- If backend uses `PUT`, add `put<T>(path, body)` method to `packages/api-client/src/client.ts` (same pattern as `patch`)
- Export from `index.ts`

**Then UI:**

- Add `useBranchHours(branchId)` query and `useUpsertBranchHours()` mutation to `useOwnerData.ts`
- Add "Hours" expandable section per branch in `SettingsScreen.tsx`: 7-row table (Mon–Sun), open/close toggle + time inputs; Save button; wire in `settings/page.tsx`

### 4e — Venue photo upload (UI-only)

- Add `useUploadVenuePhoto()` hook (FormData pattern)
- Wire existing "Upload" placeholder in the Photos card of `SettingsScreen.tsx`
- On success, re-query `useMyVenue()` to reflect the updated `photos` array

---

## Phase 5 — Onboarding + Session Management + Rewards Redeem

**Goal:** New owner flow; session security; rewards full circle.

### 5a — New owner onboarding (UI-only)

- `sites/business-dashboard/src/app/(dashboard)/layout.tsx`: if `useMyVenue()` returns null, redirect to `/onboarding`
- New `sites/business-dashboard/src/app/(dashboard)/onboarding/page.tsx` + `OnboardingScreen.tsx`: 3-step wizard (venue → branch → service), each step's mutation provides the ID needed by the next

### 5b — Session management (API client + UI)

- `packages/api-client/src/endpoints/auth.ts`: add `listSessions()` → `client.get(...)` and `revokeSession(id)` → `client.delete(...)`
- `sites/marketing-site/src/app/account/page.tsx`: add "Active sessions" card; query + per-session Revoke button

### 5c — Rewards redemption (API client + UI)

- `packages/api-client/src/endpoints/rewards.ts`: add `redeem(body)` → `client.post(...)`
- `sites/marketing-site/src/app/account/page.tsx` (rewards card from Phase 1): add "Redeem" button → points input → mutation; invalidate balance + history on success

---

## Cross-Cutting Rules (apply every phase)

- **API client method before hook before screen before page** — never skip the order within a phase.
- **Cache invalidation via `qc.invalidateQueries()`** — never use `refetch()`.
- **FormData uploads**: build `FormData`, pass to client method; do not set `Content-Type` manually.
- **Mutation feedback**: `onSuccess` → `flash("...", iconName)`, `onError: (e: Error)` → `flash(e.message)`.
- **Loading states**: `<ScreenSkeleton rows={N} cards={M} />` for page-level loading.

## Critical files touched across all phases

| File                                                                 | Phases                   |
| -------------------------------------------------------------------- | ------------------------ |
| `packages/api-client/src/client.ts`                                  | 4d (add `put`)           |
| `packages/api-client/src/endpoints/bookings.ts`                      | 2b                       |
| `packages/api-client/src/endpoints/branches.ts`                      | 4d                       |
| `packages/api-client/src/endpoints/auth.ts`                          | 5b                       |
| `packages/api-client/src/endpoints/rewards.ts`                       | 5c                       |
| `packages/api-client/src/index.ts`                                   | 2b, 3a, 4d, 5b, 5c       |
| `sites/business-dashboard/src/hooks/useOwnerData.ts`                 | 2, 3, 4 (all phases)     |
| `sites/business-dashboard/src/components/data.ts`                    | 1 (widen Booking.status) |
| `sites/business-dashboard/src/components/screens/SettingsScreen.tsx` | 4c, 4d, 4e               |
| `sites/marketing-site/src/app/account/page.tsx`                      | 1, 5b, 5c                |
| `sites/marketing-site/src/app/book/[venueId]/page.tsx`               | 3a                       |

## Verification

Run after each phase:

```sh
bun run check-types   # from monorepo root — catches client/hook type mismatches
bun run test          # workers/api vitest suite
bun run api:dev       # confirm API still starts
```

For UI verification: start `bun run business-dashboard:dev` and `bun run marketing-site:dev`; walk through the golden path for each new feature (see phase-level verification notes in the design above); monitor browser devtools Network tab to confirm correct endpoints are called.
