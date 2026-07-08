# Multi-vertical schema & migration design

Concrete Drizzle/D1 schema for [ADR-0004](../adr/0004-multi-vertical-platform-extension.md)
**Phase 0** (rename `venue → business` + `vertical`) and **Phase 1** (commerce/LPG tables +
khata). Status: **design — not yet implemented.** Grounded in the existing patterns:
`primaryID()`/`timestamps()` helpers, `text({ enum })` columns, `index`/`uniqueIndex`
builders, `$inferSelect` + `Omit<$inferInsert, …>` type exports, schema re-exported from
`packages/core/src/database/schema/index.ts`, migrations generated into
`workers/api/src/database/migrations` (latest `0011`).

---

## Phase 0 — `venue → business` rename (data-preserving)

### DB-level surface (exhaustive)

Tables renamed: `venues → businesses`, `venue_photos → business_photos`.
Columns renamed `venue_id → business_id` on **8** tables:
`branches`, `coupons`, `campaigns`, `reviews`, `team_members`, `favourites`,
`notifications` (nullable), `business_photos`.
New columns: `businesses.vertical` (immutable enum), `branches.area` (delivery granularity).

### Schema file changes (`packages/core/src/database/schema/`)

- Rename file `venues.schema.ts → businesses.schema.ts`; `venuesSchema → businessesSchema`,
  `venuePhotosSchema → businessPhotosSchema`; table names `"venues"/"venue_photos"` →
  `"businesses"/"business_photos"`; add the `vertical` column + index; rename type exports
  (`VenueSelect → BusinessSelect`, etc.) and update `schema/index.ts`.
- In the 8 child schema files: `venueId: text("venue_id")` → `businessId: text("business_id")`,
  repoint `.references(() => businessesSchema.id)`, and rename the `*_venue_id_idx` indexes →
  `*_business_id_idx` (and `coupons_venue_code_unique → coupons_business_code_unique`).
- `branches.schema.ts`: add `area: text()` (nullable) + index `branches_area_idx`.

```ts
// businesses.schema.ts (was venues.schema.ts) — added column only; rest unchanged
export const BusinessVertical = { BOOKING: "booking", COMMERCE: "commerce" } as const;
export type BusinessVerticalType = (typeof BusinessVertical)[keyof typeof BusinessVertical];

export const businessesSchema = sqliteTable("businesses", {
  ...primaryID(),
  name: text().notNull(),
  category: text().notNull(),                       // sub-label WITHIN a vertical
  city: text().notNull(),
  vertical: text({ enum: ["booking", "commerce"] }) // immutable (app-enforced)
    .notNull().default("booking"),
  status: text({ enum: ["Draft", "Active", "Suspended"] }).notNull().default("Draft"),
  description: text(), phone: text(), email: text(), website: text(),
  ownerId: text("owner_id").notNull().references(() => usersSchema.id, { onDelete: "cascade" }),
  ...timestamps(),
}, (t) => [
  index("businesses_owner_id_idx").on(t.ownerId),
  index("businesses_status_idx").on(t.status),
  index("businesses_city_idx").on(t.city),
  index("businesses_vertical_idx").on(t.vertical),  // marketplace: filter by vertical
]);
```

> **`vertical` immutability AND its default are app-enforced.** Two app-layer rules, both
> pinned by a service test:
> 1. *Immutable* — the repository's update path omits `vertical` from the updatable column
>    set (same way `ownerId` is omitted on venue update today).
> 2. *No silent default on create* — `DEFAULT 'booking'` exists only to backfill existing
>    rows in migration `0012`. As a permanent default it's the same footgun as
>    `DEFAULT_SIGN_IN_SOURCE` in [ADR-0002](../adr/0002-per-role-accounts-via-sign-in-source.md):
>    a commerce business created without an explicit `vertical` would silently become
>    `booking`. SQLite can't drop a column default without a table rebuild, so the repository
>    **insert** path must *require* an explicit `vertical` rather than rely on the DB default.

### Migration `0012` — the critical, data-preserving part

**Risk:** `drizzle-kit generate` diffs the schema and, if it does **not** recognise the
rename, emits `DROP TABLE venues; CREATE TABLE businesses;` — **data loss.** SQLite *does*
support in-place rename, so the migration must use `ALTER … RENAME`:

```sql
-- 0012_business_rename.sql  (verify this is what drizzle-kit produced; hand-author if not)
ALTER TABLE venues        RENAME TO businesses;
ALTER TABLE venue_photos  RENAME TO business_photos;

ALTER TABLE business_photos RENAME COLUMN venue_id TO business_id;
ALTER TABLE branches        RENAME COLUMN venue_id TO business_id;
ALTER TABLE coupons         RENAME COLUMN venue_id TO business_id;
ALTER TABLE campaigns       RENAME COLUMN venue_id TO business_id;
ALTER TABLE reviews         RENAME COLUMN venue_id TO business_id;
ALTER TABLE team_members    RENAME COLUMN venue_id TO business_id;
ALTER TABLE favourites      RENAME COLUMN venue_id TO business_id;
ALTER TABLE notifications   RENAME COLUMN venue_id TO business_id;

ALTER TABLE businesses ADD COLUMN vertical TEXT NOT NULL DEFAULT 'booking';
ALTER TABLE branches   ADD COLUMN area TEXT;

-- Index renames (SQLite keeps old index names through a table rename; recreate for parity
-- with the drizzle schema's new names). Repeat the drop/create for each *_venue_id_idx.
DROP INDEX IF EXISTS branches_venue_id_idx;  CREATE INDEX branches_business_id_idx ON branches(business_id);
-- … coupons / campaigns / reviews / team_members / favourites / notifications / business_photos …
CREATE INDEX branches_area_idx ON branches(area);
```

**Notes that make this safe:**
- Modern SQLite (D1) auto-rewrites child **FK references** when the parent table is renamed
  (`legacy_alter_table` is off by default) — `branches.business_id` will point at
  `businesses` with no extra work. *Verify with `PRAGMA foreign_key_check;` after applying.*
- `ADD COLUMN … NOT NULL DEFAULT 'booking'` backfills every existing row to `booking` in one
  statement — exactly the intended backfill.
- **Procedure — interactive generate is the primary path, not just for the SQL:** edit the
  schema `.ts` files first, then run `bun run db:generate` (from `workers/api`) **in an
  interactive terminal** and answer the "is X renamed to Y?" prompts. This is preferred
  because it keeps the generated SQL **and** the drizzle snapshot
  (`migrations/meta/XXXX_snapshot.json`) consistent in one step. Open the generated SQL and
  confirm it is `ALTER … RENAME`, **not** drop/create, before applying.
- **Hand-author only as a fallback, and patch the snapshot too.** Drizzle diffs the *next*
  migration against `meta/XXXX_snapshot.json`, not `_journal.json`. If you hand-write the
  rename SQL and only append to `_journal.json`, the next `db:generate` still sees `venues`
  in the stale snapshot and **re-proposes the rename**. So a hand-authored `0012` must also
  ship a regenerated/edited snapshot reflecting the renamed tables/columns — otherwise the
  migration chain is broken.

### Code rename (outside the DB, same PR series)

`venueId → businessId`, `assertVenueOwner → assertBusinessOwner`, repositories/services,
api-client method names, KV cache key `venue:<id> → business:<id>`, the search module's
`Active venues` query, and all 4 frontends. This is the ~2,880-site mechanical diff from the
ADR — land it with a full `bun run lint && bun run test && bun run build` pass, decoupled
from any LPG work.

---

## Phase 1 — commerce (LPG) tables

> **Status (2026-06-10):** The khata/payments portion of Phase 1 is **IMPLEMENTED**. Migration `0016` (`0016_payments.sql`) adds the `payments` table. `PaymentsRepository` (create, findOne, voidPayment, findByBusinessCustomer), `KhataRepository` (customerDue derivation via `Σ delivered-order totals − Σ payments`, businessDues, deliveredOrders), `PaymentsService`, and `KhataService` are live at `/api/v1/payments` and `/api/v1/khata`. `api-client` endpoint groups `payments` + `khata` are also shipped. **Remaining:** owner-app UI (Khata screen, record/void payment flows) — a follow-up task. The `payments.schema.ts` design below matches the shipped schema.
>
> **Earlier status (order-flow, migration 0014):** `customer_addresses`, `orders`, and `order_items` tables; `OrdersRepository`, `CustomerAddressesRepository`, `OrdersService`, `CustomerAddressesService` live at `/api/v1/orders` and `/api/v1/customer-addresses`; `api-client` endpoint groups `orders` + `customerAddresses` shipped.



Five new tables, all **additive** (pure `CREATE TABLE`, no risk to booking). Migration
`0013`. Each follows the house style (`primaryID`, `timestamps`, enums, `$inferSelect` /
`Omit` types) and is re-exported from `schema/index.ts`.

```
businesses (vertical='commerce')
  └─ branches (area, lat/lng)
       └─ products (stock, price)            ← stock tracked per branch
orders (business_id, branch_id, user_id, status, total, delivery snapshot)
  └─ order_items (product_id, quantity, unit_price)   ← multi-line cart
payments (business_id, user_id, amount)      ← cash receipts = khata credits
customer_addresses (user_id, …)              ← address book (order snapshots it)
```

### `products.schema.ts` — stock per branch, DB-guarded

```ts
import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { primaryID, timestamps } from "../helpers";
import { branchesSchema } from "./branches.schema";

export const ProductStatus = { ACTIVE: "Active", INACTIVE: "Inactive" } as const;
export type ProductStatusType = (typeof ProductStatus)[keyof typeof ProductStatus];

export const productsSchema = sqliteTable("products", {
  ...primaryID(),
  branchId: text("branch_id").notNull().references(() => branchesSchema.id, { onDelete: "cascade" }),
  name: text().notNull(),
  category: text(),
  price: integer().notNull(),                  // smallest currency unit (paisa)
  stock: integer().notNull().default(0),
  description: text(),
  imageUrl: text("image_url"),
  status: text({ enum: ["Active", "Inactive"] }).notNull().default("Active"),
  ...timestamps(),
}, (t) => [
  index("products_branch_id_idx").on(t.branchId),
  check("products_stock_nonneg", sql`${t.stock} >= 0`),   // ← the commerce invariant, at the DB
]);

export type ProductSelect = typeof productsSchema.$inferSelect;
export type ProductInsert = Omit<typeof productsSchema.$inferInsert, "id" | "createdAt" | "updatedAt" | "deletedAt">;
```

> **Stock-at-branch trade-off:** a 2-depot seller defines the same product twice (one row
> per branch). Acceptable for the small-seller MVP; if multi-branch sellers become common,
> normalise into `products` (catalog, business-level) + `branch_inventory(product_id,
> branch_id, stock)` — a later, isolated migration.

### `orders.schema.ts` — status machine + address snapshot

```ts
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { primaryID, timestamps } from "../helpers";
import { businessesSchema } from "./businesses.schema";
import { branchesSchema } from "./branches.schema";
import { usersSchema } from "./users.schema";

export const OrderStatus = {
  PENDING: "Pending", CONFIRMED: "Confirmed", OUT_FOR_DELIVERY: "OutForDelivery",
  DELIVERED: "Delivered", CANCELLED: "Cancelled",
} as const;
export type OrderStatusType = (typeof OrderStatus)[keyof typeof OrderStatus];

export const ordersSchema = sqliteTable("orders", {
  ...primaryID(),
  businessId: text("business_id").notNull().references(() => businessesSchema.id), // denormalised — see note
  branchId: text("branch_id").notNull().references(() => branchesSchema.id),        // fulfilling depot
  userId: text("user_id").notNull().references(() => usersSchema.id),               // customer
  status: text({ enum: ["Pending", "Confirmed", "OutForDelivery", "Delivered", "Cancelled"] })
    .notNull().default("Pending"),
  total: integer().notNull(),                  // snapshot Σ(quantity × unit_price)
  deliveryLine: text("delivery_line").notNull(),   // address SNAPSHOT (survives address edits/deletes)
  deliveryArea: text("delivery_area"),
  deliveryCity: text("delivery_city"),
  deliveryLat: real("delivery_lat"),
  deliveryLng: real("delivery_lng"),
  deliveredAt: text("delivered_at"),           // set when status → Delivered
  ...timestamps(),
}, (t) => [
  index("orders_business_id_idx").on(t.businessId),
  index("orders_branch_id_idx").on(t.branchId),
  index("orders_user_id_idx").on(t.userId),
  index("orders_status_idx").on(t.status),
  index("orders_business_user_idx").on(t.businessId, t.userId),  // khata debit aggregation
]);

export type OrderSelect = typeof ordersSchema.$inferSelect;
export type OrderInsert = Omit<typeof ordersSchema.$inferInsert, "id" | "createdAt" | "updatedAt" | "deletedAt">;
```

> **Why `business_id` on `orders` (a denormalisation vs the booking pattern, which derives
> venue via branch):** the khata balance aggregates *delivered order totals per
> `(business, customer)`* — a hot, core query. Storing `business_id` keeps it index-only
> (`orders_business_user_idx`) with no join. The cost: `order.business_id` must equal
> `branch.business_id`; enforce at the service layer on creation (it never changes after).

### `order_items.schema.ts` — multi-line cart

```ts
import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { primaryID, timestamps } from "../helpers";
import { ordersSchema } from "./orders.schema";
import { productsSchema } from "./products.schema";

export const orderItemsSchema = sqliteTable("order_items", {
  ...primaryID(),
  orderId: text("order_id").notNull().references(() => ordersSchema.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => productsSchema.id),
  quantity: integer().notNull(),
  unitPrice: integer("unit_price").notNull(),  // SNAPSHOT of product.price at order time
  ...timestamps(),
}, (t) => [
  index("order_items_order_id_idx").on(t.orderId),
  index("order_items_product_id_idx").on(t.productId),
  check("order_items_qty_positive", sql`${t.quantity} > 0`),
]);

export type OrderItemSelect = typeof orderItemsSchema.$inferSelect;
export type OrderItemInsert = Omit<typeof orderItemsSchema.$inferInsert, "id" | "createdAt" | "updatedAt" | "deletedAt">;
```

### `payments.schema.ts` — cash receipts (khata credits)

```ts
import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { primaryID, timestamps } from "../helpers";
import { businessesSchema } from "./businesses.schema";
import { usersSchema } from "./users.schema";
import { ordersSchema } from "./orders.schema";

export const paymentsSchema = sqliteTable("payments", {
  ...primaryID(),
  businessId: text("business_id").notNull().references(() => businessesSchema.id),
  userId: text("user_id").notNull().references(() => usersSchema.id),         // customer whose khata
  amount: integer().notNull(),                 // cash received (a credit)
  note: text(),
  recordedBy: text("recorded_by").notNull().references(() => usersSchema.id), // audit: which owner/staff
  orderId: text("order_id").references(() => ordersSchema.id, { onDelete: "set null" }), // optional tag
  ...timestamps(),
}, (t) => [
  index("payments_business_user_idx").on(t.businessId, t.userId),            // khata credit aggregation
  check("payments_amount_positive", sql`${t.amount} > 0`),
]);

export type PaymentSelect = typeof paymentsSchema.$inferSelect;
export type PaymentInsert = Omit<typeof paymentsSchema.$inferInsert, "id" | "createdAt" | "updatedAt" | "deletedAt">;
```

> **`orderId` is audit-only** — an optional "this receipt happened around order X" tag for
> the owner's reference. It is **never** used in the khata balance derivation (which is
> relationship-level: Σ delivered orders − Σ payments). Do not let later code treat it as
> per-order payment allocation.

### `customer-addresses.schema.ts` — address book

```ts
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { primaryID, timestamps } from "../helpers";
import { usersSchema } from "./users.schema";

export const customerAddressesSchema = sqliteTable("customer_addresses", {
  ...primaryID(),
  userId: text("user_id").notNull().references(() => usersSchema.id, { onDelete: "cascade" }),
  label: text(),                               // "Home", "Office"
  line: text().notNull(),
  area: text(),
  city: text(),
  lat: real(),
  lng: real(),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  ...timestamps(),
}, (t) => [index("customer_addresses_user_id_idx").on(t.userId)]);

export type CustomerAddressSelect = typeof customerAddressesSchema.$inferSelect;
export type CustomerAddressInsert = Omit<typeof customerAddressesSchema.$inferInsert, "id" | "createdAt" | "updatedAt" | "deletedAt">;
```

---

## Khata (due ledger) — derivation, not a stored balance

No `balance` column. **Due = Σ delivered-order totals − Σ payments**, per `(business, customer)`:

```sql
SELECT
  (SELECT COALESCE(SUM(total), 0)  FROM orders
     WHERE business_id = ?1 AND user_id = ?2 AND status = 'Delivered')
  -
  (SELECT COALESCE(SUM(amount), 0) FROM payments
     WHERE business_id = ?1 AND user_id = ?2)
  AS due;
```

Both legs are index-only (`orders_business_user_idx`, `payments_business_user_idx`). Owner
"customer dues" list = same expression grouped by `user_id` for the business. Per-order
paid/unpaid is intentionally not modelled (installments are relationship-level).

---

## The commerce invariant in code (D1-native)

D1 has **no interactive transactions** — use atomic `db.batch()`. Per the
[D1 docs](https://developers.cloudflare.com/d1/worker-api/d1-database/): *"Batched statements
are SQL transactions. If a statement in the sequence fails… it aborts or rolls back the
entire sequence."* The `CHECK(stock >= 0)` constraint is what makes oversell impossible under
a race: an unconditional decrement that would go negative **violates the constraint and
aborts the whole batch**, so no order row and no partial decrement survive.

> **A `WHERE stock >= qty` conditional is the trap, not the fix:** under a race the losing
> decrement matches 0 rows but the batch still *commits* — silent oversell. Rely on the
> unconditional decrement + `CHECK`; the constraint violation is what aborts the batch.

```ts
// place order — atomic: decrements + order + items in one batch
const order = { id: crypto.randomUUID(), businessId, branchId, userId, status: "Pending", total, ...addr };
await db.batch([
  ...items.map((it) =>
    db.update(productsSchema)
      .set({ stock: sql`${productsSchema.stock} - ${it.quantity}` })
      .where(eq(productsSchema.id, it.productId))),          // CHECK(stock>=0) aborts batch on oversell
  db.insert(ordersSchema).values(order),
  ...items.map((it) =>
    db.insert(orderItemsSchema).values({ orderId: order.id, productId: it.productId, quantity: it.quantity, unitPrice: it.unitPrice })),
]);
// Pre-read stock first for a friendly "out of stock" message; the CHECK is the race-safe backstop.
```

> **Map the CHECK violation to a 4xx, or races become 500s.** The losing order throws a raw
> SQLite constraint error from `batch()`. The service must catch it and return a
> `ConflictError` (409) / `ValidationError` (422) "out of stock" — otherwise a normal stock
> race surfaces to the customer as an internal-error 500.

**Cancellation** (`Pending`/`Confirmed` only) restores stock in the same all-or-nothing
shape — batch the per-line `stock = stock + quantity` updates with the `status = 'Cancelled'`
update. **Delivery** (`status = 'Delivered'`, set `deliveredAt`) is the point the order
becomes a khata debit.

---

## Module & repository plan (`workers/api` + `packages/core`)

Mirror the existing module layout; use the **`add-module`** skill to scaffold each. New
repositories in `packages/core/src/database/repositories/` (constructor takes `db: DbClient`,
delegates to `BaseRepository`): `products`, `orders` (+ `order_items`), `payments`,
`customer-addresses`. New API module `workers/api/src/modules/commerce/` exposing
`commerceApp` + `installCommerceService`, mounted in
[`modules/routes.ts`](../../workers/api/src/modules/routes.ts) at `/v1/commerce` (or
`/v1/products`, `/v1/orders`). Ownership: extend `AuthorizationService` with
`assertProductOwner` / `assertOrderOwner` chaining `product → branch → business.ownerId`.

---

## Migration sequence & commands

| # | Migration | Kind | Risk |
| --- | --- | --- | --- |
| `0012` | Phase 0 rename (`venue → business`, `vertical`, `branch.area`) | `ALTER … RENAME` | **High** — verify rename, not drop/create |
| `0013` | Phase 1 commerce (`products`, `orders`, `order_items`, `payments`, `customer_addresses`) | `CREATE TABLE` | Low — additive |

```sh
# from workers/api, interactive terminal (rename prompts), per migration:
bun run db:generate         # edit schema .ts first; confirm 0012 emits ALTER…RENAME
# review the generated SQL, then apply via the project's migrate path (tools/cli / wrangler d1)
bun run lint && bun run test && bun run build
```

> **Status (2026-06-09):** `0012_business_rename.sql` is **hand-authored and verified** — the
> full API suite replays it and passes **366/386** (the 20 failures are the pre-existing
> `clearAllMocks`/constructor-mock quirk in the inline-repo modules, identical to baseline;
> zero rename-induced failures). Journal-registered, deploy-applicable via `drizzle migrate`.
> **Status (2026-06-10):** Missing snapshots (`0007`, `0012`, `0013`, `0014`) are backfilled.
> Run `bun run workers/api/scripts/backfill-migration-snapshots.ts` to regenerate them from
> the SQL chain; then `bunx drizzle-kit check` and `bun run db:generate` should report no
> pending changes.

**Verify on generation (these are the load-bearing checks):**
- After `0012`: `PRAGMA foreign_key_check;` returns no rows; re-seed (`bun run cli db fresh`)
  to confirm seeders still run under the new names.
- After `0013`: **grep the generated SQL for `CHECK (stock >= 0)`** (and the qty/amount
  checks). `check()` is supported in the installed `drizzle-orm@0.45.2`, but there is **no
  CHECK precedent** in the existing migrations — if `drizzle-kit@0.31` omits it from the
  DDL, the commerce invariant silently evaporates and single-threaded tests still pass. If
  it's missing, add the `CHECK` clause to the migration SQL by hand.

---

## Open risks / revisit later

- **Rename detection** is the one genuinely dangerous step — the data-loss path is real if
  drizzle drops/creates. The ALTER SQL above is the source of truth to verify against.
- **Stock model** (`products.stock` per branch) → revisit as catalog + `branch_inventory`
  only when multi-branch sellers appear.
- **`orders.business_id` denormalisation** must be kept consistent with `branch.business_id`
  at the service layer (it never changes post-creation).
- **`vertical` immutability** is app-enforced; add a service test that pins it.
