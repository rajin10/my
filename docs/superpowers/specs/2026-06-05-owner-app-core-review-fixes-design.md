# Owner-app core review fixes — design

**Date:** 2026-06-05
**Scope:** `apps/owner-app` — fix the 8 findings from the core code review and add guardrail tests. Approach **A** (fix in place, tests only; no shared helpers or broad refactor).

## Goal

Correct 8 verified issues in the owner-app data/logic core (`adapters.ts`, `context.tsx`, `data.ts`, `sheets.tsx`), each at its call site, and add focused tests that guard against the same classes recurring. No new abstractions, no cleanup-only refactors.

## Findings being fixed

| # | File | Line | Issue |
|---|------|------|-------|
| 1 | `src/lib/adapters.ts` | 117 | `adaptApiBooking` returns gross `b.price`, ignoring `b.discount`; disagrees with `adaptCalendarBooking` and overstates TodayScreen revenue. |
| 2 | `src/lib/adapters.ts` | 63 | `adaptReview` hardcodes `name: "Customer"`, discarding API `r.userName`. |
| 3 | `src/data.ts` | 123–131 | `money()`/`shortMoney()` use `₹` + `en-IN`; app targets Bangladesh (`৳`, `en-BD`). |
| 4 | `src/components/sheets.tsx` | ~288 | Service edit shows an editable Branch picker, but the API cannot move a service between branches — the change is silently discarded. |
| 5 | `src/context.tsx` | 858 | `updateStaff` omits `branchId`, silently dropping a branch reassignment. |
| 6 | `src/context.tsx` | 864 | `updateStaff` closes the sheet synchronously before the promise settles; on failure the form is lost. |
| 7 | `src/context.tsx` | 825 | `createCoupon` closes the sheet immediately after a fire-and-forget `mutate()`. |
| 8 | `src/components/sheets.tsx` | 1464 | Coupon usage `pct` divides by `maxUses` with no zero guard → `NaN%` when `maxUses === 0`. |

## Backend constraints verified

- `ApiBooking.discount` exists (`packages/api-client/src/types.ts:138`). Net price = `price - discount`.
- `Review.userName` exists (`types.ts:155`); backend `ReviewsRepository.findPublishedByVenue` LEFT JOINs users and falls back to `"Guest"`, so `userName` is always populated.
- `team.update` accepts `branchId` (`Partial<Pick<AddTeamMemberBody, "role" | "title" | "branchId">>`). Branch reassignment **is** supported → fix is to send it.
- `services.update` **omits** `branchId` on both the API client (`Partial<Omit<CreateServiceBody, "branchId">>`) and the worker service layer (`Partial<Omit<ServiceInsert, "branchId">>`). Moving a service between branches is **not** supported → fix is to make the field read-only in edit mode, not to send `branchId`.

## Changes

### `src/lib/adapters.ts`

**`adaptApiBooking` (line 117)** — subtract discount to match `adaptCalendarBooking`:
```ts
price: b.price - b.discount,
```

**`adaptReview` (line 63)** — use the real reviewer name, matching the existing booking-adapter idiom:
```ts
name: r.userName?.trim() || "Customer",
```

### `src/data.ts` (lines 123–131) + hardcoded `₹` literals

The primary fix is `money()`/`shortMoney()` — replace `₹` → `৳` and `en-IN` → `en-BD`, keeping the `L`/`k` suffixes (lakh/thousand grouping is valid for BD). But several screens hardcode `₹` outside `money()`, so the currency fix also sweeps these literals:

- `src/components/sheets.tsx:311` — `label="Price (₹)"` → `"Price (৳)"`
- `src/components/sheets.tsx:1415` — `"₹ off"` → `"৳ off"`
- `src/components/sheets.tsx:1423` — `"Amount off (₹)"` → `"Amount off (৳)"`
- `src/components/SetupFlow.tsx:563` — `₹{s.price.toLocaleString("en-IN")}` → `৳`/`en-BD`
- `src/components/SetupFlow.tsx:629` — `label="Price (₹)"` → `"Price (৳)"`
- `src/components/screens/MoreScreen.tsx:1150` — `"Currency · INR (₹)"` → `"Currency · BDT (৳)"`

`money()`/`shortMoney()` change:
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

### `src/context.tsx`

**`createCoupon` (line 825)** — close in the success callback (mirrors `addService`); drop the trailing synchronous `setSheet(null)`:
```ts
createCouponMut.mutate(
	{ venueId, code: c.code, type: c.type, value: c.value, maxUses: c.max, expiresAt: oneYearFromNow.toISOString() },
	{ onSuccess: () => setSheet(null) },
);
```

**`updateStaff` (lines 856–865)** — send `branchId` (mapped from branch name via `apiBranches`), convert to `async/await` + try/catch, close only on success:
```ts
async function updateStaff(id: string, m: Partial<TeamMember>) {
	const branchId = apiBranches.find((b) => b.name === m.branch)?.id;
	try {
		await api.team.update(id, { role: m.role as never, title: m.title, branchId });
		qc.invalidateQueries({ queryKey: ["team"] });
		flash("Teammate updated.", { tone: "success", icon: "CheckCircle" });
		setSheet(null);
	} catch (e: unknown) {
		flash((e as Error).message, { tone: "danger" });
	}
}
```

### `src/components/sheets.tsx`

**Service Branch field (AddServiceSheet, ~line 288)** — in edit mode (`initial` is set), render the branch as a **read-only row** showing the current branch instead of an editable picker. Create mode keeps the editable picker. The owner still sees which branch the service belongs to but cannot make a change the backend would silently drop.

**Coupon `pct` (line 1464)** — guard the divisor:
```ts
const pct =
	c && c.maxUses > 0
		? Math.min(100, Math.round((c.usedCount / c.maxUses) * 100))
		: 0;
```

## Guardrail tests (no new abstractions)

**`src/__tests__/adapters.test.ts`**
- Price parity: `adaptApiBooking` and `adaptCalendarBooking` return the same `price` for equivalent input (`price: 1000, discount: 150` → `850` for both).
- `adaptReview` maps `userName` → `name` (e.g. `userName: "Asha"` → `name: "Asha"`).

**`src/__tests__/utils.test.ts`**
- `money(2400)` and `shortMoney(240000)` contain `৳` and never `₹`.

## Out of scope (noted, not done)

Cleanup findings from the review, deliberately excluded per Approach A: duplicated query hooks (`context.tsx` vs `useOwnerData.ts`), status-mutation factory (confirm/cancel/complete), `SegmentedButtonGroup` extraction, `WeekScheduleEditor` extraction. The `CouponDetailSheet` footer using the stale `coupon.status` prop instead of fresh query data was reviewed and judged low-impact; not addressed here.

## Verification

- `bun run lint`
- `bun run owner-app:test`
- Type-check / `bun run build` (or scoped equivalent)

Docs: update `apps/owner-app/AGENTS.md` if any documented behavior changes (currency formatting note; service edit branch read-only).
