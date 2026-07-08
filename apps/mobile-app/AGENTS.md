# Mobile App — agent guide

Customer-facing Expo app. Stack: **Expo 56** + **expo-router** + **React Native** + **NativeWind**.

**Expo APIs change between versions. Read versioned docs before writing any Expo or expo-router code:**
https://docs.expo.dev/versions/v56.0.0/

## Documentation update policy

- Any feature implementation, refactor, or behavior change in this app must include documentation updates in the same task/PR.
- Update the most relevant existing docs first (this file, linked guides, and cross-repo docs when affected).
- Any feature implementation or refactor must run lint, tests, and build before completion (`bun run lint`, `bun run mobile-app:test`, and `bun run mobile-app:build` or `cd apps/mobile-app && bun run build`, or equivalent scoped commands).
- Do not consider the task complete until code and docs are both updated and consistent.

## Layout

```
src/app/        # expo-router file-based routes
src/components/ # shared UI components
src/hooks/      # custom hooks
src/constants/  # design tokens, config
```

## Authentication

Google OAuth and email/password. `AuthScreen.tsx` is a thin switcher that lazy-loads `AuthScreenRedirect.tsx` (default, Expo Go) or `AuthScreenNative.tsx` (EAS builds) based on `EXPO_PUBLIC_AUTH_PROVIDER`. Google callback scheme: `mobileapp://auth/callback`. Email/password uses `EmailPasswordAuth` (login/register/forgot). Reset deep link: `mobileapp://auth/reset-password`. After sign-in, `onAuthed` → `context.signIn` → Account tab.

Full flow reference: [docs/guides/google-auth.md](../../docs/guides/google-auth.md) · [docs/guides/email-password-auth.md](../../docs/guides/email-password-auth.md)

Do **not** add OTP auth.

## Key conventions

- Routing: expo-router file-based (`src/app/`). Use `<Link>` and `router.push()`. Business detail: `openBusiness(business)` → `/business?id=…`; push notifications with `businessId` open the same route. `primeBusiness` hydrates context when loading by id only.
- **Vertical-aware business detail (ADR-0004):** `/business` renders a per-vertical experience via the registry in `src/lib/businessExperiences.ts` (`vertical → screen`): `booking` → `BusinessScreen` (salon/spa), `commerce` → `CommerceBusinessScreen` (LPG ordering; placeholder until #71+). The UI `Business` model carries `vertical` (`src/data.ts`, set in `adaptBusinessDetail`). **Never branch on `vertical` in a screen — register it in the map.** Discovery is vertical-aware (#75): results carry their real `vertical`, and the Search tab has a `Salons | Gas sellers` segment.
- Styling: NativeWind (Tailwind class names on React Native components via `className`).
- **NativeWind PostCSS:** `postcss.config.mjs` with `@tailwindcss/postcss` is required — without it Metro's web CSS pass leaves only `@source` in `global.css`, and `react-native-css`/lightningcss fails to compile.
- **lightningcss pin:** root `package.json` overrides `lightningcss` to `1.30.1`; each Expo app also lists it as a direct dependency (required by NativeWind v5 — newer versions break `global.css` compilation). After changing overrides, run `bun install` from the monorepo root.
- Global CSS: `src/global.css` — import once at the app entry. It also has
  `@source "../../../packages/ui-native/src/**/*.{ts,tsx}"` so NativeWind scans the
  shared component library — **do not remove it**, or classes used only in
  `@repo/ui-native` (e.g. `bg-info-bg`, `bg-pending-bg`, `border-primary-200`) stop
  generating (#64).
- Shared UI primitives (`Avatar`, `Badge`, `Button`, `Card`, `Divider`,
  `Eyebrow`, `Icon`, `Stars`, `Switch`, `SectionTitle`) come from
  `@repo/ui-native`, re-exported via `src/components/ui` (#64/#96). Button variant
  is `subtle` (not `secondary`); Badge default variant is `default` (not
  `neutral`). App-specific components (`Input`, `Photo`, `AppText`, …) stay in
  `src/components/ui`.

## Responsive layout

Phones, tablets, and landscape — use `useLayout`, `ScreenContainer`, and tablet sidebar tabs. Full reference: [docs/guides/responsive-layout.md](../../docs/guides/responsive-layout.md).

## Tenant theming — the `VariableContextProvider` boundary

Per-tenant brand colours are applied at runtime by overriding CSS custom properties for a single subtree, not by swapping stylesheets ([ADR-0002](../../docs/adr/0002-themeable-scope-and-boundary.md), [ADR-0003](../../docs/adr/0003-custom-palette-contrast.md)).

- **Themeable roles** (a tenant palette may override): `--color-primary`, the **derived primary ramp** `--color-primary-{soft,muted,strong,deep}` (#97), `--color-accent`, `--color-surface`. These back `bg-primary`/`text-primary`/`bg-accent`/`bg-surface` **plus the shared `@repo/ui-native` Button/Badge brand variants** (`primary`/`subtle`/`dark` buttons, `brand` badge), which now repaint per tenant. The ramp steps are derived from the primary seed by `derivePrimaryTints` (`@repo/tokens`) inside `paletteToVars`; the same derivation feeds the API WCAG gate (see [ADR-0002](../../docs/adr/0002-themeable-scope-and-boundary.md#component-theming--derived-primary-ramp-97)).
- **Static roles** (never tenant-themeable): ink/neutrals (`--color-ink*`, `--color-line*`) and semantic status (`--color-success`/`danger`/`pending`/`info`). They hold inside a themed subtree.
- **`foreground` is deferred** — the palette's 4th seed has no token yet; ink stays static (#59/#60).

Wrap a single-tenant subtree in `ThemeProvider`:

```tsx
import { ThemeProvider } from "../components/ThemeProvider";
import { DEMO_BRAND_PALETTE } from "../lib/theme-vars";

<ThemeProvider palette={DEMO_BRAND_PALETTE}>
  {/* bg-primary / bg-accent / bg-surface repaint here; status + ink hold */}
</ThemeProvider>;
```

- `palette={null}` → no override → Talash defaults (the fallback contract #60/#61 rely on).
- `ThemeProvider` uses NativeWind v5's `VariableContextProvider` (the var-cascade primitive, **not** a hand-rolled palette context) to scope the overrides to its descendants. Everything outside the subtree is untouched.
- `paletteToVars` (`src/lib/theme-vars.ts`) maps palette seeds → custom properties; it is the pure, tested core. `ThemeProvider` trusts its input — hex validity + WCAG-AA contrast are enforced server-side at save (#59).
- `BrandPalette` is a local type today, mirroring `@repo/api-client`'s; it becomes the import once that ships (#89).

**Venue reskin + cross-venue accent (#60).** The `Business` UI model (`src/data.ts`) carries `brandPalette` — mapped from the API by `adaptBusinessDetail` (detail) and the `useBusinessSearch` adapter (list rows; the search API returns `brandPalette` on each result). Two distinct treatments (ADR-0002):

- **Full reskin** in the single-tenant context. The booking flow spans **three sibling routes**, each wrapped in its own `<ThemeProvider>` boundary so the reskin survives navigation: `business.tsx` (detail) themes from the loaded/primed venue; `booking.tsx` themes from `pendingBooking.business.brandPalette`; `confirm.tsx` from `confirmedBooking.business.brandPalette`. Each boundary is scoped to its route, so it never leaks into the cross-venue list/search screens; `null` → Talash defaults.
- **Per-item accent** in cross-venue lists: `BusinessCard` (`SearchScreen.tsx`) shows a thin stripe in `business.brandPalette.accent` — **never** a full reskin in mixed lists. Neutral when the venue has no palette.

## Offline (read-only)

TanStack Query cache persists to MMKV via `@repo/mobile-query`. Root layout uses `MobilePersistQueryClientProvider`, `OfflineBanner`, and `PendingSyncBanner`. `OutboxSyncProvider` in context flushes the mutation outbox on reconnect. Queueable offline writes: favourites toggle, cancel pending booking, notification read. `signOut()` calls `clearPersistedCache(MOBILE_APP_ID)` and `clearOutbox(MOBILE_APP_ID)`. Other mutations gate with `useOnlineGuard()`. Executors: `src/lib/outbox-executors.ts`. Full guide: [docs/guides/mobile-offline.md](../../docs/guides/mobile-offline.md).

## Key libraries & hooks

| Hook / module                         | Purpose                                                                                                                                   |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/hooks/useDebounce.ts`            | Generic debounce (300ms default); used in SearchScreen to prevent per-keystroke API calls                                                 |
| `src/hooks/useDeviceLocation.ts`      | On-demand device GPS for commerce discovery (nearest-first seller ranking in the Gas sellers segment)                                     |
| `src/hooks/useRecentSellers.ts`       | Distinct past sellers for the commerce "Order again" reorder row                                                                          |
| `src/hooks/useNetworkStatus.ts`       | Re-exported from `@repo/mobile-query` (NetInfo); drives shared `OfflineBanner`                                                            |
| `src/hooks/useLayout.ts`              | Responsive layout: `{ isTablet, isLandscape, contentWidth }`                                                                              |
| `src/hooks/useFavouriteBusinesses.ts` | Fetches business details + first cover photo per favourite ID; used in `FavouritesScreen`                                                 |
| `src/lib/native-token-store.ts`       | Native SecureStore adapter implementing the shared `TokenStore` interface from `@repo/api-client`                                         |
| `src/lib/format.ts`                   | BDT money and `en-BD` dates (`formatMoney`, `formatShortMoney`, `formatDate`)                                                             |
| `src/lib/i18n.ts`                     | `t(key)` with `en` + `bn`; device locale via `expo-localization`; `LocaleProvider` in root layout                                         |
| `src/hooks/useOrders.ts`              | Commerce order flow: `useBranchProducts`, `useAddresses`, `useSaveAddress`, `useMyOrders`, `useOrder`, `useCreateOrder`, `useCancelOrder` |
| `src/hooks/useWalkIn.ts`              | Walk-in QR flow: `useWalkInContext`, `useWalkInSubmit` (`api.walkIn`)                                                                     |
| `src/lib/walk-in-url.ts`              | Parse walk-in universal links and `mobileapp://walk-in` deep links                                                                        |
| `src/lib/cart.ts`                     | Pure cart logic: `addToCart`, `setQty`, `removeFromCart`, `cartTotal`, `toOrderItems`                                                     |

## Components

| Component            | Notes                                                                                                                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OfflineBanner`      | From `@repo/mobile-query` — amber when offline with cached data, red when no cache                                                                                                                                                |
| `Walkthrough`        | 3-step first-launch carousel; uses `expo-secure-store` to track whether it's been seen                                                                                                                                            |
| `ErrorBoundary`      | Class-component error boundary (Lucide alert); wraps full navigator                                                                                                                                                               |
| `SignInPrompt`       | Reusable empty state with CTA to Account tab when `!isAuthed`                                                                                                                                                                     |
| `BusinessRouteShell` | Loading / error / missing states for `/business` deep links                                                                                                                                                                       |
| `Toast`              | Module-level singleton `toast.show()`; renders via `ToastProvider` in root layout                                                                                                                                                 |
| `ScreenContainer`    | Centers content at 800pt max on tablet; transparent on phone                                                                                                                                                                      |
| `ThemeProvider`      | Scopes a tenant brand palette to a subtree via NativeWind `VariableContextProvider` — see [Tenant theming](#tenant-theming--the-variablecontextprovider-boundary)                                                                 |
| `BookingDetailSheet` | Bottom sheet opened by tapping a booking row; shows service, business, price, coupon, and action buttons                                                                                                                          |
| `OrderDetailSheet`   | Bottom sheet opened by tapping an order row in `MyOrdersScreen`; mirrors `BookingDetailSheet` pattern — fires `useOrder` with `staleTime: 0` on mount; shows Cancel button only for Pending/Confirmed orders via `useCancelOrder` |

## Image handling

Use `expo-image` (not RN `Image`) everywhere. The `Photo` component in `ui.tsx` already uses it:

```tsx
<Photo tone={business.tone} height={150} uri={optionalUrl} />
```

`BusinessScreen` uses `PhotoGallery` — a horizontal paging `FlatList` with dot indicators. It also fetches branch opening hours via `useQueries` + `api.branches.getHours` for all branches in the business, then displays the selected branch's schedule between the branch selector and the services list.

## Booking flow

Search → business detail (`useBusinessDetail`: `businesses.get`, `branches.list`, `services.list`) → booking screen → `api.bookings.create` with ISO slot and optional `couponCode` from `api.coupons.validate`.

**Booking slots:** `BookingScreen` loads `api.branches.getAvailability(branchId, { date, serviceId })` for server-filtered slots (hours + conflicts). Closed days and empty slots use `t("booking.*")` copy. Slot conflicts surface via `ApiError` toast on failed create.

**Map:** Search results include `lat`/`lng` when the API provides them (`adaptBusiness` → `mapLat`/`mapLng`). `useBusinessMapCoordinates` only fetches branches for businesses missing coords. `MapScreen` plots geo pins when coordinates exist, otherwise hash fallback.

**Payments:** Checkout shows **Pay at business** only (`PAY_AT_BUSINESS` in `data.ts`) until a payment API exists. Account → Payment explains the same.

`BusinessScreen` also fetches `api.branches.getHours` per branch (cached 5 min) and shows the selected branch's weekly schedule.

`context.tsx` hydrates the session on launch via `auth.me` when a token exists in SecureStore.

`BookingsScreen` uses swipe-to-cancel for Pending/Confirmed rows; tapping a row opens `BookingDetailSheet`. Reviews are offered on **Completed** bookings. List rows are enriched via `useEnrichedBookings` (`src/lib/adapters.ts`); reviewed IDs persist in SecureStore. Rewards hooks: `src/hooks/useRewards.ts`. Account sessions use `auth.listSessions` / `auth.revokeSession`.

`BookingDetailSheet` fires `useQuery({ queryKey: ["booking", id], staleTime: 0 })` on mount so the status pill and action buttons always reflect the server's current state (covers push-notification-delivered updates). The enriched business/service/branch data still comes from the prop passed by the caller.

**Favourites** are server-synced: `context.tsx` holds a `Set<string>` of saved business IDs via `api.favourites.list`; `toggleSave` calls `api.favourites.add/remove` with optimistic updates. `useFavouriteBusinesses` (`src/hooks/useFavouriteBusinesses.ts`) fetches business details + first cover photo (`api.businesses.listPhotos`) per saved ID and is used by `FavouritesScreen`. `FavouritesScreen` has pull-to-refresh via `RefreshControl` — on pull it invalidates `["favourites"]` and `["business-photos"]` query keys.

**Search filters** (`SearchScreen` → `FilterSheet`): supports city/area text, min/max price, min rating, and sort order. `BusinessSearchFilters.city` maps to `api.search.businesses({ city })`. Cover photos from search results (`coverPhotoUrl`) are displayed in both `BusinessCard` and `BusinessTile` via the `Photo` component's `uri` prop. The Search tab also has a `Salons | Gas sellers` segment; in the Gas (commerce) segment sellers are found by device GPS (nearest-first) or a manual area picker (`branches.area`), the booking filter sheet is hidden, and an "Order again" row surfaces past sellers.

**Reviews**: `api.reviews.list` returns `userName` (reviewer's display name) from a server-side JOIN on the users table. `BusinessScreen` maps it to the review card; falls back to "Guest" if null.

**Service photos**: `Service` in `src/data.ts` has `photoUrl?: string | null`. `adaptService` in `src/lib/adapters.ts` maps `s.photoUrl` from the API response. `BusinessScreen` renders a `56×56` rounded `expo-image` thumbnail to the left of each service row when `photoUrl` is present.

**BusinessScreen loading skeleton**: while `detailQuery.isLoading && !detailQuery.data`, shows a gallery-height grey block followed by title/metadata/service row skeletons instead of a plain text spinner.

## Commerce / order flow

`CommerceBusinessScreen` is the vertical-aware screen registered for `vertical === "commerce"` in `src/lib/businessExperiences.ts`. It presents product lists with qty steppers, a sticky cart bar, and an in-screen checkout sub-view (address pick/add + place order).

**Cart logic** lives in `src/lib/cart.ts` — pure functions with no side effects (`addToCart`, `setQty`, `removeFromCart`, `cartTotal`, `toOrderItems`). Tests: `src/__tests__/cart.test.ts`.

**Hooks** are in `src/hooks/useOrders.ts`:

| Hook                | Purpose                                                                   |
| ------------------- | ------------------------------------------------------------------------- |
| `useBranchProducts` | Fetch product catalogue for a branch (`["products", "branch", branchId]`) |
| `useAddresses`      | Fetch customer's saved delivery addresses (`["addresses", "list"]`)       |
| `useSaveAddress`    | Create a new address; invalidates `["addresses", "list"]`                 |
| `useMyOrders`       | Fetch all orders for the signed-in customer (`["orders", "mine"]`)        |
| `useOrder`          | Single order detail with `staleTime: 0` (`["order", id]`)                 |
| `useCreateOrder`    | Place a new order; invalidates `["orders", "mine"]`                       |
| `useCancelOrder`    | Cancel an order; invalidates `["orders", "mine"]` and `["order", id]`     |

**409 handling:** `useCreateOrder` 409 responses are caught in `CommerceBusinessScreen` and surfaced as an "Out of stock" toast via `ApiError.status`.

**Adapters** (`src/lib/adapters.ts`): `adaptOrder`, `adaptOrderItem`, `adaptCustomerAddress` map api-client DTOs to `Order`, `OrderItem`, `CustomerAddress` UI models (`src/data.ts`). Tests: `src/__tests__/order-adapters.test.ts`.

**My Orders** is an Account sub-view (`MyOrdersScreen`). Tapping a row opens `OrderDetailSheet` — a bottom sheet that mirrors `BookingDetailSheet` and fires `useOrder` with `staleTime: 0` on mount. Cancel is shown only for Pending/Confirmed orders.

**Order-status deep-link:** notifications with `go === "orders"` route to the My Orders sub-view via `tapNotif`, which builds its nav params with the pure `orderNotifParams` helper (`src/lib/adapters.ts`, unit-tested). When the notification payload carries an `orderId` it adds it to the params (`{ view: "orders", orderId }`) to **deep-link straight to that order's detail sheet**; otherwise it opens the My Orders list (`{ view: "orders" }`). `AccountScreen` reads the `view` param (allowlisted, auth-gated) to open the sub-view and passes `orderId` to `MyOrdersScreen` as `focusOrderId`; `MyOrdersScreen` auto-opens `OrderDetailSheet` for that order once the list has loaded (guarded against re-pop on refetch, falls back to the list if the order isn't loaded). `focusOrderId` is cleared on exit so a later manual entry into My Orders never re-pops a stale order. The local `Notification` model (`src/data.ts`) carries `orderId`, mapped by `adaptNotification`.

## Walk-in QR (B1 online / B2 LAN)

Counter walk-in flow: scan branch or session QR → fast booking/order without search or delivery address. Entry: Account tab **Scan shop QR** or deep link / universal link.

| Route              | Screen                | Purpose                                                                 |
| ------------------ | --------------------- | ----------------------------------------------------------------------- |
| `/walk-in/scan`    | `WalkInScanScreen`    | `expo-camera` QR scan → routes by vertical                              |
| `/walk-in/booking` | `WalkInBookingScreen` | Service list → book next slot; guest name/phone when anonymous          |
| `/walk-in/order`   | `WalkInOrderScreen`   | Product cart (`cart.ts`) → pay at counter; guest fields when anonymous  |
| `/walk-in/confirm` | `WalkInConfirmScreen` | Receipt summary + `react-native-qrcode-svg` encoding `{ localId }` JSON |

**Hooks:** `useWalkInContext` / `useWalkInSubmit` (`src/hooks/useWalkIn.ts`) — online uses `api.walkIn`; LAN fallback via `@repo/walk-in-sync` when Wi‑Fi works without mobile data. `WalkInConnectivityBanner` on walk-in routes. `useWalkInDeepLink` listens for `mobileapp://walk-in?…` and `https://talash.app/w/{branchId}` in `AppProvider`. URL parsing: `src/lib/walk-in-url.ts`. Each booking/order route wraps `ThemeProvider` when `brandPalette` is in the walk-in context snapshot. LAN requires EAS build (not Expo Go).

## 401 handling

`api.ts` creates an `authEvents` instance via `createAuthEvents()` (from `@repo/api-client`) and calls `authEvents.emitUnauthorized()` on 401. The `AppProvider` registers a handler that clears query cache, resets auth state, and navigates to the Account tab (sign-in prompt). Token persistence uses `src/lib/native-token-store.ts` (Expo SecureStore adapter implementing the shared `TokenStore` interface).

## Dev

```sh
bun run mobile-app:dev   # from monorepo root (Expo Go / simulator)
```

## EAS Builds (Google Play)

See [docs/guides/eas-deployment.md](../../docs/guides/eas-deployment.md) for the full guide. Quick reference:

```sh
# From monorepo root:
bun run mobile-app:build:dev      # debug APK (internal distribution)
bun run mobile-app:build:preview  # preview APK (internal distribution)
bun run mobile-app:build:prod     # production AAB for Google Play
bun run mobile-app:submit         # submit latest build to Play Store
bun run mobile-app:update         # OTA JS update (no store release needed)

# Or from this directory:
bun run build:prod && bun run submit:prod
```

Android package: `talash.bd` | EAS slug: `talash-customer`

## Testing

```sh
cd apps/mobile-app && bun run test
```

Tests live in `src/__tests__/`. Covers: token-store, utility formatters (`formatWhen`, `activeFilterCount`, `money`, `shortMoney`), debounce timing, cart logic (`cart.test.ts`), order + address adapters (`order-adapters.test.ts`), tenant theme-var mapping (`theme-vars.test.ts`), venue brand-palette mapping (`business-adapters.test.ts`, #60). The suite is logic-only (no RN render harness): `theme-vars.test.ts` covers the seed → custom-property **mapping** only. `ThemeProvider`'s runtime **cascade** rests on NativeWind's `VariableContextProvider` and is confirmed by manual smoke on a device/simulator (see the [Tenant theming](#tenant-theming--the-variablecontextprovider-boundary) section) — that smoke is **not** exercised by this suite.
