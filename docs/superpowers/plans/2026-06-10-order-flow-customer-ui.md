# Customer Order-Flow UI (mobile-app) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a customer browse a commerce seller's products, build a cart, pick/add a delivery address, place an order, and track/cancel it from the mobile-app — closing the UI criteria of #72 and the customer side of #73.

**Architecture:** Standard mobile layering — `@repo/api-client` (`api.orders.*` / `api.customerAddresses.*` / `api.products.*`, already merged) → pure adapters + cart logic (`src/lib/`) → React Query hooks (`src/hooks/`) → screens/sheets. The placeholder `CommerceBusinessScreen` becomes the ordering screen; "My Orders" lives in the Account area with an `OrderDetailSheet` mirroring `BookingDetailSheet`. Notification deep-links (`go:"orders"`) open the order.

**Tech Stack:** Expo / expo-router, React Native, NativeWind, `@tanstack/react-query`, Vitest (logic-only — no RN screen-render test setup exists).

**Two-tier execution (important):**
- **Tier 1 — pure logic (adapters, cart): full copy-ready code + TDD** (Vitest, like `src/__tests__/booking-slots.test.ts`).
- **Tier 2 — hooks & screens: structural spec** (exact files, state shape, which hooks/components, the flows) with code snippets only for non-obvious logic (the 409→"out of stock" mapping, cart wiring, cancel). The repo has **no `@testing-library/react-native`**, so screens are NOT unit-tested here. **The gate is a real run-the-app verification** (Task 6) — green logic tests do NOT prove the screens work.

**Spec:** `docs/superpowers/specs/2026-06-10-commerce-order-flow-ux-design.md` (§3 customer mobile-app).
**Base:** worktree `claude/order-flow-ui-customer` off `develop` @ `db71a37` (Plan 1 merged). Run `bun install` in the worktree before tests.

**Baselines pre-existing RED** (lint/tsc/test) — gate on touched files + zero-new vs baseline. After mutations use `invalidateQueries` (not `refetch`). Money via `src/lib/format.ts` `formatMoney` (BDT). New API wiring goes in `src/hooks/`, NOT `context.tsx` (per AGENTS).

---

## File Structure

**Create:**
- `apps/mobile-app/src/lib/cart.ts` — pure cart reducer + helpers (add/remove/setQty/total/toOrderItems)
- `apps/mobile-app/src/__tests__/cart.test.ts` — cart logic tests
- `apps/mobile-app/src/__tests__/order-adapters.test.ts` — adapter tests
- `apps/mobile-app/src/hooks/useOrders.ts` — order + product + address React Query hooks
- `apps/mobile-app/src/components/screens/MyOrdersScreen.tsx` — order list (Account sub-view)
- `apps/mobile-app/src/components/OrderDetailSheet.tsx` — order detail + cancel (mirrors `BookingDetailSheet`)

**Modify:**
- `apps/mobile-app/src/data.ts` — add `Order`, `OrderItem`, `CustomerAddress`, `CartLine` UI models
- `apps/mobile-app/src/lib/adapters.ts` — add `adaptOrder`, `adaptOrderItem`, `adaptCustomerAddress`
- `apps/mobile-app/src/components/screens/CommerceBusinessScreen.tsx` — replace placeholder with ordering UI
- `apps/mobile-app/src/components/screens/AccountScreen.tsx` — add "My Orders" menu entry → sub-view
- `apps/mobile-app/src/components/screens/NotificationsScreen.tsx` — handle `go:"orders"` deep-link
- `apps/mobile-app/src/context.tsx` — register `OrderDetailSheet` in the modal switch (sheets are rendered via `setModal`) — wiring only, not new API logic
- docs

---

## Task 1: UI models + adapters (Tier 1 — TDD)

**Files:** `data.ts`, `lib/adapters.ts`, `__tests__/order-adapters.test.ts` (create).

Adapters are pure functions mapping `@repo/api-client` types → `src/data.ts` UI models, exactly like the existing `adaptBranch`/`adaptService`.

- [ ] **Step 1: Add UI models to `data.ts`** (after the existing `Notification` type):

```ts
export type OrderStatusUI =
	| "Pending"
	| "Confirmed"
	| "OutForDelivery"
	| "Delivered"
	| "Cancelled";

export type OrderItem = {
	id: string;
	productId: string;
	name: string; // resolved from product where available, else "Item"
	quantity: number;
	unitPrice: number;
	lineTotal: number; // quantity * unitPrice
};

export type Order = {
	id: string;
	status: OrderStatusUI;
	total: number;
	deliveryLine: string;
	deliveryArea: string | null;
	deliveryCity: string | null;
	deliveredAt: string | null;
	createdAt: string;
	items: OrderItem[]; // empty for list rows (detail fetch populates)
};

export type CustomerAddress = {
	id: string;
	label: string | null;
	line: string;
	area: string | null;
	city: string | null;
	lat: number | null;
	lng: number | null;
	isDefault: boolean;
};

export type CartLine = {
	productId: string;
	name: string;
	unitPrice: number;
	quantity: number;
};
```

- [ ] **Step 2: Write the failing adapter test** `__tests__/order-adapters.test.ts` (mirror `__tests__/utils.test.ts` style — `import { describe, it, expect } from "vitest"`):

```ts
import { describe, expect, it } from "vitest";
import { adaptCustomerAddress, adaptOrder, adaptOrderItem } from "../lib/adapters";

describe("adaptOrderItem", () => {
	it("computes lineTotal and falls back to 'Item' when no product name", () => {
		const r = adaptOrderItem(
			{ id: "i1", orderId: "o1", productId: "p1", quantity: 3, unitPrice: 100 },
		);
		expect(r).toMatchObject({ id: "i1", productId: "p1", quantity: 3, unitPrice: 100, lineTotal: 300, name: "Item" });
	});
	it("uses a provided product-name resolver", () => {
		const r = adaptOrderItem(
			{ id: "i1", orderId: "o1", productId: "p1", quantity: 2, unitPrice: 50 },
			(id) => (id === "p1" ? "12kg Cylinder" : undefined),
		);
		expect(r.name).toBe("12kg Cylinder");
	});
});

describe("adaptOrder", () => {
	it("maps fields and adapts items", () => {
		const r = adaptOrder({
			id: "o1", businessId: "b", branchId: "br", userId: "u",
			status: "Confirmed", total: 300, deliveryLine: "12 Rd", deliveryArea: "Banani",
			deliveryCity: "Dhaka", deliveryLat: null, deliveryLng: null, deliveredAt: null,
			createdAt: "2026-01-01T00:00:00.000Z", updatedAt: null,
			items: [{ id: "i1", orderId: "o1", productId: "p1", quantity: 3, unitPrice: 100 }],
		});
		expect(r).toMatchObject({ id: "o1", status: "Confirmed", total: 300, deliveryLine: "12 Rd" });
		expect(r.items[0].lineTotal).toBe(300);
	});
	it("defaults items to [] when absent (list rows)", () => {
		const r = adaptOrder({
			id: "o1", businessId: "b", branchId: "br", userId: "u", status: "Pending",
			total: 0, deliveryLine: "x", deliveryArea: null, deliveryCity: null,
			deliveryLat: null, deliveryLng: null, deliveredAt: null,
			createdAt: "2026-01-01T00:00:00.000Z", updatedAt: null,
		});
		expect(r.items).toEqual([]);
	});
});

describe("adaptCustomerAddress", () => {
	it("maps all fields", () => {
		const r = adaptCustomerAddress({
			id: "a1", userId: "u", label: "Home", line: "12 Rd", area: "Banani",
			city: "Dhaka", lat: 1, lng: 2, isDefault: true,
			createdAt: "2026-01-01T00:00:00.000Z", updatedAt: null,
		});
		expect(r).toEqual({ id: "a1", label: "Home", line: "12 Rd", area: "Banani", city: "Dhaka", lat: 1, lng: 2, isDefault: true });
	});
});
```

- [ ] **Step 3: Run → fail.** `cd /Users/hasib/Documents/Talash/monorepo/.claude/worktrees/order-flow-ui-customer && bun install && bun run --filter @repo/mobile-app test src/__tests__/order-adapters.test.ts` → FAIL (adapters undefined). (If the mobile-app test script differs, check `apps/mobile-app/package.json` `scripts.test` and use it; tests run under Vitest like the other `__tests__/*.test.ts`.)

- [ ] **Step 4: Implement adapters in `lib/adapters.ts`** (add imports for the api-client types + data models, then):

```ts
import type {
	Order as ApiOrder,
	OrderItem as ApiOrderItem,
	OrderWithItems as ApiOrderWithItems,
	CustomerAddress as ApiCustomerAddress,
} from "@repo/api-client";
import type { Order, OrderItem, CustomerAddress } from "../data";

export function adaptOrderItem(
	it: ApiOrderItem,
	resolveName?: (productId: string) => string | undefined,
): OrderItem {
	return {
		id: it.id,
		productId: it.productId,
		name: resolveName?.(it.productId) ?? "Item",
		quantity: it.quantity,
		unitPrice: it.unitPrice,
		lineTotal: it.quantity * it.unitPrice,
	};
}

export function adaptOrder(
	o: ApiOrder | ApiOrderWithItems,
	resolveName?: (productId: string) => string | undefined,
): Order {
	const items = "items" in o && o.items ? o.items.map((i) => adaptOrderItem(i, resolveName)) : [];
	return {
		id: o.id,
		status: o.status,
		total: o.total,
		deliveryLine: o.deliveryLine,
		deliveryArea: o.deliveryArea,
		deliveryCity: o.deliveryCity,
		deliveredAt: o.deliveredAt,
		createdAt: o.createdAt,
		items,
	};
}

export function adaptCustomerAddress(a: ApiCustomerAddress): CustomerAddress {
	return {
		id: a.id,
		label: a.label,
		line: a.line,
		area: a.area,
		city: a.city,
		lat: a.lat,
		lng: a.lng,
		isDefault: a.isDefault,
	};
}
```

- [ ] **Step 5: Run → pass.** Same command as Step 3 → PASS.
- [ ] **Step 6: Lint touched files + commit**
```bash
cd /Users/hasib/Documents/Talash/monorepo/.claude/worktrees/order-flow-ui-customer
bunx biome check --write apps/mobile-app/src/data.ts apps/mobile-app/src/lib/adapters.ts apps/mobile-app/src/__tests__/order-adapters.test.ts
git add apps/mobile-app/src/data.ts apps/mobile-app/src/lib/adapters.ts apps/mobile-app/src/__tests__/order-adapters.test.ts
git commit -m "feat(mobile-app): order/address UI models + adapters"
```

---

## Task 2: Cart logic (Tier 1 — TDD)

**Files:** `lib/cart.ts` (create), `__tests__/cart.test.ts` (create).

A pure, framework-free cart module the screen drives via local state. No persistence (YAGNI).

- [ ] **Step 1: Write the failing test** `__tests__/cart.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { addToCart, cartTotal, removeFromCart, setQty, toOrderItems } from "../lib/cart";
import type { CartLine } from "../data";

const p = { productId: "p1", name: "Cyl", unitPrice: 100 };

describe("cart", () => {
	it("adds a new line with quantity 1, then increments on re-add", () => {
		let c: CartLine[] = [];
		c = addToCart(c, p);
		expect(c).toEqual([{ ...p, quantity: 1 }]);
		c = addToCart(c, p);
		expect(c[0].quantity).toBe(2);
	});
	it("setQty replaces quantity; qty<=0 removes the line", () => {
		let c = addToCart([], p);
		c = setQty(c, "p1", 5);
		expect(c[0].quantity).toBe(5);
		c = setQty(c, "p1", 0);
		expect(c).toEqual([]);
	});
	it("removeFromCart drops the line", () => {
		const c = removeFromCart(addToCart([], p), "p1");
		expect(c).toEqual([]);
	});
	it("cartTotal sums quantity*unitPrice", () => {
		let c = addToCart([], p); // 100
		c = addToCart(c, { productId: "p2", name: "Reg", unitPrice: 50 }); // +50
		c = setQty(c, "p1", 2); // 200
		expect(cartTotal(c)).toBe(250);
	});
	it("toOrderItems maps to {productId, quantity}", () => {
		const c = setQty(addToCart([], p), "p1", 3);
		expect(toOrderItems(c)).toEqual([{ productId: "p1", quantity: 3 }]);
	});
});
```

- [ ] **Step 2: Run → fail.** `bun run --filter @repo/mobile-app test src/__tests__/cart.test.ts` → FAIL.

- [ ] **Step 3: Implement `lib/cart.ts`:**

```ts
import type { CartLine } from "../data";

type NewLine = { productId: string; name: string; unitPrice: number };

export function addToCart(cart: CartLine[], line: NewLine): CartLine[] {
	const existing = cart.find((l) => l.productId === line.productId);
	if (existing) {
		return cart.map((l) =>
			l.productId === line.productId ? { ...l, quantity: l.quantity + 1 } : l,
		);
	}
	return [...cart, { ...line, quantity: 1 }];
}

export function setQty(cart: CartLine[], productId: string, quantity: number): CartLine[] {
	if (quantity <= 0) return removeFromCart(cart, productId);
	return cart.map((l) => (l.productId === productId ? { ...l, quantity } : l));
}

export function removeFromCart(cart: CartLine[], productId: string): CartLine[] {
	return cart.filter((l) => l.productId !== productId);
}

export function cartTotal(cart: CartLine[]): number {
	return cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
}

export function toOrderItems(cart: CartLine[]): { productId: string; quantity: number }[] {
	return cart.map((l) => ({ productId: l.productId, quantity: l.quantity }));
}
```

- [ ] **Step 4: Run → pass.** Same command → PASS.
- [ ] **Step 5: Lint + commit**
```bash
bunx biome check --write apps/mobile-app/src/lib/cart.ts apps/mobile-app/src/__tests__/cart.test.ts
git add apps/mobile-app/src/lib/cart.ts apps/mobile-app/src/__tests__/cart.test.ts
git commit -m "feat(mobile-app): pure cart logic + tests"
```

---

## Task 3: React Query hooks (Tier 2 — structural, copy-ready)

**Files:** `hooks/useOrders.ts` (create).

Thin wrappers over `api.*`, mirroring `hooks/useRewards.ts` exactly (no unit tests — the repo doesn't test thin react-query hooks; correctness is covered by adapters/cart tests + the run gate). Full code:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PlaceOrderBody } from "@repo/api-client";
import { useApp } from "../context";
import { adaptCustomerAddress, adaptOrder } from "../lib/adapters";
import { api } from "../lib/api";

export function useBranchProducts(branchId: string | undefined) {
	return useQuery({
		queryKey: ["products", "branch", branchId],
		queryFn: () => api.products.list(branchId as string),
		enabled: !!branchId,
		staleTime: 60_000,
	});
}

export function useAddresses() {
	const { isAuthed } = useApp();
	return useQuery({
		queryKey: ["addresses", "list"],
		queryFn: async () => (await api.customerAddresses.list()).map(adaptCustomerAddress),
		enabled: isAuthed,
		staleTime: 60_000,
	});
}

export function useSaveAddress() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: { label?: string; line: string; area?: string; city?: string; isDefault?: boolean }) =>
			api.customerAddresses.create(body),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["addresses", "list"] }),
	});
}

export function useMyOrders() {
	const { isAuthed } = useApp();
	return useQuery({
		queryKey: ["orders", "mine"],
		queryFn: async () => (await api.orders.listMine()).map((o) => adaptOrder(o)),
		enabled: isAuthed,
		staleTime: 30_000,
	});
}

export function useOrder(id: string, resolveName?: (productId: string) => string | undefined) {
	return useQuery({
		queryKey: ["order", id],
		queryFn: async () => adaptOrder(await api.orders.get(id), resolveName),
		staleTime: 0,
	});
}

export function useCreateOrder() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: PlaceOrderBody) => api.orders.create(body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["orders", "mine"] });
		},
	});
}

export function useCancelOrder() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.orders.cancel(id),
		onSuccess: (_data, id) => {
			qc.invalidateQueries({ queryKey: ["orders", "mine"] });
			qc.invalidateQueries({ queryKey: ["order", id] });
		},
	});
}
```

- [ ] **Step 1:** Create the file above. Verify the api-client method names against `packages/api-client/src/endpoints/orders.ts` + `customer-addresses.ts` + `products.ts` (`list`, `listMine`, `get`, `create`, `cancel`). `PlaceOrderBody` is exported from `@repo/api-client`.
- [ ] **Step 2:** `bunx tsc` is not run per-package easily for the app; instead confirm imports resolve by running the existing test suite + the typecheck the app uses (`apps/mobile-app/package.json` — if there's a `typecheck`/`lint` script, run it on touched files). At minimum `bunx biome check --write apps/mobile-app/src/hooks/useOrders.ts` → 0 errors.
- [ ] **Step 3: Commit**
```bash
git add apps/mobile-app/src/hooks/useOrders.ts
git commit -m "feat(mobile-app): order/address/product React Query hooks"
```

---

## Task 4: CommerceBusinessScreen — products + cart + checkout (Tier 2 — structural)

**File:** `components/screens/CommerceBusinessScreen.tsx` (replace placeholder).

**Current:** a placeholder ("Ordering coming soon") selected by `customerBusinessExperience` for the commerce vertical; it reads `useApp().selectedBusiness`.

**Build (structural spec):**
- Resolve the branch: `const branch = selectedBusiness?.branches[0]` (LPG sellers are single-branch for the MVP); guard with an `empty-state` if absent. Use `branch.id` for `useBranchProducts(branch?.id)`.
- **Product list:** render each product (from `useBranchProducts`) as a `card` with name, `formatMoney(price)`, stock, and a qty stepper (`+`/`−` `Button`s + quantity). Stepper drives local cart state: `const [cart, setCart] = useState<CartLine[]>([])` using `addToCart`/`setQty`/`removeFromCart` from `lib/cart`.
- **Cart summary bar** (sticky bottom): item count + `formatMoney(cartTotal(cart))` + a **Checkout** `Button` (disabled when cart empty).
- **Checkout flow** (a sheet or sub-view): list saved addresses (`useAddresses`) as selectable rows + an "Add address" inline form (`input` fields: label, line, area, city) that calls `useSaveAddress`. A **Place order** `Button` calls:

```ts
const createOrder = useCreateOrder();
// on place:
try {
	await createOrder.mutateAsync({
		branchId: branch.id,
		addressId: selectedAddressId,
		items: toOrderItems(cart),
	});
	setCart([]);
	// navigate to My Orders (Account → orders) or show success, then close checkout
} catch (e) {
	const isOutOfStock = e instanceof ApiError && e.status === 409;
	Alert.alert(isOutOfStock ? "Out of stock" : "Order failed",
		isOutOfStock ? "One or more items are out of stock. Adjust your cart and try again."
		             : "Could not place your order. Please try again.");
}
```
> **Error shape (confirmed):** the api-client throws `ApiError extends Error` with a numeric `.status` (set from `res.status` on any non-`ok` response — see `packages/api-client/src/client.ts`). Import it: `import { ApiError } from "@repo/api-client"` (verify it's in the package's exports; if not exported, fall back to `(e as { status?: number }).status === 409`). The **409 → "Out of stock"** mapping is the load-bearing UX detail.

- Use existing `ui` primitives (`Button`, `card`, `input`, `empty-state`, `text`, `divider`). No new design system. Keep it consistent with `BusinessScreen`/`BookingScreen` styling (NativeWind classes + `tokens`).

- [ ] **Step 1:** Implement the screen per the spec above (products list + stepper + cart bar).
- [ ] **Step 2:** Implement the checkout (address select/add + place order + 409 handling).
- [ ] **Step 3:** `bunx biome check --write` the file → 0 errors. (No unit test — verified in Task 6 run gate.)
- [ ] **Step 4: Commit** `feat(mobile-app): commerce ordering screen — products, cart, checkout`.

---

## Task 5: My Orders + OrderDetailSheet (Tier 2 — structural)

**Files:** `components/screens/MyOrdersScreen.tsx` (create), `components/OrderDetailSheet.tsx` (create), `screens/AccountScreen.tsx` (add entry), `context.tsx` (register sheet in modal switch).

- **MyOrdersScreen:** list `useMyOrders()` rows — each a `card` showing status (`StatusPill`), `formatMoney(total)`, delivery line, `formatDate(createdAt)`; tap opens `OrderDetailSheet` via `useApp().setModal(...)`. `empty-state` when none. Mount it as an Account sub-view: in `AccountScreen.tsx` add a menu entry `{ label: "My Orders", onPress: () => setView("orders") }` next to the existing items, and render `<MyOrdersScreen/>` for that `view` (mirror how existing sub-views like "Payment"/"Active sessions" are switched with `SubHeader`).
- **OrderDetailSheet:** mirror `BookingDetailSheet.tsx` structure exactly (absolute bottom sheet, `setModal(null)` backdrop, `useSafeAreaInsets`, `Button`/`StatusPill`). Use `useOrder(order.id)` for a fresh background refresh. Show: status, line items (name × qty = `formatMoney(lineTotal)`), delivery snapshot, `formatMoney(total)`. A **Cancel order** `Button` shown only when `status ∈ {Pending, Confirmed}`, calling `useCancelOrder().mutate(order.id)` then `setModal(null)`; confirm via `Alert.alert` first.
- **context.tsx:** `BookingDetailSheet` is rendered through the `setModal`/modal switch. Add an `OrderDetailSheet` case to that switch (wiring only — the modal union/`setModal` already exist). Find how `modal` is typed + where `BookingDetailSheet` is rendered and add the order variant alongside.

- [ ] **Step 1:** Create `OrderDetailSheet.tsx` (mirror BookingDetailSheet; cancel via `useCancelOrder`).
- [ ] **Step 2:** Create `MyOrdersScreen.tsx` (list + open sheet).
- [ ] **Step 3:** Wire the Account "My Orders" entry + sub-view, and register the sheet in `context.tsx`'s modal switch.
- [ ] **Step 4:** `bunx biome check --write` the 4 files → 0 errors.
- [ ] **Step 5: Commit** `feat(mobile-app): my-orders list + order detail sheet + cancel`.

---

## Task 6: Notification deep-link + run-the-app verification gate + docs

**Files:** `components/screens/NotificationsScreen.tsx`, docs.

- [ ] **Step 1: Deep-link.** In `NotificationsScreen.tsx`, find where a notification row's tap handles `go` (it already routes `go:"bookings"`/`"reviews"`). Add a `go === "orders"` branch that opens the order: fetch/route to the order detail (e.g. `setModal({ type: "order", order })` after loading via `useOrder`, or navigate to the My Orders view and open the sheet by `orderId`). Match the existing `go` handling mechanism in that file. `AppNotification` now carries `orderId` (from Plan 1).
- [ ] **Step 2: biome** the file → 0 errors. **Commit** `feat(mobile-app): deep-link order notifications to order detail`.

- [ ] **Step 3: RUN-THE-APP VERIFICATION (the real gate — green logic tests do NOT prove the UI works).** Use the `run` or `verify` skill / Expo to exercise the flow against a seeded local API:
  - Start the API worker + seed commerce data (`bun run cli db fresh`; note the **local D1 divergence** — the wrangler dev D1 differs from the CLI seed DB; copy the seeded sqlite into the worker's `.wrangler` D1 path, see `.remember`/memory).
  - Launch the mobile-app, sign in (Google-only), open a commerce seller → add products to cart → checkout → place order (assert success + the order appears in My Orders) → open detail → cancel (assert stock-restore reflected). Force an out-of-stock case → assert the **"Out of stock"** alert (409).
  - **If the sandbox cannot run Expo + a device/simulator:** STOP and report this explicitly — mark the screens as **NEEDS HUMAN VERIFICATION** in the PR, list the exact manual steps above, and do NOT claim the feature works on the basis of logic tests alone. (Honest completion per the repo's "verify against the codebase" rule.)

- [ ] **Step 4: Docs.** Update `docs/guides/ui-backend-sync.md` (new mobile hooks `useOrders.ts` + the cart/checkout/my-orders flow + `go:"orders"` deep-link) and `apps/mobile-app/AGENTS.md` or `CLAUDE.md` if present (commerce ordering screen, cart in `lib/cart.ts`, order hooks). **Commit** `docs: customer order-flow UI (hooks, cart, screens)`.

- [ ] **Step 5: Final gate.** `bun run --filter @repo/mobile-app test` (adapters + cart green; pre-existing tests unaffected); `bunx biome check` touched files clean; the app build/typecheck script the app uses passes for touched files.

---

## Self-Review notes

- **Spec coverage (§3):** product list+cart+checkout+place (Task 4); address book pick/add (Tasks 3–4); My Orders + detail + cancel (Task 5); notifications deep-link (Task 6); adapters/models/cart (Tasks 1–2). The customer status/history view = My Orders + detail (Task 5).
- **Tiering rationale:** only adapters (Task 1) + cart (Task 2) are pure/unit-testable (no RN render-test setup exists); hooks (Task 3) mirror `useRewards`; screens (Tasks 4–5) are structural and verified by the Task 6 run gate, NOT by unit tests. This is explicit, not a gap.
- **Type consistency:** `adaptOrder`/`adaptOrderItem`/`adaptCustomerAddress` signatures used in Task 3 hooks match Task 1 definitions; `CartLine` + `toOrderItems` from Task 2 feed `useCreateOrder`'s `PlaceOrderBody` in Task 4. `Order.status` UI union matches the api-client `OrderStatus`.
- **Load-bearing detail:** the 409→"Out of stock" mapping (Task 4) — the implementer must confirm the api-client error shape (`client.ts`) carries the HTTP status.
- **No new tracking-issue refs in commits.** Ticks #72 (customer order + cart) and the customer side of #73 (status view) at PR time.
