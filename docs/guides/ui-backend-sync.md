# UI ↔ Backend Sync

Conventions for wiring Next.js sites and Expo apps to `workers/api` via `@repo/api-client` and TanStack Query.

Archived rollouts: [ui-backend-sync-rollout.md](../history/ui-backend-sync-rollout.md) (web), [mobile-backend-sync-rollout.md](../history/mobile-backend-sync-rollout.md) (mobile). Coverage audit: [feature-map.md](../feature-map.md).

---

## Layering order

Add or change a feature in this order:

1. **API** — route + service/repository in `workers/api` (see [api-query-repository-pattern.md](api-query-repository-pattern.md))
2. **`@repo/api-client`** — typed method in `packages/api-client/src/endpoints/*.ts`, export from `index.ts`
3. **Hook** — `useQuery` / `useMutation` in the app's `src/hooks/`
4. **Screen / component** — present data and actions; keep API calls out of JSX
5. **Page / route** — wire hooks into screen props (Next.js `page.tsx` or expo-router file)

Do not call `api.*` directly from screen components when a hook already exists or should exist.

---

## Where hooks live

| App | Hook file(s) | Notes |
| --- | --- | --- |
| `sites/business-dashboard` | `src/hooks/useOwnerData.ts` | Owner web — see [business-dashboard AGENTS.md](../../sites/business-dashboard/AGENTS.md) |
| `sites/marketing-site` | Inline in `page.tsx` / colocated hooks | Customer web — prefer extracting when reused |
| `apps/mobile-app` | `src/hooks/*.ts` + `src/context.tsx` | Customer mobile — session/favourites in context |
| `apps/owner-app` | `src/hooks/useOwnerData.ts` + `src/context.tsx` | Owner mobile — setup flow in context |

---

## Query keys

Use stable, hierarchical keys so invalidation stays predictable:

```ts
["business", "owner"]           // owner's single business
["branches", businessId]
["services", branchId]
["business-products", businessId] // owner-app commerce catalog — gated on vertical === "commerce"
["products", "branch", branchId]  // customer mobile — branch product list (useBranchProducts)
["bookings", "branch", businessId, params]
["favourites"]
["business-photos", businessId]
["auth", "me"]               // apps + business-dashboard only — NOT marketing-site (see Auth note)
["addresses", "list"]        // customer saved delivery addresses (useAddresses)
["orders", "mine"]           // customer order list (useMyOrders)
["order", id]                // single order detail — staleTime: 0 so status always fresh (useOrder)
```

> **marketing-site is the exception:** it does **not** use an `["auth", "me"]` query — auth UI state lives in a zustand store (see the Auth note below). Its customer account page (`/account`) uses these keys instead: `["user", "me", userId]` (full profile for phone / photo / member-since), `["my-bookings"]`, `["my-reviews"]`, `["rewards", "balance"]`, `["rewards", "history"]`, `["auth", "sessions"]`, `["favourites"]`.

**After mutations, prefer `invalidateQueries` over `refetch()`** — lets all subscribers refresh consistently.

```ts
onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
```

For pull-to-refresh, invalidate the same keys the screen depends on (e.g. favourites + business-photos).

---

## Query patterns

### List with owner scope

```ts
export function useMyBusiness() {
  return useQuery({
    queryKey: ["business", "owner"],
    queryFn: async () => {
      const res = await api.businesses.list({ limit: 1 });
      return res.data[0] ?? null;
    },
    staleTime: 60_000,
  });
}
```

### Dependent query (`enabled`)

```ts
export function useBranches(businessId: string | null | undefined) {
  return useQuery({
    queryKey: ["branches", businessId],
    queryFn: () => api.branches.list(businessId!, { limit: 50 }),
    enabled: !!businessId,
    staleTime: 60_000,
  });
}
```

### Parallel fetches (`useQueries`)

Use when a screen needs per-item data (e.g. branch hours for every branch in a business). Set a reasonable `staleTime` (5 min is common for hours/photos).

### Fresh detail on open (`staleTime: 0`)

When a sheet or modal must reflect server state after push updates (e.g. booking status), fire a dedicated query on mount:

```ts
useQuery({
  queryKey: ["booking", booking.id],
  queryFn: () => api.bookings.get(booking.id),
  staleTime: 0,
});
```

### Server prefetch + hydration (marketing-site, web only)

For SEO/LCP-critical web surfaces, prefetch public data on the server and hand it to the client cache so the client renders from cache with no extra round-trip. Keep using TanStack Query everywhere — this only adds a prefetch in front of the existing client queries. Pieces (`sites/marketing-site/src/lib/`):

- **Shared query-options factories** (`queries.ts`) — one `queryOptions` factory per query, taking the API caller as a param so server and client produce **identical query keys**. Server passes `serverApi`, client passes the browser `api`. Keys must match or hydration won't dedupe.
- **Token-less server caller** (`api.server.ts`, `server-only`) — `createApi({ baseUrl, next: { revalidate: 300 } })`, no token store / `onUnauthorized`. Public reads only; never prefetch auth-gated queries (favourites stay client-only). The `next` forwards into the `fetch` init (`ApiClientConfig.next`) for Next's Data Cache — **inert until an OpenNext incremental cache is wired** (see page shell below).
- **Per-request QueryClient** (`query-client.server.ts`) — `cache(() => makeQueryClient())` so `generateMetadata` and the page body share one client (their fetches dedupe via `ensureQueryData`).
- **Prefetch helper** (`prefetch.ts`) — `Promise.allSettled` of `ensureQueryData(...)` so an upstream failure degrades to a client fetch + `QueryError` instead of crashing the page.
- **Page shell** (`businesses/[id]/page.tsx`) — `export const revalidate = N` (intended ISR; the route still renders on demand — the server caller now forwards `next: { revalidate }`, but **no OpenNext incremental-cache override is wired** (`open-next.config.ts`), so Cloudflare Workers can't persist the Data Cache across requests; wiring `r2IncrementalCache` + an R2 bucket is the remaining step. The SEO/LCP win doesn't depend on it), prefetch, then `<HydrationBoundary state={dehydrate(qc)}>`. A genuine 404 → `notFound()`; other failures degrade.

Client components consume the same factory: `useQuery(businessQuery(api, id))`. The home page (`app/page.tsx`) uses the same shape — reads `searchParams`, `prefetchHomeDiscovery`, `HydrationBoundary` around a **prop-driven** `SearchSection` (no `useSearchParams`, or the grid drops out of SSR HTML). Full design: [docs/superpowers/specs/2026-06-12-marketing-site-ssr-data-layer-design.md](../superpowers/specs/2026-06-12-marketing-site-ssr-data-layer-design.md).

---

## Mutation patterns

```ts
export function useConfirmBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.bookings.confirm(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
  });
}
```

Destructive actions (delete business, delete account): confirm in UI → mutation → `qc.clear()` or targeted invalidation → sign out / redirect as needed.

---

## File uploads

The API reads multipart field name **`file`** (via `parseBody()`), not `photo`:

```ts
const fd = new FormData();
fd.append("file", file);
await api.businesses.uploadPhoto(businessId, fd);
```

Wrong field names fail with 422 "No file uploaded" with no visible UI error if not handled.

---

## Mobile adapters

Expo apps map API DTOs to UI models in `src/lib/adapters.ts`. Keep orchestration in `context.tsx`, not inline in screens.

```ts
// adaptService, adaptBusiness, adaptBranch, adaptBusinessDetail, etc.
```

Add fields to `src/data.ts` UI types when the API exposes new properties (e.g. `photoUrl`, `mapLat`/`mapLng`).

---

## Auth and 401 handling

- **Web (marketing-site, business-dashboard):** tokens stored via `webTokenStore` from `@repo/api-client` (localStorage, SSR-safe); re-exported as `tokenStore` from each site's `src/lib/api.ts`. `api.auth.logout()` before clearing tokens on sign-out.
- **marketing-site auth state (zustand, exception to the pattern):** UI auth state is a zustand store (`src/stores/auth-store.ts`) — the single source of truth (`user` + `status`: `unknown | authenticated | unauthenticated`), **not** a TanStack `["auth","me"]` query. `tokenStore` holds the raw tokens and is the **sole credential**; the persisted `user` is a display-only cache, never trusted without a live token. `AuthProvider` (in `Providers`) bootstraps once via `api.auth.me()` → `setUser`, and clears the React Query cache on the transition to `unauthenticated`. `useAuth()` selects from the store (`{ user, status, isLoading, signOut }`). Full rationale: [ADR 0001](../adr/0001-marketing-site-auth-state-with-zustand.md). The other three clients keep the `["auth","me"]` query pattern.
- **Mobile (mobile-app, owner-app):** tokens stored via `src/lib/native-token-store.ts` (Expo SecureStore adapter implementing the shared `TokenStore` interface from `@repo/api-client`). `authEvents` instance created via `createAuthEvents()` in `api.ts`; `AppProvider` registers an `onUnauthorized` handler that clears cache and navigates to sign-in.
- **Google OAuth + email/password** — see [email-password-auth.md](email-password-auth.md). No OTP flows.

Owner onboarding sequence (web and mobile): `businesses.create` → `branches.create` → `services.create`.

---

## Owner vs customer surfaces

| Surface | Primary modules |
| --- | --- |
| marketing-site | search, businesses, bookings (customer), reviews, rewards, coupons at checkout |
| business-dashboard | bookings, services, team, branches, analytics, campaigns, coupons, settings |
| mobile-app | search, businesses, bookings, favourites, rewards, notifications, commerce orders (commerce vertical) |
| owner-app | bookings, services **or products** (per `business.vertical`, ADR-0004), team, branches, campaigns, business settings, orders (commerce vertical), customer dues / khata (commerce vertical) |

Check [feature-map.md](../feature-map.md) before assuming a gap — multi-line `api.*` chains are easy to miss in grep audits.

### Vertical-aware discovery (mobile-app)

`SearchScreen` has a `Salons | Gas sellers` segment and `useBusinessSearch` is vertical-aware, passing `vertical`/`area`/`lat`/`lng` to `api.search.businesses`. Booking → AI-ranked text search; commerce → sellers matched by area or nearest-first via device GPS. Commerce discovery uses `useDeviceLocation` (on-demand GPS) and `useRecentSellers` (distinct past sellers for the "Order again" reorder row).

### Customer order-flow (mobile-app — commerce vertical)

Wiring path: `@repo/api-client` order/address/product endpoints → `src/hooks/useOrders.ts` → cart (`src/lib/cart.ts`) + adapters (`src/lib/adapters.ts`) → `CommerceBusinessScreen` / `MyOrdersScreen` / `OrderDetailSheet`.

**Hooks in `src/hooks/useOrders.ts`:**

| Hook | Query / mutation | Key rule |
| --- | --- | --- |
| `useBranchProducts` | `products.list(branchId)` | `["products", "branch", branchId]`; `enabled: !!branchId` |
| `useAddresses` | `customerAddresses.list()` | `["addresses", "list"]`; `enabled: isAuthed` |
| `useSaveAddress` | `customerAddresses.create()` | invalidates `["addresses", "list"]` on success |
| `useMyOrders` | `orders.listMine()` | `["orders", "mine"]`; `enabled: isAuthed` |
| `useOrder` | `orders.get(id)` | `["order", id]`; `staleTime: 0` — mirrors `BookingDetailSheet` pattern |
| `useCreateOrder` | `orders.create()` | invalidates `["orders", "mine"]` on success |
| `useCancelOrder` | `orders.cancel(id)` | invalidates both `["orders", "mine"]` and `["order", id]` on success |

**Cart logic (`src/lib/cart.ts`):** pure functions (`addToCart`, `setQty`, `removeFromCart`, `cartTotal`, `toOrderItems`) with no API calls. Tested in `src/__tests__/cart.test.ts`.

**Adapters (`src/lib/adapters.ts`):** `adaptOrder`, `adaptOrderItem`, `adaptCustomerAddress` map api-client DTOs to `Order`, `OrderItem`, `CustomerAddress` UI models in `src/data.ts`. Tested in `src/__tests__/order-adapters.test.ts`.

**409→"Out of stock" mapping:** `CommerceBusinessScreen` catches `ApiError.status === 409` from `useCreateOrder` and surfaces a toast with the copy "Out of stock" instead of a generic error. Pattern mirrors the booking-slot-conflict handling.

**Money:** amounts displayed via `formatMoney` (BDT / `en-BD`) from `src/lib/format.ts`.

**Order notifications and deep-link:**

The customer mobile notification feed (`api.notifications`) receives order status-change notifications with two fields:

- `go: "orders"` — routes to the My Orders sub-view (Account → My Orders list)
- `orderId: string` — the order involved (carried for reference; not used to open a specific order on tap)

`tapNotif` in `context.tsx` handles `go === "orders"` by calling `router.navigate({ pathname: "/(tabs)/account", params: { view: "orders" } })`. `AccountScreen` reads the `view` route param (allowlisted, auth-gated) and opens the My Orders sub-view.

Notification `type` is `"order"` for forward transitions (Confirmed, OutForDelivery, Delivered) and `"order_cancelled"` for cancellations (owner- or customer-initiated) — a distinct type so the customer feed renders a struck-through-package (`PackageX`) icon instead of the generic system/shield glyph. Booking cancellations keep the shared `"cancel"` type. `mapNotificationType` (`apps/mobile-app/src/lib/adapters.ts`) maps `order_cancelled` to its own local view-model type; `NOTIF_STYLE` (`NotificationsScreen.tsx`) gives it the danger-toned icon. Order placement does **not** trigger a notification. Both fields are present on `AppNotification` from `@repo/api-client`.

### Owner order-flow (owner-app — commerce vertical)

Entry: **More → Orders** (`/orders` route; hidden for booking businesses). Wiring path: `@repo/api-client` order endpoints → `src/hooks/useOwnerData.ts` → `OrdersScreen` / `OrderDetailSheet`.

**Hooks in `src/hooks/useOwnerData.ts`:**

| Hook | Query / mutation | Key rule |
| --- | --- | --- |
| `useBranchOrders` | `orders.listByBranch(id)` per id, merged via `Promise.all().flat()` | `["branch-orders", [...branchIds].sort().join(",")]`; `enabled: branchIds.length > 0` |
| `useOrder` | `orders.get(id)` | `["order", orderId]`; `enabled: !!orderId` |
| `useUpdateOrderStatus` | `orders.updateStatus(id, status)` | invalidates `["branch-orders"]` + `["order", id]` on success |

`updateStatus(id, "Cancelled")` is the owner-cancel path — backend restores stock and notifies the customer. The guided next-status button follows `nextOrderStatus` / `nextOrderActionLabel` (`data.ts`): Pending → Confirmed → OutForDelivery → Delivered. Cancel is available while `isOrderCancellable` (Pending or Confirmed); confirmed via `Alert` before firing. `adaptOrderLine` (`adapters.ts`) resolves product names from the commerce `products` list.

### Owner khata surface (owner-app — commerce vertical)

Entry: **More → Customer dues** (`/khata` route; hidden for booking businesses). Wiring path: `@repo/api-client` khata/payment endpoints → `src/hooks/useOwnerData.ts` → `KhataScreen` / `KhataCustomerLedger` / `RecordPaymentSheet`.

Owner Khata (Customer dues) screen/ledger → `api.khata.dues` / `api.khata.customerLedger`; record/void → `api.payments.record` / `api.payments.void`. Commerce-vertical only, reached from More → Customer dues. Mutations invalidate `["khata-dues"]` + `["khata-customer", userId, businessId]`.

**Hooks in `src/hooks/useOwnerData.ts`:**

| Hook | Query / mutation | Key rule |
| --- | --- | --- |
| `useKhataDues` | `khata.dues(businessId)` | `["khata-dues", businessId]`; `enabled: !!businessId` |
| `useKhataCustomer` | `khata.customerLedger(userId, businessId)` | `["khata-customer", userId, businessId]`; `enabled: !!userId && !!businessId` |
| `useRecordPayment` | `payments.record(...)` | invalidates `["khata-dues"]` + `["khata-customer", userId, businessId]` on success |
| `useVoidPayment` | `payments.void(id)` | same invalidation; void confirmed via `Alert` |

`KhataScreen` mirrors `CustomersScreen` — a `selected`-state toggle switches between the debtor list and `KhataCustomerLedger` (rendered in-file with its own `BackHeader`, not a sheet). The list shows customers with `due > 0`; a **total outstanding** header uses `totalOutstanding` from `data.ts`. `RecordPaymentSheet` (`SheetType.recordPayment`) prefills the amount to the current due (editable; digit-only input) and closes on success. Khata is **business-level** (no `BranchSwitcher`).

**Balance display rule:** `due = Σ delivered-order totals − Σ payments` — no stored balance; always fresh from API.

### Owner earnings analytics (business-dashboard + owner-app — booking vertical)

Wiring path: `api.analytics.earnings({ businessId, range })` → `useQuery(["analytics","earnings",businessId,range])` → "Earnings" section on both the business-dashboard analytics page (`sites/business-dashboard/src/app/(dashboard)/analytics/page.tsx`) and the owner-app `AnalyticsScreen.tsx`. Uses the shared `range` selector (7|30|90 days). Response: `{ total, byStaff[], byService[], byBranch[], overTime[] }` — discount netted, bucketed by slot date; staffless Completed bookings roll into an "Unassigned" bucket in `byStaff`.

---

## Adding a new integration (checklist)

- [ ] API route exists and returns the shape `api-client` expects (`{ data: T[] }` for lists)
- [ ] `packages/api-client` method added and exported
- [ ] Hook with query key + `invalidateQueries` on mutation
- [ ] Screen wired; loading / error / empty states
- [ ] Mobile: adapter updated if UI model differs from DTO
- [ ] Tests for API route (see [testing.md](testing.md))
- [ ] Update [feature-map.md](../feature-map.md) and app `AGENTS.md` in the same PR

---

## Related docs

- [api-query-repository-pattern.md](api-query-repository-pattern.md) — backend modules
- [testing.md](testing.md) — route and service tests
- [responsive-layout.md](responsive-layout.md) — mobile/tablet layout
- [apps/mobile-app/AGENTS.md](../../apps/mobile-app/AGENTS.md) — customer app specifics (incl. [tenant theming boundary](../../apps/mobile-app/AGENTS.md#tenant-theming--the-variablecontextprovider-boundary))
- [apps/owner-app/AGENTS.md](../../apps/owner-app/AGENTS.md) — owner app specifics
- [sites/marketing-site/AGENTS.md](../../sites/marketing-site/AGENTS.md) — marketing site specifics
- [sites/business-dashboard/AGENTS.md](../../sites/business-dashboard/AGENTS.md) — owner dashboard specifics
