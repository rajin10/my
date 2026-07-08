# Rewards & Loyalty — Design Spec

**Date:** 2026-06-04  
**Scope:** business-dashboard + owner-app  
**Status:** Approved — **not yet implemented** (`reward_settings` table does not exist in schema)

> Design spec only. Customer rewards (balance, history, redeem) are live; per-business owner configuration in this doc is pending.

---

## 1. Goal

Expose the existing rewards backend (points balance, transaction history, redemption) in both owner-facing platforms. Owners get a dedicated Rewards page in the dashboard and embedded controls in the mobile app. Per-business rules are fully configurable.

---

## 2. Data Model

### New table: `reward_settings`

One row per business, created on first save. Falls back to defaults if no row exists.

| Column | Type | Default | Constraint |
|---|---|---|---|
| `id` | text (PK) | — | — |
| `businessId` | text (unique FK → businesses) | — | one config per business |
| `pointsPerUnit` | integer | `10` | ≥ 1 (₹ spent per 1 point earned) |
| `minRedemptionPoints` | integer | `100` | ≥ 1 |
| `pointsPerRedemptionUnit` | integer | `100` | ≥ 1 (points exchanged per ₹1 discount) |
| `expiryMonths` | integer \| null | `null` | 1–60 or null (null = never expires) |
| `createdAt` | text | — | ISO timestamp |
| `updatedAt` | text | — | ISO timestamp |
| `deletedAt` | text \| null | `null` | soft delete |

### Points pool

Points are **global per user** — one `reward_points` row per user, one balance across all businesses. Per-business settings control how points are *earned* at that business and when they *expire*. A customer's balance from business A can be redeemed at business B.

### Modified earning logic

`POINTS_RATE = 10` in `rewards.repository.ts` becomes a per-business lookup. `RewardsService.creditForBooking` gains a `businessId` parameter. The service fetches `reward_settings` for that business and uses `pointsPerUnit` (falling back to `10` if no row exists).

The queue worker that calls `creditForBooking` on booking completion passes `businessId` from the booking record.

### `reward_transactions` schema addition

A `businessId` column (text, nullable FK → businesses) is added to `reward_transactions`. Populated on every `credit` and `manualCredit` call. Existing rows remain null (treated as "no expiry" by the cron). Manual credits store the business that initiated the credit.

### Point expiry

A new monthly cron job in `workers/scheduled` queries `reward_settings` for all businesses with `expiryMonths IS NOT NULL`, then soft-deletes `reward_transactions` rows for each business where `businessId = business.id AND createdAt < now - expiryMonths AND deletedAt IS NULL`. After processing each business it calls the existing `setBalance` reconciliation for affected users. The job is idempotent (skips already-deleted rows).

### Redemption rule enforcement scope

The customer-facing `POST /rewards/redeem` endpoint is **unchanged** in this feature — it uses the hardcoded global minimum. The `minRedemptionPoints` and `pointsPerRedemptionUnit` settings stored in `reward_settings` are displayed to owners in the dashboard for reference and will be enforced once the redemption endpoint becomes business-scoped (future work, out of scope here).

---

## 3. API Endpoints

All new owner endpoints require auth + business ownership (existing `team-scope` middleware).

### Reward settings

```
GET  /businesses/:businessId/rewards/settings
     Response: RewardSettings

PUT  /businesses/:businessId/rewards/settings
     Body: { pointsPerUnit, minRedemptionPoints, pointsPerRedemptionUnit, expiryMonths }
     Validation: all integers ≥ 1; expiryMonths 1–60 or null
     Response: RewardSettings (upserted)
```

### Customer rewards (owner view)

```
GET  /businesses/:businessId/rewards/customers?page=&limit=&sort=balance|name
     Response: PaginatedList<{
       userId, name, avatarUrl,
       balance, totalEarned, totalRedeemed, lastActivity
     }>
     Note: filtered to users who have at least one booking for this business

POST /businesses/:businessId/rewards/credit
     Body: { userId, points, description }
     Validation: points 1–10 000; userId must be a customer of this business
     Response: { newBalance }
     Error 403: userId has no bookings for this business
```

### Existing customer-facing endpoints (unchanged)

```
GET  /rewards/balance
GET  /rewards/history
POST /rewards/redeem
```

---

## 4. business-dashboard

### Navigation

New "Rewards" item in `Sidebar.tsx`. Route: `/rewards` → `app/(dashboard)/rewards/page.tsx` → `RewardsScreen`.

### RewardsScreen layout

Three stacked sections, all inside the existing `Card` + `PageHeader` primitives.

#### 4.1 Overview cards (top row)

Same `StatCard` pattern as `OverviewScreen`. Four cards:

- **Total points issued** — sum of all credits for this business's customers
- **Total points redeemed** — sum of all debits
- **Active holders** — customers with balance > 0
- **Redemption rate** — redeemed ÷ issued (%)

#### 4.2 Customer leaderboard

Table of customers sorted by balance (default) or name. Paginated, same style as `CustomersScreen`.

Columns: Customer, Points balance, Total earned, Total redeemed, Last activity, Actions

Each row has an **"Award points"** action that opens a modal:
- Fields: Points (1–10 000), Description (free text, default "Bonus points")
- Submit → `POST /businesses/:businessId/rewards/credit`
- On success: invalidate `rewardCustomers` query, show toast

#### 4.3 Rules panel

Collapsible card at the bottom of the page.

Fields:
- **Earning rate** — "₹ [input] per point" (pointsPerUnit)
- **Min redemption** — "[input] points minimum" (minRedemptionPoints)
- **Redemption value** — "[input] points = ₹1 discount" (pointsPerRedemptionUnit)
- **Point expiry** — select: "Never" or 1–60 months (expiryMonths)

Single **Save** button → `PUT /businesses/:businessId/rewards/settings`. Shows "Using defaults" hint on each field until first save.

### New hooks (`hooks/useOwnerData.ts`)

```ts
useRewardSettings(businessId)           // GET /businesses/:businessId/rewards/settings
useRewardCustomers(businessId, params)  // GET /businesses/:businessId/rewards/customers
useUpdateRewardSettings(businessId)     // PUT mutation
useManualCredit(businessId)             // POST mutation
```

---

## 5. owner-app

### customers.tsx

- Add **Points badge** to each customer row (e.g. "420 pts"), sourced from `useRewardCustomers`.
- Tapping a customer opens an expanded detail bottom sheet (`sheets.tsx` pattern) with:
  - Current balance, total earned, total redeemed
  - Last 10 transactions (type, points, description, date)
  - **"Award points"** button → inline form `{ points, description }` → `POST /businesses/:businessId/rewards/credit`

### business.tsx

New **"Rewards Rules"** section below existing business settings. Same 4 fields as the dashboard rules panel. Single **Save** button. Shows "Using defaults" hint until first save.

### New hooks (`hooks/useOwnerData.ts`)

Same four hooks as dashboard — `useRewardSettings`, `useRewardCustomers`, `useUpdateRewardSettings`, `useManualCredit`.

---

## 6. Error Handling & Edge Cases

| Scenario | Behaviour |
|---|---|
| Insufficient points on redeem | Existing 422 from API; customer app shows "Not enough points" |
| Manual credit out of range (< 1 or > 10 000) | Client validation before submit; API also validates with 422 |
| Settings not yet saved | All earning/redemption logic uses hardcoded defaults; UI shows "Using defaults" hint |
| Expiry cron partial failure | Soft-deletes in batches; idempotent on re-run (skips already-deleted rows) |
| Manual credit for non-customer | `POST /credit` returns 403; UI shows "This customer has no bookings at this business" |
| Zero-balance customer on leaderboard | Excluded from list (balance > 0 filter) unless no customers have points yet, in which case empty state is shown |

---

## 7. Testing

- **Unit:** `RewardsRepository` (new `getBusinessSettings`, `upsertSettings` methods), `RewardsService` (updated `creditForBooking` with business lookup, `manualCredit`)
- **Integration:** new owner endpoints (settings CRUD, customer list, manual credit) following existing two-layer test pattern in `workers/api`
- **Frontend:** adapter tests for `RewardSettings` and `RewardCustomer` view models in `business-dashboard/__tests__/adapters.test.ts`

---

## 8. Out of Scope

- Customer-facing rewards UI in `mobile-app` (separate feature)
- Rewards shown in booking confirmation emails (queue worker enhancement, separate task)
- Bulk manual credit (CSV import)
