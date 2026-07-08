# Owner-App Order Management — Design

**Date:** 2026-06-10
**Status:** Approved (brainstorming)
**Vertical:** commerce only (booking businesses have no orders)

## Goal

Give a commerce business owner/manager a surface in the owner-app to:

1. See incoming orders for a branch.
2. Drill into an order (items, delivery address, total, status).
3. Advance an order through fulfillment (`Pending → Confirmed → OutForDelivery → Delivered`).
4. **Cancel** an unfulfillable order (restoring stock) via the Plan 3 backend.

This is the owner-facing consumer of the already-merged order-flow backend (Plans 1–3). The api-client already exposes everything required — no API or backend work.

## Context

- **Backend (done, merged):** `PATCH /api/v1/orders/:id/status` accepts `Confirmed | OutForDelivery | Delivered | Cancelled`. `Cancelled` routes through the restore-aware `doCancel` path (stock restored, customer notified). Forward transitions are a forward-only machine; cancel is allowed only from `Pending | Confirmed`. Owner access is branch-scoped via `assertOrderAccess`.
- **api-client (done):** `orders.listByBranch(branchId) → Order[]`, `orders.get(id) → OrderWithItems`, `orders.updateStatus(id, status) → Order`.
- **Owner-app today:** no order surface at all. Tabs are Today / Bookings / Services / Reviews / More. `ProductsScreen` is the commerce catalog (ADR-0004 vertical registry). Secondary surfaces (Customers, Campaigns, Coupons, Team, Analytics) are standalone file-based routes reached from the More hub.
- **`OrderWithItems.items`** carry `productId`, `quantity`, `unitPrice` — **no product names** (the customer app resolves names client-side; the owner app does the same from its commerce `productsQuery`). Orders carry `userId` but **no customer name**.

## Navigation & vertical-gating

- New file-based route **`src/app/orders.tsx`** renders `OrdersScreen`.
- Reached from a **More-hub menu item "Orders"** (sub: "Incoming & fulfillment"), placed in a commerce-appropriate group.
- The Orders menu item is rendered **only when `business.vertical === "commerce"`**. This is a menu-level conditional; ADR-0004's "never branch on `vertical`" rule targets the catalog *tab swap* in `(tabs)/_layout.tsx` / `ownerExperiences.ts`, not hub entries. Keep the gate to a single readable check.

## Screens & components

Mirror the established Bookings pattern (list screen → detail sheet).

### `OrdersScreen` (`src/components/screens/OrdersScreen.tsx`)

- `BranchSwitcher` at top — orders are per-branch (`listByBranch`), so a branch is always selected. Owners see all branches via the switcher; managers are branch-scoped by the backend.
- Status filter: **Active** (`Pending | Confirmed | OutForDelivery`) vs **Done** (`Delivered | Cancelled`), via `FilterTabs`.
- Order rows: short order id, `StatusPill`, total (`money`), delivery line, relative placed-time. Tap → open `OrderDetailSheet`.
- States: loading skeleton, error + Retry (`refetch`), empty ("No orders for this branch yet").

### `OrderDetailSheet` (`src/components/sheets.tsx`, new `SheetType.orderDetail`)

- Fetches `OrderWithItems` via `useOrder(id)`.
- Renders: item lines (`qty × unitPrice`, **product name resolved from `productsQuery`**, placeholder when missing), order total, delivery address (`deliveryLine` / `deliveryArea` / `deliveryCity`), `StatusPill`, placed date.
- **Actions:**
  - One **guided primary button** for the single valid next status, driven by `nextOrderStatus(status)`: `Pending → "Confirm order"`, `Confirmed → "Mark out for delivery"`, `OutForDelivery → "Mark delivered"`. Terminal states (`Delivered | Cancelled`) → no primary button.
  - **Cancel** button (danger style) shown only when `isOrderCancellable(status)` (`Pending | Confirmed`). Tapping shows an `Alert.alert` confirm ("Cancel this order? Stock will be restored."), then calls `updateStatus(id, "Cancelled")`.
- Sheet conventions: **close on success only**; **guard double-submit** with a local `submitting` flag + `await`ed handler.

## Data layer (hooks, not context)

New hooks in **`src/hooks/useOwnerData.ts`** (keeps `context.tsx` for orchestration):

- `useBranchOrders(branchId)` → query key `["branch-orders", branchId]`, `enabled: !!branchId`.
- `useOrder(orderId)` → query key `["order", orderId]`, `enabled: !!orderId`.
- `useUpdateOrderStatus()` → mutation calling `api.orders.updateStatus(id, status)`; `onSuccess` **invalidates** `["branch-orders", branchId]` and `["order", id]` (prefer `invalidateQueries` over `refetch`). `Cancelled` uses the same call — the backend handles the restore path.

## Pure helpers (the preferred, directly-tested layer)

In **`src/data.ts`** (alongside `nextBusinessStatus`, `money`):

- `nextOrderStatus(status: OrderStatus): OrderStatus | null` — single forward target; `null` for `Delivered | Cancelled`.
- `isOrderCancellable(status: OrderStatus): boolean` — `Pending | Confirmed`.
- `partitionOrders(orders: Order[]): { active: Order[]; done: Order[] }`.
- `orderStatusTone(status: OrderStatus)` — pill tone (reuse existing tone tokens).

In **`src/lib/adapters.ts`**:

- `adaptOrderItems(items: OrderItem[], products): OrderLineVM[]` — resolve `productId → name` from the commerce products list; placeholder name when not found.

## Error handling

- List query: skeleton while loading; on error, message + Retry (no destructive fallback). Empty branch → empty state.
- Mutation error: surface via `flash` toast; the sheet **stays open** (close-on-success) so the owner retries without re-tapping. Success closes the sheet and the list reflects the new status via invalidation.

## Testing (owner-app two-layer)

**Pure unit tests** (preferred layer):

- `nextOrderStatus` for every status including terminals.
- `isOrderCancellable` for all five statuses.
- `partitionOrders` splits active vs done correctly.
- `adaptOrderItems` resolves names and falls back to a placeholder when a product is missing.

**Component test** (RNTL via vitest-native):

- `OrderDetailSheet` renders the correct guided action label for a `Pending` vs `OutForDelivery` order.
- Shows Cancel only when cancellable; renders **no** actions for a `Delivered` order.
- Assert structural presence/absence (not disabled-handler), per the harness caveat.

## Out of scope (YAGNI)

- Customer **name** on orders — the API gives only `userId`; the delivery address covers fulfillment. Deferred to avoid an extra customer lookup.
- Owner-side order **notifications** — Plan 3 notifies the customer only; nothing to wire in the owner `NotificationsScreen`.
- Order **search / pagination** beyond the per-branch list.
- Reverting / re-opening a cancelled or delivered order (terminal by backend design).

## Documentation to update (same PR)

- `apps/owner-app/AGENTS.md` (and `CLAUDE.md` via include) — add an Orders section under the commerce/Products area.
- `docs/guides/ui-backend-sync.md` — note the owner orders list/detail → `orders.listByBranch` / `orders.get` / `orders.updateStatus` wiring.
- `docs/guides/api-endpoints.md` already documents the routes; cross-check no change needed.
