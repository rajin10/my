# Khata / Payments Owner UI — Implementation Plan (Plan B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a commerce owner a "Customer dues" (Khata) surface in the owner-app — a list of customers who owe money, a per-customer ledger (delivered orders vs. payments), and the ability to record a cash payment or void a wrong one — consuming the merged khata/payments backend.

**Architecture:** A commerce-only "Customer dues" entry in the More hub → `/khata` route → `KhataScreen`. `KhataScreen` mirrors `CustomersScreen`: a `selected`-state toggle renders an in-file `KhataCustomerLedger` detail (its own `BackHeader`), NOT a bottom sheet. Recording a payment IS a sheet (`RecordPaymentSheet`, `SheetType.recordPayment`); voiding is an inline Alert-confirmed action. Four React Query hooks in `useOwnerData.ts` wrap `api.khata.*` / `api.payments.*`; mutations `invalidateQueries` the khata keys.

**Tech Stack:** Expo 56 + expo-router + React Native + NativeWind, `@tanstack/react-query`, `@repo/api-client` (`api.khata.*`, `api.payments.*`), Vitest + React Native Testing Library (`vitest-native`).

**Spec:** `docs/superpowers/specs/2026-06-10-khata-payments-design.md` (§4 owner-app UI).

**Base:** worktree `claude/khata-payments` (this branch — it has Plan A's backend + api-client). Run `bun install` in the worktree first if needed. **Plan A must be present** (the `api.khata`/`api.payments` endpoint groups + `KhataDue`/`KhataCustomer`/`Payment`/`RecordPaymentBody` types come from it).

**Commands (from `apps/owner-app/`):** `bun run test`, `bunx tsc --noEmit -p tsconfig.json`, `bunx biome check --write <files>`. Repo baselines are pre-existing RED — gate on **touched files + zero new failures vs baseline**. The owner-app full suite was green before this plan.

**api-client surface consumed (from Plan A):**
- `api.khata.dues(businessId): Promise<KhataDue[]>` — `KhataDue = { userId, name, due }`
- `api.khata.customerLedger(userId, businessId): Promise<KhataCustomer>` — `KhataCustomer = { userId, name, due, totalDelivered, totalPaid, deliveredOrders: { id, total, deliveredAt: string|null }[], payments: Payment[] }`
- `api.payments.record(body: RecordPaymentBody): Promise<Payment>` — `RecordPaymentBody = { businessId, userId, amount, note?, orderId? }`
- `api.payments.void(id): Promise<void>`

---

## File Structure

**Modify:**
- `apps/owner-app/src/data.ts` — `totalOutstanding(dues)` pure helper
- `apps/owner-app/src/hooks/useOwnerData.ts` — `useKhataDues`, `useKhataCustomer`, `useRecordPayment`, `useVoidPayment`
- `apps/owner-app/src/context.tsx` — `"khata"` in `OverlayId`; `{ type: "recordPayment"; ... }` in `SheetType`
- `apps/owner-app/src/components/screens/MoreScreen.tsx` — commerce-only "Customer dues" hub item
- `apps/owner-app/src/components/sheets.tsx` — `RecordPaymentSheet`
- `apps/owner-app/src/app/(tabs)/_layout.tsx` — register `recordPayment` in `SheetLayer`

**Create:**
- `apps/owner-app/src/app/khata.tsx` — thin route wrapper → `KhataScreen`
- `apps/owner-app/src/components/screens/KhataScreen.tsx` — dues list + in-file `KhataCustomerLedger`
- `apps/owner-app/src/__tests__/khata-helpers.test.ts` — `totalOutstanding` unit test
- `apps/owner-app/src/__tests__/KhataScreen.test.tsx` — render test
- `apps/owner-app/src/__tests__/RecordPaymentSheet.test.tsx` — component test

---

## Task 1: Pure helper + data hooks

**Files:** modify `apps/owner-app/src/data.ts`, `apps/owner-app/src/hooks/useOwnerData.ts`; create `apps/owner-app/src/__tests__/khata-helpers.test.ts`.

- [ ] **Step 1: Write the failing helper test** — create `apps/owner-app/src/__tests__/khata-helpers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { KhataDue } from "@repo/api-client";
import { totalOutstanding } from "../data";

const due = (over: Partial<KhataDue>): KhataDue =>
	({ userId: "u", name: "n", due: 0, ...over }) as KhataDue;

describe("totalOutstanding", () => {
	it("sums the due across all customers", () => {
		expect(
			totalOutstanding([due({ due: 1500 }), due({ due: 1000 }), due({ due: 250 })]),
		).toBe(2750);
	});

	it("returns 0 for an empty list", () => {
		expect(totalOutstanding([])).toBe(0);
	});
});
```

- [ ] **Step 2: Run → fail.** `cd apps/owner-app && bun run test src/__tests__/khata-helpers.test.ts` → FAIL (`totalOutstanding` not exported).

- [ ] **Step 3: Implement `totalOutstanding` in `data.ts`.** Add the import to the existing `@repo/api-client` type import (or a new line), then append the helper:

```ts
import type { KhataDue } from "@repo/api-client";

// ── Khata ────────────────────────────────────────────────────────────────────

/** Total amount owed across all debtors (the header stat on the Khata screen). */
export function totalOutstanding(dues: KhataDue[]): number {
	return dues.reduce((sum, d) => sum + d.due, 0);
}
```
> `data.ts` already imports types from `@repo/api-client` (e.g. `Order`, `OrderStatus`, `BusinessVertical`) — merge `KhataDue` into that existing `import type { ... } from "@repo/api-client";` line rather than adding a duplicate.

- [ ] **Step 4: Run → pass.** `cd apps/owner-app && bun run test src/__tests__/khata-helpers.test.ts` → PASS (2 cases).

- [ ] **Step 5: Add the four hooks to `apps/owner-app/src/hooks/useOwnerData.ts`.** Confirm the file already imports `useQuery`, `useMutation`, `useQueryClient` from `@tanstack/react-query` and `api` from `../lib/api` (the order hooks do). Add `RecordPaymentBody` to the `@repo/api-client` type imports, then append:

```ts
// ── Khata (commerce) ─────────────────────────────────────────────────────────

export function useKhataDues(businessId: string | null) {
	return useQuery({
		queryKey: ["khata-dues", businessId],
		enabled: !!businessId,
		queryFn: () => api.khata.dues(businessId as string),
	});
}

export function useKhataCustomer(
	userId: string | null,
	businessId: string | null,
) {
	return useQuery({
		queryKey: ["khata-customer", businessId, userId],
		enabled: !!userId && !!businessId,
		queryFn: () =>
			api.khata.customerLedger(userId as string, businessId as string),
	});
}

export function useRecordPayment() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: RecordPaymentBody) => api.payments.record(body),
		onSuccess: (_data, body) => {
			qc.invalidateQueries({ queryKey: ["khata-dues"] });
			qc.invalidateQueries({
				queryKey: ["khata-customer", body.businessId, body.userId],
			});
		},
	});
}

export function useVoidPayment() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.payments.void(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["khata-dues"] });
			qc.invalidateQueries({ queryKey: ["khata-customer"] });
		},
	});
}
```
> `RecordPaymentBody` is exported from the api-client index (`export type { RecordPaymentBody } from "./endpoints/payments"`). `api.khata` / `api.payments` are registered endpoint groups. If `tsc` can't find `RecordPaymentBody` on `@repo/api-client`, confirm the export exists in `packages/api-client/src/index.ts` (it does after Plan A).

- [ ] **Step 6: Typecheck + lint + commit.**

```bash
cd apps/owner-app
bunx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "data.ts|useOwnerData" || echo "no new errors"
bunx biome check --write src/data.ts src/hooks/useOwnerData.ts src/__tests__/khata-helpers.test.ts
cd /Users/hasib/Documents/Talash/monorepo/.claude/worktrees/khata-payments
git checkout -- bun.lock 2>/dev/null || true
git add apps/owner-app/src/data.ts apps/owner-app/src/hooks/useOwnerData.ts apps/owner-app/src/__tests__/khata-helpers.test.ts
git commit -m "feat(owner-app): khata dues/ledger/record/void hooks + totalOutstanding"
```

---

## Task 2: KhataScreen + ledger + route + More entry

**Files:** modify `apps/owner-app/src/context.tsx`, `apps/owner-app/src/components/screens/MoreScreen.tsx`; create `apps/owner-app/src/app/khata.tsx`, `apps/owner-app/src/components/screens/KhataScreen.tsx`, `apps/owner-app/src/__tests__/KhataScreen.test.tsx`.

**Context:** `KhataScreen` mirrors `CustomersScreen` — a `const [selected, setSelected] = useState<KhataDue | null>(null)` toggle: `if (selected) return <KhataCustomerLedger .../>`. The list and the ledger both live in `KhataScreen.tsx` (like `CustomersScreen` holds `CustomerDetail`). `businessId` comes from `useApp()` (`string | null`). The list uses the `BackHeader` + `Card` + loading/error/empty pattern from `OrdersScreen.tsx`. **No `BranchSwitcher`** — khata is business-level. The record-payment button opens a sheet (`SheetType.recordPayment`, built in Task 3); the `SheetType` member is added here so the `setSheet({type:"recordPayment"})` call typechecks now.

- [ ] **Step 1: Add `"khata"` to `OverlayId` and `recordPayment` to `SheetType` (`src/context.tsx`).** Extend `OverlayId` (append after `"orders"`):

```ts
	| "orders"
	| "khata";
```
Add a `SheetType` member after the `orderDetail` member:

```ts
	| { type: "orderDetail"; orderId: string }
	| {
			type: "recordPayment";
			businessId: string;
			userId: string;
			customerName: string;
			due: number;
	  };
```
(`setOverlay("khata")` already does `router.push("/khata")` — no other wiring needed.)

- [ ] **Step 2: Create the route wrapper** `apps/owner-app/src/app/khata.tsx`:

```tsx
import KhataScreen from "@/components/screens/KhataScreen";

export default function KhataRoute() {
	return <KhataScreen />;
}
```

- [ ] **Step 3: Write the failing render test** `apps/owner-app/src/__tests__/KhataScreen.test.tsx`:

```tsx
import { screen } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "./test-utils";

const useApp = vi.fn();
vi.mock("../context", () => ({ useApp: () => useApp() }));

const useKhataDues = vi.fn();
const useKhataCustomer = vi.fn();
const useVoidPayment = vi.fn();
vi.mock("../hooks/useOwnerData", () => ({
	useKhataDues: (b: string | null) => useKhataDues(b),
	useKhataCustomer: (u: string | null, b: string | null) => useKhataCustomer(u, b),
	useVoidPayment: () => useVoidPayment(),
}));

import KhataScreen from "../components/screens/KhataScreen";

beforeEach(() => {
	useApp.mockReturnValue({
		businessId: "biz1",
		setOverlay: vi.fn(),
		setSheet: vi.fn(),
		flash: vi.fn(),
	});
	useKhataCustomer.mockReturnValue({ data: undefined, isLoading: false, isError: false });
	useVoidPayment.mockReturnValue({ mutate: vi.fn(), isPending: false });
});

describe("KhataScreen", () => {
	it("shows the empty state when no one owes", () => {
		useKhataDues.mockReturnValue({ data: [], isLoading: false, isError: false });
		renderWithClient(<KhataScreen />);
		expect(screen.getByText("No outstanding dues.")).toBeTruthy();
	});

	it("renders a debtor row with name and due", () => {
		useKhataDues.mockReturnValue({
			data: [{ userId: "u1", name: "Karim", due: 1500 }],
			isLoading: false,
			isError: false,
		});
		renderWithClient(<KhataScreen />);
		expect(screen.getByText("Karim")).toBeTruthy();
	});
});
```

- [ ] **Step 4: Run → fail.** `cd apps/owner-app && bun run test src/__tests__/KhataScreen.test.tsx` → FAIL (module doesn't exist).

- [ ] **Step 5: Implement `apps/owner-app/src/components/screens/KhataScreen.tsx`:**

```tsx
import type { KhataDue } from "@repo/api-client";
import { useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../context";
import { money, totalOutstanding } from "../../data";
import {
	useKhataCustomer,
	useKhataDues,
	useVoidPayment,
} from "../../hooks/useOwnerData";
import { Colors, Shadow } from "../../tokens";
import { BackHeader, Card } from "../ui";

export default function KhataScreen() {
	const insets = useSafeAreaInsets();
	const { businessId, setOverlay } = useApp();
	const [selected, setSelected] = useState<KhataDue | null>(null);

	const duesQ = useKhataDues(businessId);
	const dues = duesQ.data ?? [];

	if (selected) {
		return (
			<KhataCustomerLedger due={selected} onBack={() => setSelected(null)} />
		);
	}

	return (
		<View className="flex-1 bg-paper">
			<BackHeader
				title="Customer dues"
				onBack={() => setOverlay(null)}
				topInset={insets.top}
			/>

			{dues.length > 0 && (
				<View className="px-4 pb-1">
					<Text className="text-ink-500" style={{ fontSize: 13 }}>
						Total outstanding
					</Text>
					<Text className="text-ink-900 font-bold" style={{ fontSize: 26 }}>
						{money(totalOutstanding(dues))}
					</Text>
				</View>
			)}

			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					paddingHorizontal: 16,
					paddingTop: 14,
					paddingBottom: 32,
					gap: 11,
				}}
			>
				{duesQ.isError ? (
					<View
						className="bg-surface border border-line rounded-lg"
						style={{ padding: 18, ...Shadow.sm }}
					>
						<Text className="text-ink-500 text-center" style={{ fontSize: 13.5 }}>
							Couldn't load dues.
						</Text>
						<TouchableOpacity
							onPress={() => duesQ.refetch()}
							className="self-center"
							style={{ marginTop: 10 }}
						>
							<Text className="text-primary-600 font-semibold" style={{ fontSize: 14 }}>
								Retry
							</Text>
						</TouchableOpacity>
					</View>
				) : dues.length === 0 ? (
					<View
						className="bg-surface border border-line rounded-lg"
						style={{ padding: 18, ...Shadow.sm }}
					>
						<Text className="text-ink-500 text-center" style={{ fontSize: 13.5 }}>
							No outstanding dues.
						</Text>
					</View>
				) : (
					dues.map((d) => (
						<Card key={d.userId} onPress={() => setSelected(d)}>
							<View className="flex-row items-center justify-between" style={{ gap: 12 }}>
								<Text className="flex-1 text-ink-900 font-bold" style={{ fontSize: 15 }}>
									{d.name}
								</Text>
								<Text className="text-ink-900 font-bold" style={{ fontSize: 15 }}>
									{money(d.due)}
								</Text>
							</View>
						</Card>
					))
				)}
			</ScrollView>
		</View>
	);
}

function KhataCustomerLedger({
	due,
	onBack,
}: {
	due: KhataDue;
	onBack: () => void;
}) {
	const insets = useSafeAreaInsets();
	const { businessId, setSheet, flash } = useApp();
	const ledgerQ = useKhataCustomer(due.userId, businessId);
	const voidMut = useVoidPayment();
	const ledger = ledgerQ.data;
	const currentDue = ledger?.due ?? due.due;

	function confirmVoid(paymentId: string) {
		Alert.alert("Void payment", "Remove this payment? The balance will increase.", [
			{ text: "Keep", style: "cancel" },
			{
				text: "Void",
				style: "destructive",
				onPress: () =>
					voidMut.mutate(paymentId, {
						onSuccess: () => flash("Payment voided.", { tone: "success" }),
						onError: (e: unknown) =>
							flash((e as Error).message ?? "Failed", { tone: "danger" }),
					}),
			},
		]);
	}

	return (
		<View className="flex-1 bg-paper">
			<BackHeader title={due.name} onBack={onBack} topInset={insets.top} />
			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 32, gap: 16 }}
			>
				<View>
					<Text className="text-ink-500" style={{ fontSize: 13 }}>
						Outstanding due
					</Text>
					<Text className="text-ink-900 font-bold" style={{ fontSize: 28 }}>
						{money(currentDue)}
					</Text>
				</View>

				{!ledger ? (
					<Text className="text-ink-500" style={{ fontSize: 14 }}>
						{ledgerQ.isError ? "Couldn't load this ledger." : "Loading…"}
					</Text>
				) : (
					<>
						<View style={{ gap: 8 }}>
							<Text className="text-ink-700 font-bold" style={{ fontSize: 13 }}>
								Delivered orders · {money(ledger.totalDelivered)}
							</Text>
							{ledger.deliveredOrders.length === 0 ? (
								<Text className="text-ink-400" style={{ fontSize: 13 }}>None</Text>
							) : (
								ledger.deliveredOrders.map((o) => (
									<View key={o.id} className="flex-row items-center justify-between">
										<Text className="text-ink-700" style={{ fontSize: 13.5 }}>
											#{o.id.slice(0, 8)}
											{o.deliveredAt ? ` · ${new Date(o.deliveredAt).toLocaleDateString("en-BD", { day: "numeric", month: "short" })}` : ""}
										</Text>
										<Text className="text-ink-900 font-semibold" style={{ fontSize: 13.5 }}>
											{money(o.total)}
										</Text>
									</View>
								))
							)}
						</View>

						<View style={{ gap: 8 }}>
							<Text className="text-ink-700 font-bold" style={{ fontSize: 13 }}>
								Payments · {money(ledger.totalPaid)}
							</Text>
							{ledger.payments.length === 0 ? (
								<Text className="text-ink-400" style={{ fontSize: 13 }}>None yet</Text>
							) : (
								ledger.payments.map((p) => (
									<View key={p.id} className="flex-row items-center justify-between">
										<Text className="text-ink-700" style={{ fontSize: 13.5 }}>
											{money(p.amount)}
											{p.note ? ` · ${p.note}` : ""}
										</Text>
										<TouchableOpacity onPress={() => confirmVoid(p.id)} disabled={voidMut.isPending}>
											<Text className="text-danger font-semibold" style={{ fontSize: 13 }}>
												Void
											</Text>
										</TouchableOpacity>
									</View>
								))
							)}
						</View>
					</>
				)}
			</ScrollView>

			<View
				className="px-4 border-t border-line"
				style={{ paddingTop: 12, paddingBottom: insets.bottom + 12 }}
			>
				<TouchableOpacity
					onPress={() =>
						setSheet({
							type: "recordPayment",
							businessId: businessId as string,
							userId: due.userId,
							customerName: due.name,
							due: currentDue,
						})
					}
					className="bg-primary-900 items-center rounded-lg"
					style={{ paddingVertical: 14 }}
				>
					<Text className="text-white font-bold" style={{ fontSize: 15 }}>
						Record payment
					</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
}
```
> If `tsc`/`biome` flags an unused `Colors` import, remove it (the screen uses `Shadow` + `Colors.*` only if referenced — keep only what's used; the `text-danger` class covers the void color via NativeWind, so `Colors` may be unused → drop it). Reconcile `Card`'s `onPress`, `BackHeader`'s props, and `money` against the real signatures (all used identically in `OrdersScreen.tsx`/`CustomersScreen.tsx`). The `danger` text color class is `text-danger` (used elsewhere); if NativeWind doesn't resolve it, use `style={{ color: Colors.danger }}` and keep the `Colors` import.

- [ ] **Step 6: Run → pass.** `cd apps/owner-app && bun run test src/__tests__/KhataScreen.test.tsx` → PASS (empty + row). If a native dep isn't stubbed, mirror `TodayScreen.status.test.tsx`'s stubs.

- [ ] **Step 7: Add the commerce-only "Customer dues" hub item in `MoreScreen.tsx`.** In the `groups` array, add this item to the first group's `items` (right after the conditional `orders` item — same commerce gate), so commerce owners see both Orders and Customer dues:

```ts
		...(business.vertical === "commerce"
			? [
					{
						id: "khata",
						icon: "Wallet",
						label: "Customer dues",
						sub: "Khata — record & track payments",
					},
				]
			: []),
```
Place it immediately after the existing `...(business.vertical === "commerce" ? [{ id: "orders", ... }] : [])` spread (two separate commerce-gated spreads, or merge both objects into one commerce spread array — either is fine; keep the existing `orders` item intact). The row routes via the existing `onPress={() => setOverlay(it.id as OverlayId)}` → `/khata`. Verify `"Wallet"` is a valid `IconName`; if `tsc` rejects it, use `"Coins"` or `"Receipt"` (whichever exists in the `IconName` union — check `src/components/ui/icon.tsx` / lucide).

- [ ] **Step 8: Typecheck + lint + commit.**

```bash
cd apps/owner-app
bunx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "KhataScreen|khata.tsx|MoreScreen|context.tsx" || echo "no new errors"
bunx biome check --write src/context.tsx src/app/khata.tsx src/components/screens/KhataScreen.tsx src/components/screens/MoreScreen.tsx src/__tests__/KhataScreen.test.tsx
cd /Users/hasib/Documents/Talash/monorepo/.claude/worktrees/khata-payments
git checkout -- bun.lock 2>/dev/null || true
git add apps/owner-app/src/context.tsx apps/owner-app/src/app/khata.tsx apps/owner-app/src/components/screens/KhataScreen.tsx apps/owner-app/src/components/screens/MoreScreen.tsx apps/owner-app/src/__tests__/KhataScreen.test.tsx
git commit -m "feat(owner-app): Customer dues (Khata) screen + ledger + commerce More entry"
```

> Run the full owner-app suite to confirm no regression: `cd apps/owner-app && bun run test 2>&1 | tail -4`.

---

## Task 3: RecordPaymentSheet

**Files:** modify `apps/owner-app/src/components/sheets.tsx`, `apps/owner-app/src/app/(tabs)/_layout.tsx`; create `apps/owner-app/src/__tests__/RecordPaymentSheet.test.tsx`.

**Context:** A sheet to record a payment (`SheetType.recordPayment`, added in Task 2). Follows the `AddProductSheet` conventions: a `submitting` guard, `disabled={!valid || submitting}` footer, close-on-success inside the mutation's `onSuccess`, and a digit-only amount input (`replace(/[^0-9]/g, "")`). Amount is **prefilled to the current due** (editable for a partial payment). Registered in `SheetLayer` (`(tabs)/_layout.tsx`).

- [ ] **Step 1: Write the failing component test** `apps/owner-app/src/__tests__/RecordPaymentSheet.test.tsx`:

```tsx
import { fireEvent, screen } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "./test-utils";

const useApp = vi.fn();
vi.mock("../context", () => ({ useApp: () => useApp() }));

const mutate = vi.fn();
vi.mock("../hooks/useOwnerData", () => ({
	useRecordPayment: () => ({ mutate, isPending: false }),
}));
vi.mock("../lib/api", () => ({ api: {} }));
vi.mock("expo-image-picker", () => ({}));

import { RecordPaymentSheet } from "../components/sheets";

beforeEach(() => {
	mutate.mockReset();
	useApp.mockReturnValue({ setSheet: vi.fn(), flash: vi.fn() });
});

describe("RecordPaymentSheet", () => {
	it("prefills the amount with the current due and records it on submit", () => {
		renderWithClient(
			<RecordPaymentSheet businessId="biz1" userId="u1" customerName="Karim" due={1500} />,
		);
		// the prefilled amount is visible
		expect(screen.getByDisplayValue("1500")).toBeTruthy();
		fireEvent.press(screen.getByText("Record payment"));
		expect(mutate).toHaveBeenCalledWith(
			expect.objectContaining({ businessId: "biz1", userId: "u1", amount: 1500 }),
			expect.anything(),
		);
	});
});
```
> If `getByDisplayValue` doesn't match (the input mock renders differently), assert via the submit path only — keep the `mutate` assertion, which is the load-bearing check. If `sheets.tsx` pulls native libs into the test graph, add the same stubs `sheets-forms.test.tsx` uses.

- [ ] **Step 2: Run → fail.** `cd apps/owner-app && bun run test src/__tests__/RecordPaymentSheet.test.tsx` → FAIL (`RecordPaymentSheet` not exported).

- [ ] **Step 3: Implement `RecordPaymentSheet` in `apps/owner-app/src/components/sheets.tsx`.** Merge any missing imports (most are present): `useState` from `react`; `Text`, `View` from `react-native`; `useApp` from `../context`; `Sheet`, `Button`, `TextField` from the UI barrel that `sheets.tsx` already imports; `useRecordPayment` from `../hooks/useOwnerData`. Add the component (after `OrderDetailSheet`):

```tsx
export function RecordPaymentSheet({
	businessId,
	userId,
	customerName,
	due,
}: {
	businessId: string;
	userId: string;
	customerName: string;
	due: number;
}) {
	const { setSheet, flash } = useApp();
	const recordMut = useRecordPayment();
	const [amount, setAmount] = useState(due > 0 ? String(due) : "");
	const [note, setNote] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const amountNum = Number(amount) || 0;
	const valid = Number.isInteger(amountNum) && amountNum > 0;

	function submit() {
		if (!valid || submitting) return;
		setSubmitting(true);
		recordMut.mutate(
			{
				businessId,
				userId,
				amount: amountNum,
				note: note.trim() ? note.trim() : undefined,
			},
			{
				onSuccess: () => {
					setSheet(null);
					flash("Payment recorded.", { tone: "success" });
				},
				onError: (e: unknown) => {
					setSubmitting(false);
					flash((e as Error).message ?? "Failed to record payment", {
						tone: "danger",
					});
				},
			},
		);
	}

	const footer = (
		<Button
			variant="primary"
			icon="Check"
			full
			disabled={!valid || submitting}
			onPress={submit}
		>
			Record payment
		</Button>
	);

	return (
		<Sheet
			visible
			title="Record payment"
			onClose={() => setSheet(null)}
			footer={footer}
		>
			<View style={{ gap: 14 }}>
				<Text className="text-ink-500" style={{ fontSize: 13.5 }}>
					Cash received from {customerName} (current due {due})
				</Text>
				<TextField
					label="Amount (৳)"
					value={amount}
					onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ""))}
					keyboardType="number-pad"
					placeholder="0"
				/>
				<TextField
					label="Note (optional)"
					value={note}
					onChangeText={setNote}
					placeholder="e.g. partial, bKash ref…"
				/>
			</View>
		</Sheet>
	);
}
```
> Reconcile `TextField`'s props (`label`/`value`/`onChangeText`/`keyboardType`/`placeholder`) against its real signature in `src/components/ui/text-field.tsx` and against how `AddProductSheet` uses it — match exactly. `Sheet`/`Button` are used identically by `OrderDetailSheet`. If `due` should be rendered as money in the helper text, wrap with `money(due)` (import `money` from `../data` if not already imported in `sheets.tsx`).

- [ ] **Step 4: Run → pass.** `cd apps/owner-app && bun run test src/__tests__/RecordPaymentSheet.test.tsx` → PASS.

- [ ] **Step 5: Register in `SheetLayer` (`src/app/(tabs)/_layout.tsx`).** Add `RecordPaymentSheet` to the existing import from `../../components/sheets`, then add a case before `default:` in the `switch (sheet.type)`:

```tsx
		case "recordPayment":
			return (
				<RecordPaymentSheet
					businessId={sheet.businessId}
					userId={sheet.userId}
					customerName={sheet.customerName}
					due={sheet.due}
				/>
			);
```

- [ ] **Step 6: Run → pass + tsc + full suite.**

```bash
cd apps/owner-app
bun run test src/__tests__/RecordPaymentSheet.test.tsx
bunx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "sheets.tsx|_layout.tsx|RecordPaymentSheet" || echo "no new errors"
bun run test 2>&1 | tail -4
```
Expected: sheet test passes; touched-files tsc clean; full owner-app suite green.

- [ ] **Step 7: Lint + commit.**

```bash
cd apps/owner-app
bunx biome check --write src/components/sheets.tsx "src/app/(tabs)/_layout.tsx" src/__tests__/RecordPaymentSheet.test.tsx
cd /Users/hasib/Documents/Talash/monorepo/.claude/worktrees/khata-payments
git checkout -- bun.lock 2>/dev/null || true
git add apps/owner-app/src/components/sheets.tsx "apps/owner-app/src/app/(tabs)/_layout.tsx" apps/owner-app/src/__tests__/RecordPaymentSheet.test.tsx
git commit -m "feat(owner-app): record-payment sheet (prefilled to due) + SheetLayer wiring"
```

---

## Task 4: Docs + final gate

**Files:** modify `apps/owner-app/AGENTS.md`, `docs/guides/ui-backend-sync.md`.

- [ ] **Step 1: Document in `apps/owner-app/AGENTS.md`.** Add a paragraph after the existing "Orders (commerce):" paragraph:

```markdown
**Customer dues / Khata (commerce):** A commerce owner manages the credit ledger from **More → Customer dues** (`/khata` route; hidden for booking businesses). `KhataScreen` mirrors `CustomersScreen` — a `selected`-state toggle renders an in-file `KhataCustomerLedger` (its own `BackHeader`), not a sheet. The list shows debtors (`useKhataDues` → customers with `due > 0`) with a **total outstanding** header (`totalOutstanding` in `data.ts`). The ledger (`useKhataCustomer`) shows the current due, delivered orders (debits) and payments (credits), a **Record payment** button (opens `RecordPaymentSheet`, `SheetType.recordPayment`), and an inline **Void** per payment (`useVoidPayment`, Alert-confirmed). `RecordPaymentSheet` prefills the amount to the current due (editable; digit-only input), records via `useRecordPayment` (`api.payments.record`), and closes on success. Mutations `invalidateQueries(["khata-dues"])` + `["khata-customer", businessId, userId]`. Khata is **business-level** (no `BranchSwitcher`).
```

- [ ] **Step 2: Note the wiring in `docs/guides/ui-backend-sync.md`.** Under the owner-app section, add: owner Khata screen/ledger → `api.khata.dues` / `api.khata.customerLedger`; record/void → `api.payments.record` / `api.payments.void`; commerce-vertical only, reached from More → Customer dues.

- [ ] **Step 3: Final gate.**

```bash
cd apps/owner-app
bun run test 2>&1 | tail -6        # all owner-app tests green (incl. khata-helpers, KhataScreen, RecordPaymentSheet)
bunx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "KhataScreen|khata|RecordPayment|useOwnerData|/data.ts|context.tsx|MoreScreen|sheets.tsx" || echo "khata feature files tsc-clean"
```
Expected: green suite; feature files tsc-clean (the repo's other pre-existing owner-app baseline errors, if any, are out of scope).

```bash
cd /Users/hasib/Documents/Talash/monorepo/.claude/worktrees/khata-payments
bunx biome check apps/owner-app/src/data.ts apps/owner-app/src/hooks/useOwnerData.ts apps/owner-app/src/context.tsx apps/owner-app/src/app/khata.tsx apps/owner-app/src/components/screens/KhataScreen.tsx apps/owner-app/src/components/screens/MoreScreen.tsx apps/owner-app/src/components/sheets.tsx "apps/owner-app/src/app/(tabs)/_layout.tsx" apps/owner-app/src/__tests__/khata-helpers.test.ts apps/owner-app/src/__tests__/KhataScreen.test.tsx apps/owner-app/src/__tests__/RecordPaymentSheet.test.tsx
```
Expected: touched files clean.

- [ ] **Step 4: Commit docs.**

```bash
cd /Users/hasib/Documents/Talash/monorepo/.claude/worktrees/khata-payments
git add apps/owner-app/AGENTS.md docs/guides/ui-backend-sync.md
git commit -m "docs(owner-app): Customer dues (Khata) screen + record-payment sheet"
```

---

## Self-Review notes

- **Spec coverage (§4):** commerce-only More entry + `/khata` route → Task 2. `KhataScreen` list + `selected`-toggle ledger (mirrors `CustomersScreen`) → Task 2. Record-payment sheet (prefilled to due) → Task 3. Void per payment (Alert) → Task 2 (`KhataCustomerLedger`). Hooks + `totalOutstanding` → Task 1. Docs → Task 4.
- **Type consistency:** `KhataDue`/`KhataCustomer`/`Payment`/`RecordPaymentBody` come from `@repo/api-client` (Plan A) and are used identically in the hooks (T1), the screen/ledger (T2), and the sheet (T3). `SheetType.recordPayment` ({businessId,userId,customerName,due}) is defined in T2 and consumed by `SheetLayer` + `RecordPaymentSheet` in T3. Query keys `["khata-dues"]` / `["khata-customer", businessId, userId]` match between the hooks' `invalidateQueries` (T1) and the queries (T1).
- **Mirrors the merged Orders feature** (same OverlayId/SheetType/More-entry/route/SheetLayer mechanics) and `CustomersScreen` (the `selected` list↔detail toggle) — low novelty, high pattern-reuse.
- **YAGNI:** no `BranchSwitcher` (khata is business-level), no customer-facing dues, no payment edit (void + re-add), no statements export — all per spec out-of-scope.
- **Owner-only effective** is enforced by the backend (`assertBusinessOwner`); the UI just surfaces it for the single managed business via `useApp().businessId`.
```
