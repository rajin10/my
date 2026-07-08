# Owner-App Order Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a commerce owner/manager a screen to view a branch's orders, drill into an order, advance it through fulfillment, and cancel an unfulfillable one (restoring stock via the merged Plan 1–3 backend).

**Architecture:** New pushed route `/orders` (reached from the More hub, commerce-vertical only) renders `OrdersScreen` — a `BranchSwitcher` + Active/Done `FilterTabs` list, mirroring `CampaignsScreen`. Tapping a row opens a new `OrderDetailSheet` (registered in the existing `SheetLayer`) that shows line items (product names resolved from the commerce `products`), and renders a single guided next-status button plus a Cancel action driven by pure helpers. Data flows through three new React Query hooks in `useOwnerData.ts`; no API/backend changes.

**Tech Stack:** Expo 56 + expo-router + React Native + NativeWind, `@tanstack/react-query`, `@repo/api-client` (`api.orders.*`), Vitest + React Native Testing Library (`vitest-native`).

**Spec:** `docs/superpowers/specs/2026-06-10-owner-app-order-management-design.md`

**Base:** worktree `claude/busy-hopper-9a2bb8` off `develop` (Plans 1–3 merged). Run `bun install` in the worktree first (already done if you verified Plan 3).

**Commands (run from `apps/owner-app/`):** `bun run test`, `bunx tsc --noEmit -p tsconfig.json`, `bunx biome check --write <files>`. Repo lint/test baselines are pre-existing RED — gate on **touched files + zero new errors/failures vs baseline**.

---

## File Structure

**Modify:**
- `apps/owner-app/src/data.ts` — add pure order helpers (`nextOrderStatus`, `nextOrderActionLabel`, `isOrderCancellable`, `partitionOrders`)
- `apps/owner-app/src/components/ui/badge.tsx` — extend `StatusPill` for `OutForDelivery` / `Delivered` (+ display label)
- `apps/owner-app/src/lib/adapters.ts` — add `adaptOrderLine` (resolve product names)
- `apps/owner-app/src/hooks/useOwnerData.ts` — add `useBranchOrders`, `useOrder`, `useUpdateOrderStatus`
- `apps/owner-app/src/context.tsx` — add `"orders"` to `OverlayId`; add `{ type: "orderDetail"; orderId: string }` to `SheetType`
- `apps/owner-app/src/components/screens/MoreScreen.tsx` — add commerce-only "Orders" hub item
- `apps/owner-app/src/components/sheets.tsx` — add `OrderDetailSheet`
- `apps/owner-app/src/app/(tabs)/_layout.tsx` — register `orderDetail` in `SheetLayer`

**Create:**
- `apps/owner-app/src/app/orders.tsx` — thin route wrapper → `OrdersScreen`
- `apps/owner-app/src/components/screens/OrdersScreen.tsx` — the list screen
- `apps/owner-app/src/__tests__/order-helpers.test.ts` — pure helper + adapter unit tests
- `apps/owner-app/src/__tests__/OrderDetailSheet.test.tsx` — component test
- `apps/owner-app/src/__tests__/OrdersScreen.test.tsx` — component render test

---

## Task 1: Pure order helpers + StatusPill extension (TDD)

**Files:**
- Modify: `apps/owner-app/src/data.ts`
- Modify: `apps/owner-app/src/components/ui/badge.tsx`
- Test: `apps/owner-app/src/__tests__/order-helpers.test.ts` (create)

- [ ] **Step 1: Write the failing helper tests.** Create `apps/owner-app/src/__tests__/order-helpers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
	isOrderCancellable,
	nextOrderActionLabel,
	nextOrderStatus,
	partitionOrders,
} from "../data";
import type { Order } from "@repo/api-client";

const order = (status: Order["status"]): Order =>
	({ id: status, status } as Order);

describe("nextOrderStatus", () => {
	it("walks the forward machine and stops at terminals", () => {
		expect(nextOrderStatus("Pending")).toBe("Confirmed");
		expect(nextOrderStatus("Confirmed")).toBe("OutForDelivery");
		expect(nextOrderStatus("OutForDelivery")).toBe("Delivered");
		expect(nextOrderStatus("Delivered")).toBeNull();
		expect(nextOrderStatus("Cancelled")).toBeNull();
	});
});

describe("nextOrderActionLabel", () => {
	it("labels each forward action", () => {
		expect(nextOrderActionLabel("Confirmed")).toBe("Confirm order");
		expect(nextOrderActionLabel("OutForDelivery")).toBe("Mark out for delivery");
		expect(nextOrderActionLabel("Delivered")).toBe("Mark delivered");
	});
});

describe("isOrderCancellable", () => {
	it("allows cancel only from Pending or Confirmed", () => {
		expect(isOrderCancellable("Pending")).toBe(true);
		expect(isOrderCancellable("Confirmed")).toBe(true);
		expect(isOrderCancellable("OutForDelivery")).toBe(false);
		expect(isOrderCancellable("Delivered")).toBe(false);
		expect(isOrderCancellable("Cancelled")).toBe(false);
	});
});

describe("partitionOrders", () => {
	it("splits active vs done", () => {
		const { active, done } = partitionOrders([
			order("Pending"),
			order("OutForDelivery"),
			order("Delivered"),
			order("Cancelled"),
		]);
		expect(active.map((o) => o.status)).toEqual(["Pending", "OutForDelivery"]);
		expect(done.map((o) => o.status)).toEqual(["Delivered", "Cancelled"]);
	});
});
```

- [ ] **Step 2: Run → fail.**

Run: `cd apps/owner-app && bun run test src/__tests__/order-helpers.test.ts`
Expected: FAIL — `nextOrderStatus`/etc. are not exported from `../data`.

- [ ] **Step 3: Implement the helpers in `data.ts`.** Add the import near the top (after the existing `import type { BusinessVertical } from "@repo/api-client";`):

```ts
import type { Order, OrderStatus } from "@repo/api-client";
```

Append at the end of `data.ts`:

```ts
// ── Order fulfillment helpers ────────────────────────────────────────────────

const ORDER_FLOW: Record<OrderStatus, OrderStatus | null> = {
	Pending: "Confirmed",
	Confirmed: "OutForDelivery",
	OutForDelivery: "Delivered",
	Delivered: null,
	Cancelled: null,
};

/** The single valid forward status, or null for terminal states. */
export function nextOrderStatus(status: OrderStatus): OrderStatus | null {
	return ORDER_FLOW[status];
}

const ORDER_ACTION_LABEL: Record<OrderStatus, string> = {
	Pending: "",
	Confirmed: "Confirm order",
	OutForDelivery: "Mark out for delivery",
	Delivered: "Mark delivered",
	Cancelled: "",
};

/** Button label for advancing TO `next` (pass the result of nextOrderStatus). */
export function nextOrderActionLabel(next: OrderStatus): string {
	return ORDER_ACTION_LABEL[next];
}

/** Owner-cancel is allowed only before fulfillment starts. */
export function isOrderCancellable(status: OrderStatus): boolean {
	return status === "Pending" || status === "Confirmed";
}

const ORDER_DONE: OrderStatus[] = ["Delivered", "Cancelled"];

export function partitionOrders(orders: Order[]): {
	active: Order[];
	done: Order[];
} {
	const active: Order[] = [];
	const done: Order[] = [];
	for (const o of orders) {
		(ORDER_DONE.includes(o.status) ? done : active).push(o);
	}
	return { active, done };
}
```

- [ ] **Step 4: Run → pass.**

Run: `cd apps/owner-app && bun run test src/__tests__/order-helpers.test.ts`
Expected: PASS (4 describe blocks).

- [ ] **Step 5: Extend `StatusPill` for the two new statuses.** In `apps/owner-app/src/components/ui/badge.tsx`, add `"OutForDelivery"` and `"Delivered"` to the `BookingStatus` union:

```ts
export type BookingStatus =
	| "Pending"
	| "Confirmed"
	| "Cancelled"
	| "Completed"
	| "Active"
	| "Draft"
	| "Published"
	| "Expired"
	| "Suspended"
	| "Sent"
	| "OutForDelivery"
	| "Delivered";
```

Add their variants to `STATUS_VARIANT`:

```ts
const STATUS_VARIANT: Record<BookingStatus, BadgeVariant> = {
	Pending: "pending",
	Confirmed: "success",
	Cancelled: "danger",
	Completed: "success",
	Active: "success",
	Draft: "neutral",
	Published: "success",
	Expired: "neutral",
	Suspended: "danger",
	Sent: "success",
	OutForDelivery: "info",
	Delivered: "success",
};
```

Add a display-label map and use it in the component (so `OutForDelivery` renders as "Out for delivery"). Replace the `StatusPill` function body:

```ts
const STATUS_LABEL: Partial<Record<BookingStatus, string>> = {
	OutForDelivery: "Out for delivery",
};

export function StatusPill({
	status,
	size = "md",
}: {
	status: BookingStatus;
	size?: BadgeSize;
}) {
	return (
		<Badge variant={STATUS_VARIANT[status]} size={size} showIcon>
			{STATUS_LABEL[status] ?? status}
		</Badge>
	);
}
```

- [ ] **Step 6: Typecheck + lint + commit.**

```bash
cd apps/owner-app
bunx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "data.ts|badge.tsx" || echo "no new errors"
bunx biome check --write src/data.ts src/components/ui/badge.tsx src/__tests__/order-helpers.test.ts
git add src/data.ts src/components/ui/badge.tsx src/__tests__/order-helpers.test.ts
git commit -m "feat(owner-app): order fulfillment helpers + StatusPill order statuses"
```

---

## Task 2: Line-item adapter (TDD) + order data hooks

**Files:**
- Modify: `apps/owner-app/src/lib/adapters.ts`
- Modify: `apps/owner-app/src/hooks/useOwnerData.ts`
- Test: `apps/owner-app/src/__tests__/order-helpers.test.ts` (extend)

- [ ] **Step 1: Add the failing adapter test.** Append to `apps/owner-app/src/__tests__/order-helpers.test.ts`:

```ts
import { adaptOrderLine } from "../lib/adapters";
import type { OrderItem } from "@repo/api-client";
import type { Product } from "../data";

const item = (over: Partial<OrderItem>): OrderItem =>
	({
		id: "i1",
		orderId: "o1",
		productId: "p1",
		quantity: 2,
		unitPrice: 150,
		createdAt: "",
		updatedAt: null,
		...over,
	}) as OrderItem;

const products: Product[] = [
	{ id: "p1", name: "Hair Oil", branch: "Gulshan", category: null, price: 150, stock: 9, status: "Active" } as Product,
];

describe("adaptOrderLine", () => {
	it("resolves the product name and computes the line total", () => {
		const line = adaptOrderLine(item({}), products);
		expect(line.name).toBe("Hair Oil");
		expect(line.quantity).toBe(2);
		expect(line.lineTotal).toBe(300);
	});

	it("falls back to a placeholder when the product is missing", () => {
		const line = adaptOrderLine(item({ productId: "gone" }), products);
		expect(line.name).toBe("Unknown product");
	});
});
```

- [ ] **Step 2: Run → fail.**

Run: `cd apps/owner-app && bun run test src/__tests__/order-helpers.test.ts`
Expected: FAIL — `adaptOrderLine` is not exported from `../lib/adapters`.

- [ ] **Step 3: Implement `adaptOrderLine`.** In `apps/owner-app/src/lib/adapters.ts`, add the import for `OrderItem` to the existing `@repo/api-client` type import, and append:

```ts
import type { OrderItem } from "@repo/api-client";
import type { Product } from "../data";

export type OrderLineVM = {
	id: string;
	name: string;
	quantity: number;
	unitPrice: number;
	lineTotal: number;
};

/** Resolve an order item's product name from the owner's commerce catalog. */
export function adaptOrderLine(item: OrderItem, products: Product[]): OrderLineVM {
	const product = products.find((p) => p.id === item.productId);
	return {
		id: item.id,
		name: product?.name ?? "Unknown product",
		quantity: item.quantity,
		unitPrice: item.unitPrice,
		lineTotal: item.unitPrice * item.quantity,
	};
}
```

> If `adapters.ts` already imports types from `@repo/api-client`, merge `OrderItem` into that import line instead of adding a second one. Same for `Product` from `../data`.

- [ ] **Step 4: Run → pass.**

Run: `cd apps/owner-app && bun run test src/__tests__/order-helpers.test.ts`
Expected: PASS (all blocks incl. the two new adapter tests).

- [ ] **Step 5: Add the data hooks.** In `apps/owner-app/src/hooks/useOwnerData.ts`, confirm the file already imports `useQuery`, `useMutation`, `useQueryClient` from `@tanstack/react-query` and `api` from `../lib/api` (it does — other hooks use them). Add `OrderStatus` to the `@repo/api-client` type imports, then append:

```ts
// ── Orders (commerce) ────────────────────────────────────────────────────────

/** Orders across one or more branches (the API is per-branch; we merge). */
export function useBranchOrders(branchIds: string[]) {
	return useQuery({
		queryKey: ["branch-orders", [...branchIds].sort().join(",")],
		enabled: branchIds.length > 0,
		queryFn: async () => {
			const results = await Promise.all(
				branchIds.map((id) => api.orders.listByBranch(id)),
			);
			return results.flat();
		},
	});
}

export function useOrder(orderId: string | null) {
	return useQuery({
		queryKey: ["order", orderId],
		enabled: !!orderId,
		queryFn: () => api.orders.get(orderId as string),
	});
}

export function useUpdateOrderStatus() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
			api.orders.updateStatus(id, status),
		onSuccess: (_data, { id }) => {
			qc.invalidateQueries({ queryKey: ["branch-orders"] });
			qc.invalidateQueries({ queryKey: ["order", id] });
		},
	});
}
```

- [ ] **Step 6: Typecheck + lint + commit.**

```bash
cd apps/owner-app
bunx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "adapters.ts|useOwnerData.ts" || echo "no new errors"
bunx biome check --write src/lib/adapters.ts src/hooks/useOwnerData.ts src/__tests__/order-helpers.test.ts
git add src/lib/adapters.ts src/hooks/useOwnerData.ts src/__tests__/order-helpers.test.ts
git commit -m "feat(owner-app): order line adapter + branch-orders/order/update-status hooks"
```

---

## Task 3: OrdersScreen + route + More entry + OverlayId

**Files:**
- Modify: `apps/owner-app/src/context.tsx` (add `"orders"` to `OverlayId` **and** `orderDetail` to `SheetType`)
- Create: `apps/owner-app/src/app/orders.tsx`
- Create: `apps/owner-app/src/components/screens/OrdersScreen.tsx`
- Modify: `apps/owner-app/src/components/screens/MoreScreen.tsx`
- Test: `apps/owner-app/src/__tests__/OrdersScreen.test.tsx` (create)

- [ ] **Step 1: Add `"orders"` to `OverlayId` and `orderDetail` to `SheetType`.** In `apps/owner-app/src/context.tsx`, extend `OverlayId`:

```ts
export type OverlayId =
	| "notifications"
	| "business"
	| "team"
	| "coupons"
	| "account"
	| "help"
	| "analytics"
	| "calendar"
	| "customers"
	| "campaigns"
	| "orders";
```

And add a union member to `SheetType` (after `staffAvailability`) so the screen's `setSheet({ type: "orderDetail", ... })` typechecks now and the dispatcher in Task 4 has the type to match:

```ts
	| { type: "staffAvailability"; teamMemberId: string; memberName: string }
	| { type: "orderDetail"; orderId: string };
```

(No other change needed — `setOverlay("orders")` already does `router.push("/orders")`.)

- [ ] **Step 2: Create the route wrapper** `apps/owner-app/src/app/orders.tsx`:

```tsx
import OrdersScreen from "@/components/screens/OrdersScreen";

export default function OrdersRoute() {
	return <OrdersScreen />;
}
```

- [ ] **Step 3: Write the failing screen render test.** Create `apps/owner-app/src/__tests__/OrdersScreen.test.tsx`:

```tsx
import { screen } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "./test-utils";

const useApp = vi.fn();
vi.mock("../context", () => ({ useApp: () => useApp() }));

const useBranchOrders = vi.fn();
vi.mock("../hooks/useOwnerData", () => ({
	useBranchOrders: (ids: string[]) => useBranchOrders(ids),
}));

import OrdersScreen from "../components/screens/OrdersScreen";

beforeEach(() => {
	useApp.mockReturnValue({
		branch: "All branches",
		setBranch: vi.fn(),
		setOverlay: vi.fn(),
		setSheet: vi.fn(),
		business: { branches: ["Gulshan"] },
		apiBranches: [{ id: "b1", name: "Gulshan" }],
		products: [],
	});
});

describe("OrdersScreen", () => {
	it("shows the empty state when a branch has no orders", () => {
		useBranchOrders.mockReturnValue({ data: [], isLoading: false, isError: false });
		renderWithClient(<OrdersScreen />);
		expect(screen.getByText("No orders for this branch yet.")).toBeTruthy();
	});

	it("renders an order row with its status", () => {
		useBranchOrders.mockReturnValue({
			data: [
				{ id: "o1", status: "Pending", total: 300, deliveryLine: "12 Road 5", createdAt: "2026-06-10T10:00:00Z" },
			],
			isLoading: false,
			isError: false,
		});
		renderWithClient(<OrdersScreen />);
		expect(screen.getByText("Pending")).toBeTruthy();
	});
});
```

- [ ] **Step 4: Run → fail.**

Run: `cd apps/owner-app && bun run test src/__tests__/OrdersScreen.test.tsx`
Expected: FAIL — `OrdersScreen` module does not exist.

- [ ] **Step 5: Implement `OrdersScreen`.** Create `apps/owner-app/src/components/screens/OrdersScreen.tsx`:

```tsx
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import { useApp } from "../../context";
import { money, partitionOrders } from "../../data";
import { useBranchOrders } from "../../hooks/useOwnerData";
import { Colors, Shadow } from "../../tokens";
import { BackHeader, BranchSwitcher, Card, FilterTabs, StatusPill } from "../ui";

export default function OrdersScreen() {
	const insets = useSafeAreaInsets();
	const { branch, setBranch, business, apiBranches, setOverlay, setSheet } =
		useApp();
	const [tab, setTab] = useState("active");

	const branchIds =
		branch === "All branches"
			? apiBranches.map((b) => b.id)
			: apiBranches.filter((b) => b.name === branch).map((b) => b.id);

	const ordersQ = useBranchOrders(branchIds);
	const { active, done } = partitionOrders(ordersQ.data ?? []);
	const shown = tab === "active" ? active : done;

	return (
		<View className="flex-1 bg-paper">
			<BackHeader
				title="Orders"
				onBack={() => setOverlay(null)}
				topInset={insets.top}
			/>
			<View className="pt-2">
				<BranchSwitcher
					branches={business.branches}
					active={branch}
					onPick={setBranch}
				/>
			</View>
			<View style={{ paddingTop: 12, paddingHorizontal: 16 }}>
				<FilterTabs
					tabs={[
						{ id: "active", label: "Active", count: active.length },
						{ id: "done", label: "Done", count: done.length },
					]}
					active={tab}
					onPick={setTab}
				/>
			</View>

			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					paddingHorizontal: 16,
					paddingTop: 16,
					paddingBottom: 32,
					gap: 11,
				}}
			>
				{ordersQ.isError ? (
					<View
						className="bg-surface border border-line rounded-lg"
						style={{ padding: 18, ...Shadow.sm }}
					>
						<Text className="text-ink-500 text-center" style={{ fontSize: 13.5 }}>
							Couldn't load orders.
						</Text>
						<TouchableOpacity
							onPress={() => ordersQ.refetch()}
							className="self-center"
							style={{ marginTop: 10 }}
						>
							<Text className="text-primary-600 font-semibold" style={{ fontSize: 14 }}>
								Retry
							</Text>
						</TouchableOpacity>
					</View>
				) : shown.length === 0 ? (
					<View
						className="bg-surface border border-line rounded-lg"
						style={{ padding: 18, ...Shadow.sm }}
					>
						<Text className="text-ink-500 text-center" style={{ fontSize: 13.5 }}>
							No orders for this branch yet.
						</Text>
					</View>
				) : (
					shown.map((o) => (
						<Card key={o.id} onPress={() => setSheet({ type: "orderDetail", orderId: o.id })}>
							<View className="flex-row items-start justify-between" style={{ gap: 12 }}>
								<View className="flex-1 min-w-0">
									<Text className="text-ink-900 font-bold" style={{ fontSize: 15 }}>
										#{o.id.slice(0, 8)}
									</Text>
									<Text className="text-ink-500" style={{ fontSize: 13, marginTop: 3 }}>
										{o.deliveryLine}
									</Text>
									<Text className="text-ink-400" style={{ fontSize: 12, marginTop: 3 }}>
										{new Date(o.createdAt).toLocaleDateString()}
									</Text>
								</View>
								<View className="items-end" style={{ gap: 6 }}>
									<StatusPill status={o.status} size="sm" />
									<Text className="text-ink-900 font-bold" style={{ fontSize: 14.5 }}>
										{money(o.total)}
									</Text>
								</View>
							</View>
						</Card>
					))
				)}
			</ScrollView>
		</View>
	);
}
```

> `Card` accepts `onPress` (see `ProductCard`). If TypeScript flags the `Card`/`BackHeader`/`FilterTabs` props, match them against the real signatures in `src/components/ui/` — they are: `BranchSwitcher({branches,active,onPick})`, `FilterTabs({tabs,active,onPick})` where a tab is `{id,label,count?}`, `BackHeader({title,onBack,topInset})`, `StatusPill({status,size})`.

- [ ] **Step 6: Run → pass.**

Run: `cd apps/owner-app && bun run test src/__tests__/OrdersScreen.test.tsx`
Expected: PASS (empty state + row render).

> If the render test fails because `Card`'s native deps aren't stubbed, follow the existing screen-test pattern (`TodayScreen.status.test.tsx`) — render with empty data first, and only add the row-render assertion once the empty case is green. Stub any new native lib the screen pulls in (per the AGENTS testing caveats).

- [ ] **Step 7: Add the commerce-only "Orders" hub item.** In `apps/owner-app/src/components/screens/MoreScreen.tsx`, add an Orders entry to the "Insights & schedule" group (or a new group), gated on the commerce vertical. The `groups` array is built inside the component where `business` is in scope. Insert this item object at the top of the first group's `items` array, conditionally:

```ts
...(business.vertical === "commerce"
	? [
			{
				id: "orders",
				icon: "ShoppingBag",
				label: "Orders",
				sub: "Incoming & fulfillment",
			},
		]
	: []),
```

So the first group becomes:

```ts
{
	header: "Insights & schedule",
	items: [
		...(business.vertical === "commerce"
			? [
					{
						id: "orders",
						icon: "ShoppingBag",
						label: "Orders",
						sub: "Incoming & fulfillment",
					},
				]
			: []),
		{ id: "analytics", icon: "TrendingUp", label: "Analytics", sub: "Revenue, bookings & trends" },
		{ id: "calendar", icon: "CalendarDays", label: "Calendar", sub: "Day and week schedule" },
		{ id: "customers", icon: "Users2", label: "Customers", sub: "Your client list & profiles" },
		{ id: "campaigns", icon: "Megaphone", label: "Campaigns", sub: "Email and push outreach" },
	],
},
```

> The existing rows already route via `onPress={() => setOverlay(it.id as OverlayId)}`. Because `"orders"` is now an `OverlayId`, the new row routes to `/orders` with no further wiring. Verify `"ShoppingBag"` is a valid `IconName` (lucide); if `tsc` rejects it, pick another commerce icon that exists in the `IconName` union (e.g. `"Package"` or `"Receipt"`).

- [ ] **Step 8: Typecheck + lint + commit.**

```bash
cd apps/owner-app
bunx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "OrdersScreen|orders.tsx|MoreScreen|context.tsx" || echo "no new errors"
bunx biome check --write src/context.tsx src/app/orders.tsx src/components/screens/OrdersScreen.tsx src/components/screens/MoreScreen.tsx src/__tests__/OrdersScreen.test.tsx
git add src/context.tsx src/app/orders.tsx src/components/screens/OrdersScreen.tsx src/components/screens/MoreScreen.tsx src/__tests__/OrdersScreen.test.tsx
git commit -m "feat(owner-app): Orders list screen + commerce-only More entry"
```

---

## Task 4: OrderDetailSheet + SheetType + dispatcher (TDD)

**Files:**
- Modify: `apps/owner-app/src/components/sheets.tsx` (add `OrderDetailSheet`)
- Modify: `apps/owner-app/src/app/(tabs)/_layout.tsx` (register in `SheetLayer`)
- Test: `apps/owner-app/src/__tests__/OrderDetailSheet.test.tsx` (create)

> `SheetType.orderDetail` was already added in Task 3 Step 1 — confirm it's present in `context.tsx` before starting (`grep orderDetail src/context.tsx`).

- [ ] **Step 1: Write the failing component test.** Create `apps/owner-app/src/__tests__/OrderDetailSheet.test.tsx`:

```tsx
import { screen } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "./test-utils";

const useApp = vi.fn();
vi.mock("../context", () => ({ useApp: () => useApp() }));

const useOrder = vi.fn();
const mutate = vi.fn();
vi.mock("../hooks/useOwnerData", () => ({
	useOrder: (id: string) => useOrder(id),
	useUpdateOrderStatus: () => ({ mutate, isPending: false }),
}));

import { OrderDetailSheet } from "../components/sheets";

function mockOrder(status: string) {
	useOrder.mockReturnValue({
		data: {
			id: "o1",
			status,
			total: 300,
			deliveryLine: "12 Road 5",
			deliveryArea: "Gulshan",
			deliveryCity: "Dhaka",
			createdAt: "2026-06-10T10:00:00Z",
			items: [{ id: "i1", productId: "p1", quantity: 2, unitPrice: 150 }],
		},
		isLoading: false,
		isError: false,
	});
}

beforeEach(() => {
	mutate.mockReset();
	useApp.mockReturnValue({
		setSheet: vi.fn(),
		flash: vi.fn(),
		products: [{ id: "p1", name: "Hair Oil" }],
	});
});

describe("OrderDetailSheet", () => {
	it("shows the guided 'Confirm order' action for a Pending order, plus Cancel", () => {
		mockOrder("Pending");
		renderWithClient(<OrderDetailSheet orderId="o1" />);
		expect(screen.getByText("Confirm order")).toBeTruthy();
		expect(screen.getByText("Cancel order")).toBeTruthy();
	});

	it("shows 'Mark delivered' and no Cancel for an OutForDelivery order", () => {
		mockOrder("OutForDelivery");
		renderWithClient(<OrderDetailSheet orderId="o1" />);
		expect(screen.getByText("Mark delivered")).toBeTruthy();
		expect(screen.queryByText("Cancel order")).toBeNull();
	});

	it("renders no actions for a Delivered (terminal) order", () => {
		mockOrder("Delivered");
		renderWithClient(<OrderDetailSheet orderId="o1" />);
		expect(screen.queryByText("Mark delivered")).toBeNull();
		expect(screen.queryByText("Cancel order")).toBeNull();
	});
});
```

- [ ] **Step 2: Run → fail.**

Run: `cd apps/owner-app && bun run test src/__tests__/OrderDetailSheet.test.tsx`
Expected: FAIL — `OrderDetailSheet` is not exported from `../components/sheets`.

- [ ] **Step 3: Implement `OrderDetailSheet`.** In `apps/owner-app/src/components/sheets.tsx`, ensure these are imported (most already are — add only what's missing): `Alert`, `Text`, `View` from `react-native`; `useApp` from `../context`; `Sheet`, `Button`, `StatusPill`, `Icon` from `./ui` (or the file's existing UI import path); `money`, `nextOrderStatus`, `nextOrderActionLabel`, `isOrderCancellable` from `../data`; `adaptOrderLine` from `../lib/adapters`; `useOrder`, `useUpdateOrderStatus` from `../hooks/useOwnerData`; and `type OrderStatus` from `@repo/api-client`. Add the component (place it after `BookingDetailSheet`):

```tsx
export function OrderDetailSheet({ orderId }: { orderId: string }) {
	const { setSheet, products, flash } = useApp();
	const orderQ = useOrder(orderId);
	const updateMut = useUpdateOrderStatus();
	const order = orderQ.data;

	function advance(status: OrderStatus, doneMsg: string) {
		if (!order) return;
		updateMut.mutate(
			{ id: order.id, status },
			{
				onSuccess: () => {
					setSheet(null);
					flash(doneMsg, { tone: "success" });
				},
				onError: (e: unknown) =>
					flash((e as Error).message ?? "Update failed", { tone: "danger" }),
			},
		);
	}

	function confirmCancel() {
		Alert.alert(
			"Cancel order",
			"Cancel this order? Stock will be restored and the customer notified.",
			[
				{ text: "Keep order", style: "cancel" },
				{
					text: "Cancel order",
					style: "destructive",
					onPress: () => advance("Cancelled", "Order cancelled — stock restored."),
				},
			],
		);
	}

	const next = order ? nextOrderStatus(order.status) : null;
	const cancellable = order ? isOrderCancellable(order.status) : false;

	const footer =
		order && (next || cancellable) ? (
			<View style={{ gap: 10 }}>
				{next ? (
					<Button
						variant="primary"
						icon="ArrowRight"
						full
						disabled={updateMut.isPending}
						onPress={() => advance(next, `${nextOrderActionLabel(next)} — done.`)}
					>
						{nextOrderActionLabel(next)}
					</Button>
				) : null}
				{cancellable ? (
					<Button
						variant="ghost"
						icon="XCircle"
						full
						disabled={updateMut.isPending}
						onPress={confirmCancel}
					>
						Cancel order
					</Button>
				) : null}
			</View>
		) : undefined;

	const lines = order?.items?.map((it) => adaptOrderLine(it, products)) ?? [];

	return (
		<Sheet visible title="Order" onClose={() => setSheet(null)} footer={footer}>
			{!order ? (
				<Text className="text-ink-500" style={{ fontSize: 14, paddingVertical: 20 }}>
					{orderQ.isError ? "Couldn't load this order." : "Loading…"}
				</Text>
			) : (
				<View style={{ gap: 14 }}>
					<View className="flex-row items-center justify-between">
						<StatusPill status={order.status} />
						<Text className="text-ink-900 font-bold" style={{ fontSize: 18 }}>
							{money(order.total)}
						</Text>
					</View>

					<View style={{ gap: 8 }}>
						{lines.map((l) => (
							<View key={l.id} className="flex-row items-center justify-between">
								<Text className="flex-1 text-ink-900" style={{ fontSize: 14 }}>
									{l.quantity} × {l.name}
								</Text>
								<Text className="text-ink-700 font-semibold" style={{ fontSize: 14 }}>
									{money(l.lineTotal)}
								</Text>
							</View>
						))}
					</View>

					<View className="border-t border-line-soft" style={{ paddingTop: 12 }}>
						<Text className="text-ink-500" style={{ fontSize: 13 }}>
							Deliver to
						</Text>
						<Text className="text-ink-900 font-semibold" style={{ fontSize: 14, marginTop: 2 }}>
							{[order.deliveryLine, order.deliveryArea, order.deliveryCity]
								.filter(Boolean)
								.join(", ")}
						</Text>
					</View>
				</View>
			)}
		</Sheet>
	);
}
```

> Verify `"ArrowRight"` and `"XCircle"` exist in the `IconName` union (XCircle is already used by `BookingDetailSheet`). If `ArrowRight` is rejected by `tsc`, use `"Check"`.

- [ ] **Step 4: Register the sheet in `SheetLayer`.** In `apps/owner-app/src/app/(tabs)/_layout.tsx`, add `OrderDetailSheet` to the import from `../../components/sheets` (the same import that brings in `BookingDetailSheet`), then add a case to the `switch (sheet.type)` in `SheetLayer` (before `default`):

```tsx
		case "orderDetail":
			return <OrderDetailSheet orderId={sheet.orderId} />;
```

- [ ] **Step 5: Run → pass.**

Run: `cd apps/owner-app && bun run test src/__tests__/OrderDetailSheet.test.tsx`
Expected: PASS (3 cases: Pending → Confirm+Cancel, OutForDelivery → Mark delivered no Cancel, Delivered → no actions).

> Per the AGENTS harness caveat, these assert presence/absence of action text (not handler calls on disabled buttons). If `sheets.tsx` pulls a native lib into the test graph that isn't stubbed, add the stub in the test file (mirror `sheets-forms.test.tsx`, which stubs `../lib/api`, `expo-image-picker`, etc.).

- [ ] **Step 6: Verify no new tsc errors across the sheet wiring.**

Run: `cd apps/owner-app && bunx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "sheets.tsx|_layout.tsx|context.tsx"`
Expected: no output.

- [ ] **Step 7: Lint + commit.**

```bash
cd apps/owner-app
bunx biome check --write src/context.tsx src/components/sheets.tsx "src/app/(tabs)/_layout.tsx" src/__tests__/OrderDetailSheet.test.tsx
git add src/context.tsx src/components/sheets.tsx "src/app/(tabs)/_layout.tsx" src/__tests__/OrderDetailSheet.test.tsx
git commit -m "feat(owner-app): order detail sheet with guided status actions + cancel"
```

---

## Task 5: Docs + final gate

**Files:**
- Modify: `apps/owner-app/AGENTS.md`
- Modify: `docs/guides/ui-backend-sync.md`

- [ ] **Step 1: Document the feature in `apps/owner-app/AGENTS.md`.** Under the Products (commerce) area, add a paragraph:

> **Orders (commerce):** A commerce owner manages orders from **More → Orders** (`/orders` route; the entry is hidden for booking businesses). `OrdersScreen` mirrors `CampaignsScreen` — `BranchSwitcher` + Active/Done `FilterTabs`, rows tap into `OrderDetailSheet` (`SheetType.orderDetail`). The sheet resolves item product names from the commerce `products` (`adaptOrderLine` in `adapters.ts`), shows a single **guided next-status** button (`nextOrderStatus`/`nextOrderActionLabel` in `data.ts`: Confirm → Mark out for delivery → Mark delivered) and a **Cancel order** action while `isOrderCancellable` (Pending/Confirmed) — cancel confirms via `Alert`, calls `updateStatus(id,"Cancelled")` (backend restores stock + notifies the customer). Data hooks live in `useOwnerData.ts` (`useBranchOrders`, `useOrder`, `useUpdateOrderStatus`); mutations `invalidateQueries(["branch-orders"])` + `["order", id]`. `StatusPill` gained `OutForDelivery`/`Delivered` variants.

- [ ] **Step 2: Note the wiring in `docs/guides/ui-backend-sync.md`.** Add a row/line under the owner-app section: owner Orders list/detail → `api.orders.listByBranch` / `api.orders.get` / `api.orders.updateStatus`; `updateStatus(id,"Cancelled")` is the owner-cancel path (restore-aware, notifies customer).

- [ ] **Step 3: Final gate.**

```bash
cd apps/owner-app
bun run test 2>&1 | tail -15        # new order tests pass; no NEW failures vs baseline
bunx tsc --noEmit -p tsconfig.json 2>&1 | grep -vE "node_modules" | grep -E "src/" || echo "tsc clean for src"
```
Expected: the order helper/adapter/screen/sheet tests pass; touched files are tsc-clean.

```bash
cd /Users/hasib/Documents/Talash/monorepo/.claude/worktrees/busy-hopper-9a2bb8
bunx biome check apps/owner-app/src/data.ts apps/owner-app/src/components/ui/badge.tsx apps/owner-app/src/lib/adapters.ts apps/owner-app/src/hooks/useOwnerData.ts apps/owner-app/src/context.tsx apps/owner-app/src/app/orders.tsx apps/owner-app/src/components/screens/OrdersScreen.tsx apps/owner-app/src/components/screens/MoreScreen.tsx apps/owner-app/src/components/sheets.tsx "apps/owner-app/src/app/(tabs)/_layout.tsx"
```
Expected: touched files clean.

- [ ] **Step 4: Commit docs.**

```bash
cd /Users/hasib/Documents/Talash/monorepo/.claude/worktrees/busy-hopper-9a2bb8
git add apps/owner-app/AGENTS.md docs/guides/ui-backend-sync.md
git commit -m "docs(owner-app): order management screen + sheet"
```

---

## Self-Review notes

- **Spec coverage:** Navigation/vertical-gate → Task 3 (OverlayId + `/orders` route + commerce-only More item). List screen → Task 3. Detail sheet + guided actions + cancel → Task 4. Data hooks → Task 2. Pure helpers + StatusPill → Task 1. Line-item name resolution → Task 2 (`adaptOrderLine`). Docs → Task 5. Tests → per-task TDD.
- **Type consistency:** `OrderStatus` from `@repo/api-client` used identically in `data.ts` helpers (T1), `useUpdateOrderStatus` (T2), and `OrderDetailSheet.advance` (T4). `nextOrderStatus`/`nextOrderActionLabel`/`isOrderCancellable`/`partitionOrders` defined in T1, consumed in T3/T4. `adaptOrderLine`/`OrderLineVM` defined T2, used T4. `SheetType.orderDetail.orderId` is added in **T3 Step 1** (alongside `OverlayId`), so `OrdersScreen`'s `setSheet({type:"orderDetail"})` is tsc-clean within T3; T4 only adds the dispatcher case + the sheet component. Each task is tsc-clean in isolation.
- **YAGNI:** no customer-name lookup, no owner order notifications, no order search/pagination — per spec out-of-scope.
- **Baseline:** owner-app lint/test baselines may be RED repo-wide; gate on touched files + no new failures.
