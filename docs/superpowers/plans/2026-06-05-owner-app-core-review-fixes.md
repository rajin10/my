# Owner-app Core Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 verified findings in the owner-app data/logic core (discount math, review name, BDT currency, staff branch reassignment, sheet-close timing, coupon NaN), each at its call site, with guardrail tests.

**Architecture:** Approach A — fix in place, no new shared helpers or abstractions. Pure unit-testable changes (`adapters.ts`, `data.ts`) get TDD tasks; UI/context changes get implement-then-verify tasks (type-check + lint + full suite, since the app has no React component test harness).

**Tech Stack:** Expo 56 / React Native / TypeScript, Vitest, `@repo/api-client` types.

**Working directory for all commands:** `apps/owner-app` (run from there unless noted).
**Reference spec:** `docs/superpowers/specs/2026-06-05-owner-app-core-review-fixes-design.md`

---

## Verified backend constraints (do not re-investigate)

- `ApiBooking.discount: number` exists (`packages/api-client/src/types.ts:138`). Net price = `price - discount`.
- `Review.userName: string` exists (`types.ts:155`); backend already falls back to `"Guest"`, so it is always populated.
- `team.update` accepts `branchId` (`packages/api-client/src/endpoints/team.ts:27`, `Partial<Pick<AddTeamMemberBody, "role" | "title" | "branchId">>`). Sending it works.
- `services.update` **omits** `branchId` on both client and worker. A service **cannot** be moved between branches → make the field read-only in edit mode; do **not** send `branchId`.

---

## Task 1: adaptApiBooking — subtract discount (TDD)

**Files:**
- Modify: `src/lib/adapters.ts:117`
- Test: `src/__tests__/adapters.test.ts` (stub at lines 8–19; add parity test)

- [ ] **Step 1: Add `discount` to the test stub and a price-parity test**

In `src/__tests__/adapters.test.ts`, update `makeApiBranchBooking` to include a `discount` field so the new subtraction has a defined operand:

```ts
function makeApiBranchBooking(slot: string): ApiBranchBooking {
	return {
		id: "b1",
		slot,
		serviceId: "s1",
		branchId: "br1",
		customerName: "Alice",
		price: 500,
		discount: 0,
		status: "Confirmed",
		createdAt: "2026-01-01T10:00:00Z",
	} as ApiBranchBooking;
}
```

Then add this `describe` block at the end of the file:

```ts
// ── Booking price parity ──────────────────────────────────────────────────────

describe("booking price — adaptApiBooking and adaptCalendarBooking agree", () => {
	it("adaptApiBooking subtracts discount", () => {
		// biome-ignore lint/suspicious/noExplicitAny: minimal stub
		const booking: any = {
			...makeApiBranchBooking("2026-06-04T10:00:00"),
			price: 1000,
			discount: 150,
		};
		const b = adaptApiBooking(booking, { services: [], apiBranches: [] });
		expect(b.price).toBe(850);
	});

	it("both adapters return the same price for equivalent input", () => {
		// biome-ignore lint/suspicious/noExplicitAny: minimal stubs
		const api: any = {
			...makeApiBranchBooking("2026-06-04T10:00:00"),
			price: 1000,
			discount: 150,
		};
		// biome-ignore lint/suspicious/noExplicitAny: minimal stub
		const cal: any = {
			...makeCalendarBooking("2026-06-04T10:00:00"),
			price: 1000,
			discount: 150,
		};
		const fromApi = adaptApiBooking(api, { services: [], apiBranches: [] });
		const fromCal = adaptCalendarBooking(cal, []);
		expect(fromApi.price).toBe(fromCal.price);
		expect(fromApi.price).toBe(850);
	});
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `bun run test -- adapters` (from `apps/owner-app`)
Expected: FAIL — `adaptApiBooking subtracts discount` gets `1000`, expected `850` (current code returns gross `b.price`).

- [ ] **Step 3: Implement — subtract discount**

In `src/lib/adapters.ts`, change line 117 inside `adaptApiBooking`:

```ts
		price: b.price - b.discount,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test -- adapters`
Expected: PASS (all adapter tests green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/adapters.ts src/__tests__/adapters.test.ts
git commit -m "fix(owner-app): subtract discount in adaptApiBooking for correct net price"
```

---

## Task 2: adaptReview — use real reviewer name (TDD)

**Files:**
- Modify: `src/lib/adapters.ts:63`
- Test: `src/__tests__/adapters.test.ts` (extend the existing `adaptReview` describe block)

- [ ] **Step 1: Add failing tests for the name mapping**

In `src/__tests__/adapters.test.ts`, inside the existing `describe("adaptReview — service name lookup", ...)` block, add:

```ts
	it("uses the API userName as the display name", () => {
		const r = adaptReview(makeApiReview({ userName: "Asha Rahman" }), []);
		expect(r.name).toBe("Asha Rahman");
	});

	it("falls back to 'Customer' when userName is blank", () => {
		const r = adaptReview(makeApiReview({ userName: "  " }), []);
		expect(r.name).toBe("Customer");
	});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test -- adapters`
Expected: FAIL — `uses the API userName` gets `"Customer"`, expected `"Asha Rahman"` (line 63 hardcodes `"Customer"`).

- [ ] **Step 3: Implement — read userName with fallback**

In `src/lib/adapters.ts`, change line 63 inside `adaptReview`:

```ts
		name: r.userName?.trim() || "Customer",
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test -- adapters`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/adapters.ts src/__tests__/adapters.test.ts
git commit -m "fix(owner-app): show real reviewer name from API userName in adaptReview"
```

---

## Task 3: money/shortMoney — BDT currency and locale (TDD)

**Files:**
- Modify: `src/data.ts:123-131`
- Test: `src/__tests__/utils.test.ts:4-48`

- [ ] **Step 1: Update existing money/shortMoney tests to expect ৳ and add a no-rupee guard**

In `src/__tests__/utils.test.ts`, replace the `money` and `shortMoney` describe blocks (lines 4–48) with:

```ts
describe("money", () => {
	it("formats zero", () => {
		expect(money(0)).toBe("৳0");
	});

	it("formats hundreds", () => {
		expect(money(500)).toBe("৳500");
	});

	it("uses the BDT symbol and never the rupee symbol", () => {
		const result = money(100000);
		expect(result).toContain("৳");
		expect(result).not.toContain("₹");
		expect(result).toContain("1");
	});
});

describe("shortMoney", () => {
	it("returns raw amount for < 1000", () => {
		expect(shortMoney(750)).toBe("৳750");
	});

	it("formats 1000 as 1k", () => {
		expect(shortMoney(1000)).toBe("৳1k");
	});

	it("formats 1500 as 1.5k", () => {
		expect(shortMoney(1500)).toBe("৳1.5k");
	});

	it("formats 2000 as 2k without decimal", () => {
		expect(shortMoney(2000)).toBe("৳2k");
	});

	it("formats 100000 as 1L", () => {
		expect(shortMoney(100000)).toBe("৳1L");
	});

	it("formats 250000 as 2.5L", () => {
		expect(shortMoney(250000)).toBe("৳2.5L");
	});

	it("formats 500000 as 5L without decimal", () => {
		expect(shortMoney(500000)).toBe("৳5L");
	});

	it("never uses the rupee symbol", () => {
		expect(shortMoney(2400)).not.toContain("₹");
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test -- utils`
Expected: FAIL — current `money(0)` returns `"₹0"`, expected `"৳0"`.

- [ ] **Step 3: Implement — swap symbol and locale**

In `src/data.ts`, replace `money` and `shortMoney` (lines 123–131) with:

```ts
export function money(n: number): string {
	return `৳${Number(n).toLocaleString("en-BD")}`;
}

export function shortMoney(n: number): string {
	if (n >= 100000) return `৳${(n / 100000).toFixed(1).replace(/\.0$/, "")}L`;
	if (n >= 1000) return `৳${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
	return `৳${n}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test -- utils`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data.ts src/__tests__/utils.test.ts
git commit -m "fix(owner-app): format money as BDT (৳) with en-BD locale"
```

---

## Task 4: Sweep remaining hardcoded ₹ literals

**Files:**
- Modify: `src/components/sheets.tsx:311,1415,1423`
- Modify: `src/components/SetupFlow.tsx:563,629`
- Modify: `src/components/screens/MoreScreen.tsx:1150`

No unit tests cover these literal strings; verification is type-check + lint + a grep proving no `₹` remains in `src/` (outside this plan's intentionally-removed ones).

- [ ] **Step 1: Replace the literals**

`src/components/sheets.tsx:311` — change `label="Price (₹)"` to:
```tsx
						label="Price (৳)"
```

`src/components/sheets.tsx:1415` — change `{t === "Percentage" ? "% off" : "₹ off"}` to:
```tsx
									{t === "Percentage" ? "% off" : "৳ off"}
```

`src/components/sheets.tsx:1423` — change `label={type === "Percentage" ? "Percent off" : "Amount off (₹)"}` to:
```tsx
						label={type === "Percentage" ? "Percent off" : "Amount off (৳)"}
```

`src/components/SetupFlow.tsx:563` — change `₹{s.price.toLocaleString("en-IN")}` to:
```tsx
									৳{s.price.toLocaleString("en-BD")}
```

`src/components/SetupFlow.tsx:629` — change `label="Price (₹)"` to:
```tsx
						label="Price (৳)"
```

`src/components/screens/MoreScreen.tsx:1150` — change `"Currency · INR (₹)"` to:
```tsx
            "Currency · BDT (৳)",
```

- [ ] **Step 2: Verify no stray rupee symbols remain in source**

Run (from `apps/owner-app`): `grep -rn "₹" src`
Expected: only matches inside `src/__tests__/utils.test.ts` (the `.not.toContain("₹")` guards) — no `₹` in any non-test `.ts`/`.tsx` file.

- [ ] **Step 3: Type-check and lint**

Run: `bunx tsc --noEmit` then `bun run lint`
Expected: both pass, no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/sheets.tsx src/components/SetupFlow.tsx src/components/screens/MoreScreen.tsx
git commit -m "fix(owner-app): replace hardcoded ₹ literals with BDT ৳ across screens"
```

---

## Task 5: createCoupon — close sheet only on success

**Files:**
- Modify: `src/context.tsx:813-826`

- [ ] **Step 1: Move setSheet(null) into the mutation onSuccess**

In `src/context.tsx`, replace the body of `createCoupon` (lines 813–826) with:

```ts
	function createCoupon(c: Omit<Coupon, "id" | "used" | "status" | "expires">) {
		if (!venueId) return;
		const oneYearFromNow = new Date();
		oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
		createCouponMut.mutate(
			{
				venueId,
				code: c.code,
				type: c.type,
				value: c.value,
				maxUses: c.max,
				expiresAt: oneYearFromNow.toISOString(),
			},
			{ onSuccess: () => setSheet(null) },
		);
	}
```

(The trailing standalone `setSheet(null)` is removed; the sheet now closes only after the mutation succeeds. `createCouponMut`'s existing `onError` still flashes the error while the sheet stays open.)

- [ ] **Step 2: Type-check and lint**

Run: `bunx tsc --noEmit` then `bun run lint`
Expected: both pass.

- [ ] **Step 3: Run the full test suite (no regressions)**

Run: `bun run test`
Expected: PASS (no behavior the existing tests assert is changed).

- [ ] **Step 4: Commit**

```bash
git add src/context.tsx
git commit -m "fix(owner-app): keep coupon sheet open until create succeeds"
```

---

## Task 6: updateStaff — send branchId and close only on success

**Files:**
- Modify: `src/context.tsx:856-865`

Note: `updateStaff` already has `apiBranches` in scope (same provider closure as `addStaff`, which uses it). `m.branch` is the branch **name** (the `TeamMember` view model stores the branch name); map it to an id.

- [ ] **Step 1: Rewrite updateStaff as async with branchId and success-gated close**

In `src/context.tsx`, replace `updateStaff` (lines 856–865) with:

```ts
	async function updateStaff(id: string, m: Partial<TeamMember>) {
		const branchId = apiBranches.find((b) => b.name === m.branch)?.id;
		try {
			await api.team.update(id, {
				role: m.role as never,
				title: m.title,
				branchId,
			});
			qc.invalidateQueries({ queryKey: ["team"] });
			flash("Teammate updated.", { tone: "success", icon: "CheckCircle" });
			setSheet(null);
		} catch (e: unknown) {
			flash((e as Error).message, { tone: "danger" });
		}
	}
```

- [ ] **Step 2: Type-check and lint**

Run: `bunx tsc --noEmit` then `bun run lint`
Expected: both pass. (`api.team.update` accepts `branchId` per `team.ts:27`, so `branchId` is a valid optional field; `undefined` is allowed when the branch name doesn't resolve.)

- [ ] **Step 3: Run the full test suite**

Run: `bun run test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/context.tsx
git commit -m "fix(owner-app): persist branch reassignment in updateStaff and close sheet only on success"
```

---

## Task 7: AddServiceSheet — read-only branch field in edit mode

**Files:**
- Modify: `src/components/sheets.tsx:286-301`

The branch cannot be changed on an existing service (the API omits `branchId` on update). In edit mode show the branch as a read-only box so the owner still sees it but cannot make a change that would silently fail. `editing`, `Colors`, `Radius`, and `Text` are all already in scope/imported in this file.

- [ ] **Step 1: Conditionally render a read-only branch box when editing**

In `src/components/sheets.tsx`, replace the branch/category row (lines 286–301) with:

```tsx
				<View style={{ flexDirection: "row", gap: 12 }}>
					{editing ? (
						<View style={{ flex: 1 }}>
							<Text
								className="text-ink-700 font-semibold"
								style={{ fontSize: 13.5, marginBottom: 6 }}
							>
								Branch
							</Text>
							<View
								style={{
									paddingVertical: 12,
									paddingHorizontal: 14,
									borderRadius: Radius.md,
									borderWidth: 1,
									borderColor: Colors.lineSoft,
									backgroundColor: Colors.lineSoft,
								}}
							>
								<Text style={{ fontSize: 16, color: Colors.ink500 }}>
									{branch}
								</Text>
							</View>
						</View>
					) : (
						<PickerField
							label="Branch"
							value={branch}
							options={venue.branches}
							onChange={setBranch}
							style={{ flex: 1 }}
						/>
					)}
					<PickerField
						label="Category"
						value={category}
						options={CATEGORY_OPTIONS}
						onChange={setCategory}
						style={{ flex: 1 }}
					/>
				</View>
```

- [ ] **Step 2: Type-check and lint**

Run: `bunx tsc --noEmit` then `bun run lint`
Expected: both pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/sheets.tsx
git commit -m "fix(owner-app): make service branch read-only in edit mode (API can't move services)"
```

---

## Task 8: CouponDetailSheet — guard pct against maxUses=0

**Files:**
- Modify: `src/components/sheets.tsx:1463-1465`

- [ ] **Step 1: Add the zero guard to the pct calculation**

In `src/components/sheets.tsx`, replace the `pct` definition (lines 1463–1465) with:

```tsx
	const pct =
		c && c.maxUses > 0
			? Math.min(100, Math.round((c.usedCount / c.maxUses) * 100))
			: 0;
```

- [ ] **Step 2: Type-check and lint**

Run: `bunx tsc --noEmit` then `bun run lint`
Expected: both pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/sheets.tsx
git commit -m "fix(owner-app): guard coupon usage percentage against zero maxUses"
```

---

## Task 9: Docs update and final verification

**Files:**
- Modify: `apps/owner-app/AGENTS.md` (Testing section + a currency/formatting note)

- [ ] **Step 1: Document the behavior changes in AGENTS.md**

In `apps/owner-app/AGENTS.md`, under the `## Key conventions` list, add a bullet:

```markdown
- Money is formatted as BDT (`৳`) with the `en-BD` locale via `money()`/`shortMoney()` in `src/data.ts`. Do not hardcode `₹`.
```

And under the existing service-edit description (the "Service cards in `ServicesScreen`…" paragraph), append:

```markdown
A service cannot be moved between branches after creation (the API omits `branchId` on update), so `AddServiceSheet` shows the branch as a read-only field in edit mode.
```

- [ ] **Step 2: Run the full verification suite**

Run, from `apps/owner-app`:
```bash
bunx tsc --noEmit
bun run lint
bun run test
```
Expected: type-check clean, lint clean, all tests pass.

- [ ] **Step 3: Confirm no rupee symbols remain outside test guards**

Run: `grep -rn "₹" src`
Expected: matches only in `src/__tests__/utils.test.ts` (the `.not.toContain("₹")` guards).

- [ ] **Step 4: Commit**

```bash
git add apps/owner-app/AGENTS.md
git commit -m "docs(owner-app): note BDT formatting and read-only service branch in edit mode"
```

---

## Self-review notes

- **Spec coverage:** Findings #1 (Task 1), #2 (Task 2), #3 (Tasks 3+4), #4 (Task 7), #5+#6 (Task 6), #7 (Task 5), #8 (Task 8). All 8 covered; docs in Task 9.
- **Test gaps acknowledged:** context/sheet UI changes (Tasks 5–8) have no component-test harness in this app, so they rely on type-check + lint + the existing suite for regression safety, consistent with how the prior owner-app fixes were verified.
- **Type consistency:** `branchId` is passed as `string | undefined` to `api.team.update`, valid per `Partial<Pick<…,"branchId">>`. `b.discount` is `number` on `ApiBooking`. `c.maxUses` is `number` on `ApiCoupon`.
