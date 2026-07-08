# Khata / Payments Slice — Design

**Date:** 2026-06-10
**Status:** Approved (brainstorming)
**Scope:** Phase 1 commerce — the khata (due-ledger) slice that follows the merged order-flow slice. `payments` table + khata balance derivation + owner "customer dues" surface.
**Vertical:** commerce only.

## Goal

Let a commerce owner run the credit ledger ("khata"): record cash receipts against a customer, see who owes what, and void a mis-entered payment. The balance is **derived, never stored**:

```
due = Σ delivered-order totals − Σ payments    per (business, customer)
```

This completes the LPG-vendor loop (sell on credit → collect cash later) that the order-flow slice deferred.

## Context & source of truth

- The order-flow slice (`orders`, `order_items`, `customer_addresses`, status machine incl. `deliveredAt`) is **merged to `develop`** (PRs #77/#79/#80). `deliveredAt` is the seam this slice reads — only `Delivered` orders are khata debits.
- The data model for `payments` and the khata derivation are **already specified** in [docs/plan/multi-vertical-schema-design.md](../../plan/multi-vertical-schema-design.md) (`payments.schema.ts` ~line 258, "Khata (due ledger) — derivation" ~line 317). This spec scopes the slice and records implementation decisions; it does not re-derive the schema.
- Reference implementations to mirror per layer: the merged `orders` module (repository/service/routes), the `customers`/`analytics` modules (business-level owner/manager auth), and the owner-app Orders UI just shipped (commerce-only More entry → screen → sheet).

## Decisions (resolved in brainstorming)

1. **Actor scope = owner-only.** The owner records payments and sees per-customer dues. No customer-facing "my dues" surface this slice (deferred).
2. **Dues surface = a dedicated, commerce-only "Customer dues" (Khata) screen** reached from More — parallel to the Orders entry. The shared `CustomersScreen` (used by booking businesses too) stays vertical-clean.
3. **Correction = record + void (soft-delete) only.** No edit endpoint; "edit" = void + re-add. Cheap because the balance is derived and payments carry `deletedAt`.
4. **Authz = business-level owner/manager** (mirrors `customers`/`analytics`). Managers see business-wide dues (khata is business-level, not branch-attributable).
5. **Dues list = debtors only (`due > 0`).** Overpaid/credit (`due < 0`) shows in the per-customer detail but not the list.

## 1. Data layer

- **`packages/core/src/database/schema/payments.schema.ts`** — verbatim from the design doc: `business_id`, `user_id` (the customer), `amount` (`integer`, `CHECK(amount > 0)` → `payments_amount_positive`), `note?`, `recorded_by` (audit: which owner/staff), `order_id?` (`onDelete: set null`, **audit-only tag — never used in derivation**), `...timestamps()` (soft-delete `deletedAt` is how void works), index `payments_business_user_idx` on `(business_id, user_id)`. Re-export from `schema/index.ts`. Types `PaymentSelect`, `PaymentInsert`.
- **Migration `workers/api/src/database/migrations/0016_payments.sql`** — **hand-authored** additive `CREATE TABLE payments`, registered in `meta/_journal.json` (idx 16). This is a **deliberate, approved deviation** from the AGENTS schema-first Drizzle rule: `0014`/`0015` were hand-authored the same way (`0015` already has no `meta/` snapshot), so this slice stays consistent with its siblings. **Do NOT run `bun run db:generate`** for this slice — it would re-propose the data-preserving `0012` rename against the diverged snapshots. Repairing the missing snapshots (`0007/0012/0013/0015/0016`) remains a separate, deferred follow-up. **Verify** the authored SQL contains the `payments_amount_positive` CHECK and the `payments_business_user_idx` index; `bun run cli db fresh` must apply it. Add a CLI seeder for payments per [docs/guides/cli.md](../../guides/cli.md).
- **Repositories** (`packages/core/src/database/repositories/`):
  - `payments.repository.ts` — `PaymentsRepository(db)` extends `BaseRepository`. Owns payment writes (`create`, `voidPayment(id)` = set `deletedAt`) and per-customer payment history (`findByBusinessCustomer(businessId, userId)`, excludes soft-deleted). `queryAllowlist` as needed (filter `userId`; sort `createdAt`).
  - `khata.repository.ts` — `KhataRepository(db)` owns the **derived cross-table reads**: `customerDue(businessId, userId)` (the `Σ delivered − Σ payments` subtraction) and `businessDues(businessId)` (the same expression grouped by `user_id`, joined to `users` for names, filtered to `due > 0`). Kept separate from `PaymentsRepository` because it is a distinct read concern spanning `orders` + `payments`; voided payments and non-delivered orders are excluded in SQL.

## 2. API surface

Business-level, owner/manager. **`businessId` is always an explicit parameter** (query for GET, body for POST) — every route authorizes it with a **local `assertBusinessOwner(userId, businessId)` helper**, mirroring `customers`/`analytics` (each of those modules defines its own such helper; do **not** silently derive the business from the actor, since the actor→business mapping isn't 1:1). The app uses `app.use("*", authenticate, requireAuth(["owner", "manager"]))`. Mounted in `modules/routes.ts`.

### `modules/payments/` → `/api/v1/payments`
| Route | Guard | Behavior |
| --- | --- | --- |
| `POST /` | `assertBusinessOwner` on body `businessId` | Record `{ businessId, userId, amount, note?, orderId? }`. `recordedBy` = `c.var.user.id`; `amount` must be a positive integer (service validates → 422; the DB CHECK is the backstop). |
| `DELETE /:id` | `assertBusinessOwner` on the payment's `businessId` | Void (soft-delete). Load the payment (404 if missing); call `assertBusinessOwner(user.id, payment.businessId)` (403 cross-business); set `deletedAt`. |

### `modules/khata/` → `/api/v1/khata`
| Route | Guard | Behavior |
| --- | --- | --- |
| `GET /dues?businessId=` | `assertBusinessOwner` on query `businessId` | Dues list: customers with `due > 0` → `[{ userId, name, due }]`, sorted by `due` desc. |
| `GET /customers/:userId?businessId=` | `assertBusinessOwner` on query `businessId` | One customer's ledger in a single call: `{ userId, name, due, totalDelivered, totalPaid, deliveredOrders: [{ id, total, deliveredAt }], payments: [{ id, amount, note, createdAt, recordedBy }] }`. |

No `AuthorizationService` extension is needed — `assertBusinessOwner` (the local owner-resolution helper used by `customers`/`analytics`) covers both reads and the void's cross-business check. Missing resource → 404; found-but-unauthorized → 403.

## 3. api-client (`packages/api-client/src/endpoints/`)

- `payments.ts` — `record(body)`, `void(id)`, `listForCustomer(userId, { businessId })`; type `Payment`.
- `khata.ts` — `dues({ businessId })`, `customer(userId, { businessId })`; types `KhataDue` (`{ userId, name, due }`), `KhataCustomer` (the ledger detail above).
- Registered on the api-client index, mirroring `orders.ts`.

## 4. Owner-app UI (commerce-only; mirrors the merged Orders UI)

- **More entry** "Customer dues" (commerce-vertical only, via the same `OverlayId` + conditional-item pattern as Orders) → `/khata` route → **`KhataScreen`**.
- **`KhataScreen`**: `BackHeader` + a header stat (total outstanding = Σ dues) + a list of customers who owe (`name`, `money(due)`). Empty state when settled. Holds a local `const [selected, setSelected] = useState<KhataDue | null>(null)`; tapping a row sets `selected`, and `if (selected) return <KhataCustomerLedger .../>` — the **list↔ledger toggle mirrors `CustomersScreen`'s `selected` pattern** (in-component detail with its own `BackHeader onBack={() => setSelected(null)}`), not a bottom sheet, because the ledger is a multi-section scrollable view like the existing customer detail.
- **`KhataCustomerLedger`** (in-component detail view, like `CustomerDetail` in `CustomersScreen`): `BackHeader` (customer name) + `due` shown prominently, delivered orders (debits) and payments (credits) as sections, a **Record payment** button, and a **void** action per payment row (Alert-confirmed → `DELETE /payments/:id`). It loads via `useKhataCustomer(userId, businessId)`.
- **Record-payment sheet** (`SheetType.recordPayment`, in `sheets.tsx`): amount input **prefilled to the current due** (editable for a partial payment; non-negative integer, strip non-digits like `AddProductSheet`), optional note. Close-on-success; guard double-submit; on success `invalidateQueries` the khata keys.
- **Hooks** in `src/hooks/useOwnerData.ts`: `useKhataDues(businessId)`, `useKhataCustomer(userId, businessId)`, `useRecordPayment()`, `useVoidPayment()` — mutations invalidate `["khata-dues"]` and `["khata-customer", userId]`. **Adapters** in `src/lib/adapters.ts` for the DTO→VM mapping. Money via `money()`.

## 5. Testing (mirror the order-flow two-layer strategy)

- **Core/service unit tests:**
  - `PaymentsRepository`/service: record (amount > 0 enforced → 422 on ≤ 0; `recordedBy` set), void (soft-delete; excluded from history + derivation).
  - `KhataRepository`/service **derivation**: `due = Σ delivered − Σ payments`; **excludes non-`Delivered` orders**; **excludes voided payments**; dues-list grouping returns only `due > 0`, with names.
- **Route tests:** owner/manager guards (401 unauth, 403 wrong business), business-scoping, record/void/dues/ledger response shapes via `app.request()`.
- **Owner-app:** pure helpers (any due/total formatting) + `KhataScreen` render (list + empty) + record-payment sheet component test (prefill = due, submit calls the mutation), following the owner-app two-layer + RNTL conventions.

## 6. Documentation (required, same PR)

- `workers/api/CLAUDE.md` — Payments + Khata module sections.
- `docs/guides/api-endpoints.md` — new routes.
- `docs/guides/api-query-repository-pattern.md` — payments allowlist (if added).
- `docs/guides/ui-backend-sync.md` — owner khata hooks.
- `docs/plan/multi-vertical-schema-design.md` — mark the khata/payments portion of Phase 1 done.
- `apps/owner-app/AGENTS.md` — the Khata screen.

## 7. Out of scope (YAGNI)

- Customer-facing "my dues" (deferred).
- Payment **edit** (void + re-add instead).
- Per-order payment allocation / paid-unpaid per order (relationship-level by design — `order_id` on a payment is audit-only).
- Statements / receipts export, due reminders or notifications.
- Branch-level dues breakdown (khata is business-level).

## 8. Decomposition

Two implementation plans under one spec:

- **Plan A — backend + api-client:** `payments.schema` + migration `0016`, `PaymentsRepository` + `KhataRepository`, payments + khata modules with auth, api-client endpoints/types, service + route tests, seeder, docs.
- **Plan B — owner-app khata UI:** More entry + `/khata` route + `KhataScreen` + per-customer ledger + record-payment sheet + void, hooks/adapters, tests, docs.

## 9. Gates before "done" (AGENTS.md policy)

`bun run lint`, `bun run api:test`, `bun run --filter @repo/owner-app test`, `bun run build` — green on touched files vs the pre-existing baselines. After migration: grep `0016` SQL for the `amount > 0` CHECK; `bun run cli db fresh` to confirm the seeder runs. Verify completion against the codebase before reporting done.
