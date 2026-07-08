# Owner App — agent guide

Business-owner-facing Expo app. Stack: **Expo 56** + **expo-router** + **React Native** + **NativeWind**.

**Expo APIs change between versions. Read versioned docs before writing any Expo or expo-router code:**
https://docs.expo.dev/versions/v56.0.0/

## Documentation update policy

- Any feature implementation, refactor, or behavior change in this app must include documentation updates in the same task/PR.
- Update the most relevant existing docs first (this file, linked guides, and cross-repo docs when affected).
- Any feature implementation or refactor must run lint, tests, and build before completion (`bun run lint`, `bun run owner-app:test`, and `bun run owner-app:build` or `cd apps/owner-app && bun run build`, or equivalent scoped commands).
- Do not consider the task complete until code and docs are both updated and consistent.

## Layout

```
src/app/        # expo-router file-based routes
src/components/ # shared UI components
src/hooks/      # custom hooks
src/constants/  # design tokens, config
```

## Authentication

Google OAuth and email/password. `AuthScreen.tsx` is a thin switcher that lazy-loads `AuthScreenRedirect.tsx` (default, Expo Go) or `AuthScreenNative.tsx` (EAS builds) based on `EXPO_PUBLIC_AUTH_PROVIDER`. Google callback scheme: `ownerapp://auth/callback`. Email/password reset deep link: `ownerapp://auth/reset-password`. After sign-in, `onAuthed` calls `context.handleAuthed` which checks `api.businesses.list`: no business → `/(setup)/` (onboarding); business exists → `/(tabs)`.

Full flow reference: [docs/guides/google-auth.md](../../docs/guides/google-auth.md) · [docs/guides/email-password-auth.md](../../docs/guides/email-password-auth.md)

Do **not** add OTP auth.

## Vertical-aware catalog (ADR-0004)

The owner-app manages one business; its `business.vertical` (`booking | commerce`) selects which catalog the owner manages. The third tab's **route name stays `services` for both verticals** (so booking navigation/deep-links are byte-unchanged) — only its **label, icon, and rendered screen** switch, chosen from the registry in `src/lib/ownerExperiences.ts` (`ownerCatalogExperience`): `booking` → Services tab → `ServicesScreen`; `commerce` → Products tab → `ProductsScreen`. **Never branch on `vertical` in a screen or in `(tabs)/_layout.tsx` — register it in the map.** The local `Business` model (`data.ts`) carries `vertical`, defaulting to `booking` (so existing booking owners see "Services" with no flicker during the load window); it is hydrated from `businessQuery.data.vertical`.

**Products (commerce):** `ProductsScreen` mirrors `ServicesScreen` — per-branch grouping, `BranchSwitcher`, photo upload/delete (`api.products.uploadPhoto`/`deletePhoto`, field name `file`, invalidate `["business-products"]`), edit/delete. Cards show a per-branch **stock pill** (out/low/in-stock) + price, and skip the category badge when `category` is null. `context.tsx` adds a `productsQuery` gated on `vertical === "commerce"` (booking businesses never fetch it), exposing `products` + `addProduct`/`updateProduct`/`removeProduct` (same close-on-success / guard-double-submit conventions as services). `AddProductSheet` (`sheets.tsx`) collects name, category, price, stock, description, status; price/stock inputs strip non-digits so they stay non-negative integers (matching the DB `CHECK(stock >= 0)`). `adaptProduct` (`src/lib/adapters.ts`) maps the API `Product` → local view model. **Known limitation (#71):** a commerce business still shows Bookings/Reviews tabs — deliberate for now, matching #70's "prove the switch works" scope.

**Orders (commerce):** A commerce owner manages orders from **More → Orders** (`/orders` route; the entry is hidden for booking businesses). `OrdersScreen` mirrors `CampaignsScreen` — `BranchSwitcher` + Active/Done `FilterTabs`, rows tap into `OrderDetailSheet` (`SheetType.orderDetail`). The sheet resolves item product names from the commerce `products` (`adaptOrderLine` in `adapters.ts`), shows a single **guided next-status** button (`nextOrderStatus`/`nextOrderActionLabel` in `data.ts`: Confirm → Mark out for delivery → Mark delivered) and a **Cancel order** action while `isOrderCancellable` (Pending/Confirmed) — cancel confirms via `Alert`, calls `updateStatus(id,"Cancelled")` (backend restores stock + notifies the customer). Data hooks live in `useOwnerData.ts` (`useBranchOrders`, `useOrder`, `useUpdateOrderStatus`); mutations `invalidateQueries(["branch-orders"])` + `["order", id]`. `StatusPill` gained `OutForDelivery`/`Delivered` variants.

**Customer dues / Khata (commerce):** A commerce owner manages the credit ledger from **More → Customer dues** (`/khata` route; hidden for booking businesses). `KhataScreen` mirrors `CustomersScreen` — a `selected`-state toggle renders an in-file `KhataCustomerLedger` (its own `BackHeader`), not a sheet. The list shows debtors (`useKhataDues` → customers with `due > 0`) with a **total outstanding** header (`totalOutstanding` in `data.ts`). The ledger (`useKhataCustomer`) shows the current due, delivered orders (debits) and payments (credits), a **Record payment** button (opens `RecordPaymentSheet`, `SheetType.recordPayment`), and an inline **Void** per payment (`useVoidPayment`, Alert-confirmed). `RecordPaymentSheet` prefills the amount to the current due (editable; digit-only input), records via `useRecordPayment` (`api.payments.record`), and closes on success. Mutations `invalidateQueries(["khata-dues"])` + `["khata-customer", userId, businessId]`. Khata is **business-level** (no `BranchSwitcher`).

## Owner onboarding (setup flow)

`SetupFlow` → `goLive()` persists to the API in phase order: `businesses.create` first, then **all branches concurrently** (`Promise.all`), then **all services concurrently** (each resolves its `branchId` from the name→id map built from the branch results). Phases stay ordered (services need branch ids); only intra-phase calls run in parallel, so setup latency stays roughly flat as branch/service counts grow. Partial-failure recovery is preserved: if the business was created but a later call rejects, the app routes into `/(tabs)` (no duplicate business) and flashes "some items may need to be added manually." A service whose branch name resolves to no created branch is skipped rather than crashing the batch; if any service is skipped, `goLive` surfaces that same manual-completion message instead of the clean success flash (the setup picker normally constrains branch names, so this is a defensive guard). After auth, if `businesses.list` is empty the app routes to `/(setup)/`; returning users with a business skip setup even when `isNewUser` is false.

Branch names in the UI come from `api.branches.list`, synced into the local business model on fetch. `updateBusiness` and `addBranchToBusiness` call the corresponding API methods.

**Business status toggle:** `toggleStatus` only switches **Active ⇄ Draft** via the pure `nextBusinessStatus(current)` helper (in `data.ts`), which returns `null` for **Suspended** — an owner cannot lift a Talash suspension. `TodayScreen` and `MoreScreen` gate the toggle on `isBusinessStatusToggleable(status)`, rendering it non-interactive with "Managed by Talash" / "Suspended by Talash" copy when suspended.

**Archive business:** `BusinessScreen` (in `MoreScreen.tsx`) has an "Archive business" button that calls `useDeleteBusiness` → `api.businesses.delete`. This is a soft-delete; the business can be restored via the Restore button on the same screen. A destructive `Alert.alert` confirmation is shown before the mutation fires.

**Delete account:** The default `MoreScreen` has a "Delete account" button (danger style) below Sign out. It fetches the current user ID via `useQuery(api.auth.me)` (5 min stale time). On confirmation it calls `api.users.delete(userId)` → `qc.clear()` → `signOut()`.

Confirmed bookings can be marked **complete** (`bookings.complete`) or **assigned** to staff (`bookings.assign`) from `BookingDetailSheet` and Today/Bookings cards. The Bookings tab includes a **Completed** filter. **Calendar day-view cards are tappable** — tapping opens `BookingDetailSheet` with the full confirm/complete/assign workflow. `adaptCalendarBooking` in `src/lib/adapters.ts` converts `CalendarBooking` (API type) to the local `Booking` view model for this purpose.

Business profile supports branch edit/delete, working hours (`BranchHoursSheet`), and business photo uploads (`file` field, invalidate `["business", "owner"]`). **Service cards in `ServicesScreen` also support per-service photo upload and delete** (`api.services.uploadPhoto` / `api.services.deletePhoto`, field name `file`, invalidate `["business-content"]`). Campaigns live at `/campaigns` (More → Campaigns). Owner hooks are consolidated in `src/hooks/useOwnerData.ts`.

**Staff availability:** `useStaffAvailability` + `useUpsertStaffAvailability` hooks call `GET/PUT /api/v1/team/:id/availability`. `StaffAvailabilitySheet` (`sheets.tsx`, `SheetType.staffAvailability`) opens from a clock icon per non-owner staff member in TeamScreen.

**Shared schedule editor:** `BranchHoursSheet` and `StaffAvailabilitySheet` are thin adapters over one `WeekScheduleEditor` component (`components/WeekScheduleEditor.tsx`). The editor owns the 7-day grid, open/closed switches, time inputs, the save button, and the seed-once `initialized` guard. The two API surfaces differ only in field names (`openTime`/`closeTime` vs `startTime`/`endTime`); both normalise to a common `DaySchedule` shape via the pure helpers in `src/lib/schedule.ts` (`mergeWeekSchedule` in, `serializeWeekSchedule` out — closed days clear their times). Add new schedule editors by writing an adapter, not by duplicating the grid. The adapters pass the query's `isError` + `onRetry={refetch}`: on a load error the editor shows a short message + Retry and **renders no Save button**, so default hours can never be saved over the real (failed-to-load) server data. Open days are validated by the pure `validateWeekSchedule` (`schedule.ts`): each open day's times must be 24-hour `HH:MM` with open before close (closed days exempt); invalid days show an inline error and Save is disabled until fixed.

**Sheet form conventions (`sheets.tsx`):**

- **Close only on success.** Create/edit handlers in `context.tsx` call `setSheet(null)` inside the mutation's `onSuccess`/resolved branch — never synchronously after firing. On error the sheet stays open so the toast lands over the form and the owner can retry without re-typing.
- **Guard double-submit.** Add sheets (`AddServiceSheet`, `AddBranchSheet`, `CreateCouponSheet`) keep a local `submitting` flag and `await` the (promise-returning) context handler; the footer is `disabled={!valid || submitting}`. The context create handlers (`addService`, `addBranchToBusiness`, `createCoupon`) return promises that always resolve (errors are surfaced via the mutation's `onError`/`flash`).
- **Seed-from-query once.** Sheets that hydrate local state from a query gate the seeding `useEffect` with an `initialized` flag so a background refetch never clobbers in-progress edits — now centralised in `WeekScheduleEditor` for both schedule sheets.
- **Validate before submit.** `CreateCouponSheet` gates its footer on the pure `validateCoupon` (`data.ts`): percentage discounts are whole numbers 1–100, fixed discounts ≥ ৳1, code non-empty, max-uses ≥ 1 when set (omitting it defaults to 100 at submit). An inline error renders once the owner starts typing; the backend stays the source of truth.
- **Branch reassignment:** staff edit persists `branchId` (mapped from branch name via `apiBranches`; `team.update` accepts it). Service edit has **no** Branch picker — `services.update` omits `branchId`, so a service's branch is fixed once created.

**Bookings CSV export:** `BookingsScreen` has an Export button that calls `api.bookings.exportCsv`, reads the blob as text, and shares via React Native `Share`.

API → UI mapping lives in `src/lib/adapters.ts` (`adaptApiBooking`, `adaptService`, `adaptCalendarBooking`, etc.). `Icon`, `Avatar`, and `Stars` accept either token sizes (`"md"`) or numeric pixels (`size={42}`).

## Key conventions

- Routing: expo-router file-based (`src/app/`). Use `<Link>` and `router.push()`.
- Styling: NativeWind (Tailwind class names on React Native components via `className`).
- **NativeWind PostCSS:** `postcss.config.mjs` with `@tailwindcss/postcss` is required — without it Metro's web CSS pass leaves only `@source` in `global.css`, and `react-native-css`/lightningcss fails to compile.
- **lightningcss pin:** root `package.json` overrides `lightningcss` to `1.30.1`; each Expo app also lists it as a direct dependency (required by NativeWind v5 — newer versions break `global.css` compilation). After changing overrides, run `bun install` from the monorepo root.
- Global CSS: `src/global.css` — import once at the app entry. It also has
  `@source "../../../packages/ui-native/src/**/*.{ts,tsx}"` so NativeWind scans the
  shared component library — **do not remove it**, or classes used only in
  `@repo/ui-native` (e.g. `bg-info-bg`, `bg-pending-bg`) stop generating (#64).
- Shared UI primitives (`Avatar`, `Badge`, `Button`, `Card`, `Divider`,
  `Eyebrow`, `Icon`, `Stars`, `Switch`, `SectionTitle`) come from
  `@repo/ui-native`, re-exported via `src/components/ui` (#64/#96). Button
  variants: `subtle` (not `secondary`),
  `dangerOutline` for low-emphasis destructive (filled `danger` is high-emphasis);
  Badge default variant is `default` (not `neutral`). App-specific components
  (`Sheet`, `BranchSwitcher`, `TextField`, …) stay in `src/components/ui`.
- Users here are business owners/managers; RBAC roles are `owner` and `manager`.

## Responsive layout

Phones, tablets, and landscape — use `useLayout`, `ScreenContainer`, and tablet sidebar tabs. Full reference: [docs/guides/responsive-layout.md](../../docs/guides/responsive-layout.md).

## Tenant theming — owner brand throughout

The owner app is single-tenant, so it renders **end-to-end** in the owner's saved brand. `ThemeBoundary` (in `src/components/ThemeProvider.tsx`) wraps the whole app inside `AppProvider` (`src/app/_layout.tsx`) and overrides the themeable custom properties for the entire tree ([ADR-0002](../../docs/adr/0002-themeable-scope-and-boundary.md), [ADR-0003](../../docs/adr/0003-custom-palette-contrast.md)).

- **Themeable roles** (overridden by the palette): `--color-primary`, the **derived primary ramp** `--color-primary-{soft,muted,strong,deep}` (#97), `--color-accent`, `--color-surface`. These also repaint the shared `@repo/ui-native` Button/Badge brand variants (`primary`/`subtle`/`dark` buttons, `brand` badge) — the owner app being fully branded, these render in the owner's brand throughout. The ramp steps are derived from the primary seed by `derivePrimaryTints` (`@repo/tokens`) in `paletteToVars`; the same derivation feeds the API WCAG gate (see [ADR-0002](../../docs/adr/0002-themeable-scope-and-boundary.md#component-theming--derived-primary-ramp-97)). **Static roles** — ink/neutrals (`--color-ink*`, `--color-line*`) and status (`--color-success`/`danger`/`pending`/`info`) — are never themed; a `subtle` button's **icon** is decoupled to neutral ink (lucide icon colour can't read a themed var on RN). `foreground` is deferred (no token; #59/#60).
- **Palette source:** `useBrandPalette()` (`src/hooks/useOwnerData.ts`) reactively reads the `["business", "owner"]` cache `AppProvider` already populates (`enabled: false` → no extra/pre-auth fetch), returning `business.brandPalette` or `null`.
- **Fallback:** `null` palette → `ThemeProvider` renders children unwrapped → Talash defaults.
- `ThemeProvider` uses NativeWind v5's `VariableContextProvider` (the var-cascade primitive, **not** a hand-rolled palette JS context). It trusts its input — hex validity is enforced server-side at save (#59).
- `BrandPalette` is imported from `@repo/api-client`. The runtime cascade is native-only; pure mapping + boundary-value + fallback are unit-tested (`theme-vars.test.ts`, `useBrandPalette.test.tsx`, `ThemeProvider.test.tsx`), end-to-end repaint via manual device smoke.

### Brand editor (#58)

`BrandingScreen` (More → **Brand & appearance**, `/branding` route) lets owners set a full custom palette. Each role (primary/accent/foreground/surface) has a native colour wheel (`reanimated-color-picker` `HueCircular`); a live preview strip repaints via `ThemeProvider` with the in-progress draft as colours change. **Save brand** persists via `useSaveBrandPalette` (`businesses.update`); **Reset to Talash default** saves `null`. The server WCAG-AA contrast gate (#59) can reject a save — `BrandingScreen` surfaces that 422 message via `flash`, so an unreadable palette fails loud. Pure seeds/equality live in `src/lib/branding.ts` (`DEFAULT_PALETTE_SEEDS`, `PALETTE_ROLES`, `palettesEqual`). Tests: `branding.test.ts`, `useSaveBrandPalette.test.tsx`, `BrandingScreen.test.tsx` (the colour picker is stubbed — `vi.mock("reanimated-color-picker", …)` — like `nativewind`).

## Offline (read-only)

TanStack Query cache persists to MMKV via `@repo/mobile-query`. Root layout uses `MobilePersistQueryClientProvider`, `OfflineBanner`, and `PendingSyncBanner`. `OutboxSyncProvider` in context flushes the mutation outbox on reconnect. Queueable offline writes: booking confirm/cancel/complete/assign, notification read. `signOut()` calls `clearPersistedCache(OWNER_APP_ID)`, `clearOutbox(OWNER_APP_ID)`, and `clearWalkInQueue(OWNER_APP_ID)`. Catalog/team/khata mutations still gate with `useOnlineGuard()`. Executors: `src/lib/outbox-executors.ts`. Booking rows show “Pending sync” via `useOutbox`. **Walk-in LAN (B2):** `WalkInHubProvider` starts `@repo/walk-in-sync` hub when walk-in mode is on; Today shows live LAN queue; flush on reconnect. Full guide: [docs/guides/mobile-offline.md](../../docs/guides/mobile-offline.md).

## Key libraries & hooks

| Hook / module                                       | Purpose                                                                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/hooks/useDebounce.ts`                          | Generic debounce (300ms default)                                                                                                                 |
| `src/hooks/useNetworkStatus.ts`                     | Re-exported from `@repo/mobile-query` (NetInfo); drives shared `OfflineBanner`                                                                   |
| `src/hooks/useLayout.ts`                            | Responsive layout: `{ isTablet, isLandscape, contentWidth }`                                                                                     |
| `useBrandPalette` (`src/hooks/useOwnerData.ts`)     | The owner's saved `BrandPalette` (or `null` → Talash defaults); reads the shared `["business","owner"]` cache reactively. Feeds `ThemeBoundary`. |
| `useSaveBrandPalette` (`src/hooks/useOwnerData.ts`) | Mutation: persist the palette (or `null` to revert) via `businesses.update`; invalidates `["business","owner"]`. Drives `BrandingScreen`.        |
| `src/lib/native-token-store.ts`                     | Native SecureStore adapter implementing the shared `TokenStore` interface from `@repo/api-client`                                                |
| `src/lib/i18n.ts`                                   | Lightweight `t(key)` scaffold — swap for i18next when multi-language is needed                                                                   |

## Components

| Component                         | Notes                                                                                                                                                                                           |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OfflineBanner`                   | From `@repo/mobile-query` — amber when offline with cached data, red when no cache                                                                                                              |
| `ErrorBoundary`                   | Class-component error boundary wrapping the navigator                                                                                                                                           |
| `LoadingScreen`                   | Shimmer skeleton components: `BookingCardSkeleton`, `ReviewCardSkeleton`, `TodayScreenSkeleton`                                                                                                 |
| `ScreenContainer`                 | Centers content at 800pt max on tablet; transparent on phone                                                                                                                                    |
| `ThemeProvider` / `ThemeBoundary` | `ThemeBoundary` themes the whole app in the owner's brand (see [Tenant theming](#tenant-theming--owner-brand-throughout)); `ThemeProvider` is the underlying `VariableContextProvider` boundary |
| `BrandingScreen` (`screens/`)     | Brand palette editor: colour wheels + live preview + save (see [Brand editor](#brand-editor-58))                                                                                                |

## Image handling

Use `expo-image` (not RN `Image`) everywhere. `MoreScreen` account section uses `expo-image-picker` to let owners update their avatar photo.

## Booking swipe actions

`TodayScreen` `BookingCard` wraps pending bookings in `react-native-gesture-handler` `Swipeable`:

- Swipe **right** → confirm (haptic: notification success)
- Swipe **left** → decline (confirmation Alert + haptic: medium impact)

## 401 handling

`api.ts` creates an `authEvents` instance via `createAuthEvents()` (from `@repo/api-client`) and calls `authEvents.emitUnauthorized()` on 401. The `AppProvider` registers a handler that navigates to `/(auth)/sign-in` and resets all state. Token persistence uses `src/lib/native-token-store.ts` (Expo SecureStore adapter implementing the shared `TokenStore` interface).

## Dark mode

`tokens.ts` exports `DarkColors` (overrides neutrals/surfaces) and `useColors()` hook:

```ts
import { useColors } from "../tokens";
const Colors = useColors(); // returns DarkColors in dark mode, Colors otherwise
```

Existing screens use the static `Colors` import — migrate incrementally by switching to `useColors()`.

## Dev

```sh
bun run owner-app:dev   # from monorepo root
# or from this directory:
bun run start
```

## EAS Builds (Google Play)

See [docs/guides/eas-deployment.md](../../docs/guides/eas-deployment.md) for the full guide. Quick reference:

```sh
# From monorepo root:
bun run owner-app:build:dev      # debug APK (internal distribution)
bun run owner-app:build:preview  # preview APK (internal distribution)
bun run owner-app:build:prod     # production AAB for Google Play
bun run owner-app:submit         # submit latest build to Play Store
bun run owner-app:update         # OTA JS update (no store release needed)

# Or from this directory:
bun run build:prod && bun run submit:prod
```

Android package: `business.talash.bd` | EAS slug: `talash-owner`

## Testing

```sh
cd apps/owner-app && bun run test
```

Two layers of tests live in `src/__tests__/`:

**Pure helpers / adapters** — token-store, `money`/`shortMoney`, `formatDate`, pending-count filter, `nextBusinessStatus`/`isBusinessStatusToggleable`, `validateCoupon` bounds (incl. max-uses), and the `schedule.ts` helpers (`mergeWeekSchedule`/`serializeWeekSchedule` normalisers and `validateWeekSchedule` time bounds). Prefer this layer: push decision logic into pure functions in `data.ts`/`lib/` and assert it directly.

**Component tests (React Native Testing Library)** render real components:

- `WeekScheduleEditor.test.tsx` — seed-once: a refetch never clobbers edits (#8/#3); on `isError` it shows Retry and renders no Save button; invalid times show an inline error reactively.
- `CreateCouponSheet.test.tsx` — coupon validation gating + submit, incl. a `0` max-uses showing the inline error and blocking submit (#6).
- `sheets-forms.test.tsx` — service-edit hides the Branch picker (#1) and the Add sheets guard against double-submit (#4).
- `TodayScreen.status.test.tsx` — the status toggle flips an Active business but is inert for a Suspended one (#5).
- `AppProvider.test.tsx` — integration test rendering the real provider with a Probe consumer: `toggleStatus` no-op for Suspended (#5), `createCoupon` closes the sheet on success but stays open on error (#6), `updateStaff` maps the branch name → `branchId` (#1), and `goLive` creates branches then services with the right branch in one business, recovers without a duplicate business on failure, and surfaces the manual-completion message when a service's branch can't be resolved (#7).
- `branding.test.ts` / `useSaveBrandPalette.test.tsx` / `BrandingScreen.test.tsx` — brand editor (#58): default seeds + `palettesEqual`; save sends the palette (or `null`) and invalidates the owner business; the screen previews the draft, repaints on a colour change, saves the edited palette, and flashes the server's contrast-rejection message (#59).
- `theme-vars.test.ts` / `useBrandPalette.test.tsx` / `ThemeProvider.test.tsx` — tenant theming (#61): the seed → custom-property mapping omits static roles + `foreground`; `useBrandPalette` reads the cached business palette (or `null`); `ThemeBoundary` feeds the cached palette's mapped vars into the boundary and renders unwrapped when there's no palette. The runtime var-cascade is native-only (manual device smoke); these cover the logic up to the boundary.

> Harness caveat: `fireEvent.press` reaches a `Button`'s handler even when the button is visually disabled (the `Button` signals disabled by nulling `onPress` + dimming, not via host `disabled`/`accessibilityState`). So to assert a "disabled/blocked" action, prefer a structural/observable signal (the control is absent, or an inline error is shown) over `expect(handler).not.toHaveBeenCalled()` on a still-rendered disabled button.

The RNTL harness runs under vitest via **`vitest-native`** (`reactNative()` plugin), which mocks the RN module graph instead of transforming RN's Flow source. Config notes:

- The vitest config **must** be `vitest.config.mts` (ESM) — `vitest-native`'s preset is ESM-only and a `.ts` config loads as CJS and throws.
- `vitest.config.mts` aliases `@` → `src` (mirroring tsconfig) so `@/global.css` and friends resolve; the CSS itself is a no-op under vitest.
- `setup.ts` stubs the lucide-backed `Icon`/`Stars` (their `react-native-svg` dep uses native codegen vitest-native doesn't mock) and `expo-secure-store`. A test that renders a component importing **`nativewind`** must `vi.mock("nativewind", …)` (the real module pulls react-native-css's untransformed RN graph) — see `ThemeProvider.test.tsx`, which stubs `VariableContextProvider` and captures its `value`.
- Components that call `useQuery`/`useQueryClient` (e.g. screens) render via `renderWithClient` (`test-utils.tsx`), which wraps in a fresh `QueryClient`. `useApp` is mocked per-test, so no `AppProvider` is needed.
- Each test mocks the heavy boundaries its target pulls in: `sheets.tsx` is one big module, so sheet tests stub `../lib/api`, `../hooks/useOwnerData`, `expo-image-picker`, and `useApp`; screen tests also stub `expo-haptics`. **Every new native lib pulled into a tested component may need its own stub — keep component tests to lower-surface targets** (render screens with empty data lists to avoid the booking-card/gesture-handler path). `setup.ts` also stubs `@repo/ui-native`'s `Icon`/`Stars` **leaf modules** (by relative path, `../../../../packages/ui-native/src/components/{Icon,Stars}`): they `import * as Icons from "lucide-react-native"`, whose ESM build trips vitest-native, and `Stars` renders `<Icons.Star>` directly. Stubbing the leaf modules means lucide is never imported, every other shared component (Button, Card, Badge, StatusPill…) is the real implementation, and Badge/StatusPill still render their label text. (A whole-module `lucide-react-native` mock does **not** work here — vitest-native rejects a Proxy return, and a plain-object mock throws on any unlisted glyph via `Icons[name]`.)

Context-resident behaviors that live inside `AppProvider` (close-on-success vs stay-open-on-error, branch-name→`branchId` mapping, `goLive` concurrency/recovery) are covered by `AppProvider.test.tsx`. It renders the real provider with a Probe consumer and a full `api` mock (defined via `vi.hoisted` so the hoisted `vi.mock` factory can reference it). Drive auth by making the mocked `SecureStore.getItem` return a token (`isAuthed` seeds from it synchronously); stub `expo-router`, `../lib/push`, and the `useOwnerData` hooks the provider imports. Queries gate on `isAuthed`/`businessId`, so `await screen.findByText(...)` until the seeded state lands before acting.
