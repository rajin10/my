# Extending Talash to multiple business verticals

- **Status:** proposed
- **Date:** 2026-06-08
- **Deciders:** Hasib (platform owner) — needs sign-off before Phase 0 rename work
- **Scope:** `packages/core` schema + repositories, `workers/api` module layout; downstream impact on all four clients and a likely new client

## Context

Talash today is a **booking platform** for salons, spas, and similar appointment-based
wellness businesses. The domain model is booking-shaped end to end:

```
users (role) ──owns──> venues ──> branches ──> services
                                      │            │
                              branch_hours    bookings (user + service + branch + staff + slot)
                                      │            │
                              team_members   staff_availability
```

The tenant boundary **is the `venue`**: `venues.ownerId`, `team_members.venueId`,
and every booking artifact hangs off it. The core invariant is slot reservation —
`bookings` carries a partial unique index on `(branch, service, slot)` to prevent
double-booking.

We want to add unrelated verticals — first a **local LPG (cooking gas) business with
delivery**, and others later. LPG is not an appointment: there is no "venue" to visit,
no time-slot to reserve, no staff member assigned. It is **order a physical product →
fulfil by delivery** — a commerce model with a different core invariant (stock decrement,
not slot uniqueness), and a credit/cash settlement culture rather than at-venue payment.

The decision in front of us is narrow and concrete: **how does vertical #2 attach to the
platform without (a) forking the codebase or (b) prematurely genericising working booking
code into an abstraction we can't yet validate.** With only one live vertical, any generic
"business / offering / order" model is a guess. So the broader "become a platform" goal is
deliberately *sequenced and partly deferred* in this ADR, not designed up front.

> **Resolved scope (2026-06-08).** The first LPG release is **commerce-only**: catalog,
> stock, order placement, payment (incl. cash-on-delivery), and **manual fulfilment** —
> the owner advances an order's status by hand (`Confirmed → Out for delivery → Delivered`).
> **Delivery logistics is explicitly deferred** to a later phase: no driver entity, no
> driver app, no dispatch, no live tracking in the MVP. The order status field is the seam
> where the driver app plugs in later. This keeps the MVP to ~1 new bounded context while
> still validating the whole "second vertical attaches to the platform" thesis.

## Decision

Adopt a **shared platform core with per-vertical bounded contexts**, introduced in
sequenced phases ordered cheap → reversible → non-breaking. Concretely:

1. **Rename `venue` → `business` across the whole stack, and add a `vertical`
   discriminator — *before* any LPG code is written (decided 2026-06-08, option A
   "rename-first").** `venue` is already ~95% a generic business: every column
   (`name, category, city, status, description, phone/email/website, ownerId`) is a
   generic business attribute; the booking-specificity lives only in the **children**
   (`branches`, `branch_hours`, `services`, `bookings`, `staff_availability`). So this is
   a **rename + one new column**, not a re-model. `businesses(id, ownerId, vertical, …)`
   becomes the tenant root; `vertical` is set at creation and **immutable**
   (`booking` for every backfilled row). The booking children keep chaining ownership
   exactly as today (`venueId → businessId`; `assertVenueOwner → assertBusinessOwner`).
   Chosen over an additive `business` root because the rename and the new vertical are
   independent changes — doing the rename first keeps LPG on clean names from day one,
   avoids carrying dual vocabulary, and the rename is strictly cheaper now (~2,880 sites)
   than after LPG adds more. The cost is a wide, regression-prone but mechanical diff
   (1,314 API refs, ~1,300 across 4 frontends, KV cache keys `venue:<id>`, the search
   module's "Active venues", api-client method names) landed as its own PR series with its
   own test pass, **decoupled from** "does gas selling work?".

2. **Each vertical gets its own tables and its own API module.** Commerce (LPG) gets
   `products` (sellable physical good: stock + price) and `orders` (customer buys products
   for delivery) — **not** a polymorphic reuse of `services`/`bookings`. A `service` is a
   bookable, time-slotted offering (duration + slot); a `product` is stock-decremented and
   delivered — different invariants. Forcing them into one table (or an EAV "god-spine")
   buys a fake abstraction and loses both sets of constraints at the DB layer. The
   existing `serviceInstallers` + `apiRoutes.route("/v1/…", app)` pattern in
   [`modules/routes.ts`](../../workers/api/src/modules/routes.ts) already mounts modules
   side by side cleanly — a `commerceApp` slots in next to `bookingsApp`.

   **Order shape:** an order is a **multi-line cart** — `order → order_items(productId,
   qty, unitPrice)`; `unitPrice` is snapshotted per line so history survives price changes.

   **Commerce invariant (the reason for table-per-vertical):** stock must never go negative
   under concurrent orders. Enforced at the DB with an atomic conditional decrement
   **per line item** (`UPDATE products SET stock = stock - :qty WHERE stock >= :qty`, or a
   CHECK constraint), all lines in one transaction — if any line fails, the order fails.
   This is the commerce analog of the booking `bookings_active_slot_unique` index. Stock
   decrements **at order placement** (cash, so placed = committed); cancellation from
   `Pending`/`Confirmed` restores it (no cancellation after `Out for delivery`). **Order status machine:** `Pending → Confirmed → Out for delivery
   → Delivered`, `Cancelled` from `Pending`/`Confirmed`; owner advances by hand (manual
   fulfilment). The `Out for delivery → Delivered` step is the seam the deferred driver app
   plugs into.

   **Cash due-ledger (khata) — commerce-only.** LPG sellers commonly sell on credit: the
   customer takes cylinders now and pays later in installments. Modelled as a per-customer
   running balance **scoped to `(business, customer)`**: each **delivered order is a
   debit** (its total), each **cash receipt is a credit** (a small `payments` table —
   cash only, no provider). **Due = Σ delivered-order totals − Σ payments.** Owner records
   cash receipts and sees each customer's outstanding balance; the customer sees their own
   due. Per-order paid/unpaid status is *not* tracked (installments are against the
   relationship, not an order); derive it later via oldest-first allocation only if needed.
   This is commerce-scoped, **not kernel** — booking does not use it. **Credit is
   implicit**: no checkout "pay later" toggle or formal credit limit in v1 — the owner
   controls credit by how much cash they record at delivery. A **saved address book**
   (per customer, commerce-scoped) backs reorders; each order **snapshots** the chosen
   address so history stays accurate if the address is later edited/deleted.

3. **Grow the shared kernel reactively, from observed duplication.** Auth (already
   per-role, see [ADR-0002](0002-per-role-accounts-via-sign-in-source.md)), `users`,
   `notifications`, `reviews`, media/R2, geo, and the search shell are the proven-shared
   surfaces. Extract a concern into the kernel **when the second vertical actually
   duplicates it**, not speculatively. **No payment kernel:** the MVP is **cash-only** —
   no payment provider, no online integration, no shared `payments` table. Money is handled
   per-vertical (booking is pay-at-venue; commerce uses a cash due-ledger, below). A
   payment kernel is deferred until a second vertical actually needs online payment.

4. **Clients are vertical-aware via a `vertical` switch, not scattered conditionals.** All
   four apps stay; each becomes vertical-aware. The API returns a per-business `vertical`
   enum (`booking` | `commerce`); each frontend selects a **per-vertical feature module**
   from a registry (`vertical → experience`) — the public apps (`mobile-app`,
   `marketing-site`) render the right *customer* experience (services + slots + booking vs
   products + cart + order); the business apps (`owner-app`, `business-dashboard`) render
   the right *management* experience. This mirrors the backend's bounded contexts — one
   seam, not `if (vertical === …)` sprinkled through screens. A `vertical` enum is the only
   switch for the MVP; an additive `capabilities[]` descriptor (per-business toggles for
   cross-cutting features like reviews/rewards) is **deferred** until a feature genuinely
   needs to be optional per business. Customers keep **one shared `user` account** across
   verticals (same `source = mobile-app → user`).

The booking domain (`branches`, `services`, `bookings`, `team_members`,
`staff_availability`, `branch_hours`) is **renamed at the parent FK level
(`venueId → businessId`) and otherwise left intact**. No rewrite of working logic — only
identifier renames.

## Domain language

Canonical terms for this decision (agreed 2026-06-08). These protect the existing precise
booking terms from being overloaded by the new vertical:

| Term | Meaning | Replaces / avoid |
| --- | --- | --- |
| **Business** | The tenant — a commercial entity owned by one owner, operating in exactly **one** vertical. | replaces `venue` |
| **Vertical** | The kind of business: `booking` (salon/spa) or `commerce` (LPG). Set at creation, **immutable**. | "type"; `category` stays a sub-label *within* a vertical |
| **Business owner** | The `user` (role `owner`) who owns a business. | "venue owner" |
| **Branch** | A physical location/outlet of a business (address + `area` + `city` + `lat/lng`). **Vertical-neutral** — a salon branch or an LPG depot. Per-vertical detail (hours, staff, services / products, stock) hangs off it. `area` (neighbourhood) drives commerce delivery matching. | not booking-only |
| **Service** | A bookable, time-slotted offering (duration + price, reserved via a slot). **Booking vertical only.** | do **not** generalise to mean "product" |
| **Product** | A sellable physical good with **stock tracked per branch** + price. **Commerce vertical only.** | "service", "item" |
| **Booking** | A customer reserving a service slot. | — |
| **Order** | A customer buying products for delivery. | "booking" for commerce |
| **Khata (due ledger)** | A customer's running cash balance with one business: Σ delivered-order totals − Σ payments. **Commerce vertical only.** | "invoice", "account" (overloaded) |
| **Payment** | A recorded **cash** receipt (credit) against a customer's khata. No payment provider/online integration in the MVP. | not a provider transaction |

"Offering" is the umbrella *concept* ("what a business sells") — useful in prose, but
**not a shared table**. One business = exactly one vertical; an owner who runs a salon
*and* sells gas creates two businesses (mirrors per-role accounts in
[ADR-0002](0002-per-role-accounts-via-sign-in-source.md)).

## Options considered

### Option A — Generalise the core into a polymorphic domain

Rename `venues → businesses`, `services → offerings`, `bookings → orders`; a `type`
column + JSON/EAV attributes express each vertical.

| Dimension | Assessment |
| --- | --- |
| Complexity | High — every query branches on type; constraints move from DB to app |
| Cost | High up front, before vertical #2 validates the abstraction |
| Scalability | Poor — EAV defeats indexing; the double-booking unique index can't survive |
| Team familiarity | Low — bespoke polymorphism, hard to reason about |

**Pros:** one code path; feels DRY. **Cons:** designs the abstraction with a sample size
of one; loses per-vertical DB invariants; the classic platform-too-early trap.

### Option B — Shared core + per-vertical bounded contexts *(chosen)*

Thin shared tenant/kernel; each vertical owns its tables and module.

| Dimension | Assessment |
| --- | --- |
| Complexity | Medium — one new tenant abstraction; verticals stay independent |
| Cost | Low/incremental — booking code reparented, not rewritten |
| Scalability | Good — each vertical keeps its own indexes and invariants |
| Team familiarity | High — mirrors the existing module-per-domain layout |

**Pros:** non-breaking; verticals evolve independently; abstraction is extracted from real
duplication, not guessed. **Cons:** some near-term duplication across verticals before the
kernel is extracted; two booking/commerce models to maintain.

### Option C — Separate worker/app per vertical (polyrepo-ish)

A new API worker + apps per vertical, sharing only infra and maybe auth.

| Dimension | Assessment |
| --- | --- |
| Complexity | Low per service, high across the fleet |
| Cost | High — duplicated auth, payments, notifications, deploy pipelines |
| Scalability | Fine technically; poor for shared customer identity & cross-sell |
| Team familiarity | Medium |

**Pros:** maximum isolation. **Cons:** no shared customer identity or unified app;
duplicated kernel; defeats the point of one platform. Reasonable only if verticals must be
sold/operated as fully separate products.

### Option D — Fork the codebase for LPG

Clone the repo, hack it into a delivery app.

**Pros:** fastest to a demo. **Cons:** two diverging codebases, doubled maintenance, no
shared identity — rejected outright as a strategy (acceptable only as a throwaway spike).

### Explicitly rejected heavyweight alternatives

Considered and rejected during the 2026-06-08 design review (recorded so they are not
re-opened). **The decisive fact is that Talash is a marketplace: the core read path is
cross-business discovery** (search all salons in a city, list all LPG sellers nearby).

- **Tenant-per-database** (one D1 per business). Rejected. Each D1 is an independent
  SQLite database — **you cannot JOIN across them**, so marketplace search would require
  fanning out across N databases and merging/ranking in app code, then building a separate
  cross-tenant index anyway. Tenant-per-DB fits *siloed B2B SaaS* where tenant data is
  never cross-queried; Talash is the opposite. **Shared D1 + `business_id` scoping +
  existing indexes is correct.**
- **Generic / schema-driven domain** (EAV or JSON-blob `products`/`services`/`orders`
  configured at runtime). Rejected — same family as Option A. It *increases* complexity:
  every query branches at runtime, indexes die, and DB-enforced invariants (double-booking
  unique index; stock decrement) collapse into fragile app code. The goal is **generic at
  the platform layer** (one tenant model + pluggable modules), **not generic at the domain
  layer**. A little per-vertical code is the price of correctness and type-safety.
- **Microservices** (split the API into per-domain services). Rejected *now*, **reversible
  later**. Conflates *data isolation* with *compute separation*. Compute is already split
  along the right axis — `api` / `queue` / `scheduled` (HTTP / async / cron). Splitting the
  API along domain lines turns in-process calls (ownership + stock + payment in one order)
  into network hops with distributed-transaction cost, for a solo maintainer, with no
  scaling driver (Workers scale per-request automatically). Microservices solve *team*
  scaling, which does not yet apply. Any module can later be promoted to its own Worker via
  service bindings — today's modular monolith does not block that.

## Trade-off analysis

The real axis is **when to pay for the abstraction**. Option A pays now, before there's
enough information to design it right (one vertical = no signal). Options C/D never pay it
and eat duplication forever. **Option B defers the abstraction to the moment of evidence**:
add only the tenant root now (unavoidable — every vertical needs an owner), keep verticals
in separate well-bounded tables, and let the shared kernel crystallise from duplication
that actually appears once LPG ships. This matches the house pattern of deferring
generalisation until a concrete need (the YAGNI deferrals in
[ADR-0002](0002-per-role-accounts-via-sign-in-source.md)).

The key discipline: **table-per-vertical, not a god-table.** Slot-based booking and
stock-based commerce have incompatible integrity rules; keeping them in separate tables
preserves DB-enforced invariants for both.

## Consequences

**Becomes easier**
- Adding vertical #3 follows a worn path: new tenant `vertical` value + new module + new
  tables, mounted in `routes.ts`. No core rewrite.
- **Each vertical owns its own owner money/reporting surface** (per-vertical, not kernel):
  booking = earnings by staff/service/branch/over-time (extends the existing `analytics`
  module; per-staff is free — `bookings` already carries `staffId` + `price`); commerce =
  sales + outstanding khata dues. The business apps render the right one by `vertical`.
- Verticals deploy and evolve independently; a commerce change can't break booking
  invariants.
- Shared customer identity and notifications carry across verticals (cross-sell, one login).

**Becomes harder / new work**
- **Delivery is logistics, not a booking variant.** It introduces drivers, dispatch,
  routing, live tracking, and proof-of-delivery — plausibly a **fifth client (a driver
  app)** and background workers for dispatch. Treat it as a new capability axis, budget it
  as such; do not scope it as "another booking type."
- **Cash-only, but with a credit ledger.** No payment provider in the MVP (booking stays
  pay-at-venue; commerce is cash). But LPG's credit culture means commerce needs a
  **per-customer due-ledger (khata)** — orders as debits, cash receipts as credits — plus
  owner-side balance management and a customer-facing due view. A payment-provider kernel is
  deferred entirely until a vertical actually needs online payment.
- **Customer app shape — resolved: one marketplace, four apps stay.** The existing
  `mobile-app`/`marketing-site` become vertical-aware (browse salons *and* order gas under
  one shared `user`), rather than spawning a separate LPG consumer app. The cost is a real
  IA change: the public home/discovery stops being "a list of venues" and becomes
  vertical-aware. Ship the LPG section behind a flag during rollout.
- **Discovery diverges — resolved as a vertical-aware search shell.** Booking keeps "search
  venues by service/rating/price"; commerce is **location-first** ("sellers serving my
  area"), area/city-based, sorted by nearest via `branch.lat/lng`, with **implicit delivery
  coverage** (owner cancels out-of-range orders; no zone editor in v1). One search entry
  point, a per-vertical query+result strategy selected by `vertical`. Requires a
  `branch.area` field (neighbourhood granularity, e.g. Dhaka → Dhanmondi) since `city` is
  too coarse for delivery matching. Reorder sits on top (past sellers rank up).
- **The rename is a wide hard cutover.** `venue → business` touches ~2,880 sites across
  every package plus the 4 frontends, and non-grep-able coupling (KV keys `venue:<id>`,
  search "Active venues", api-client method names). Because it's big-bang (option A), the
  API rename and the client renames must ship together or behind a brief compatibility
  shim — sequence it so no deployed client calls a renamed endpoint that isn't live yet.

**To revisit later**
- When/whether to extract each kernel concern (reviews, media, geo) — driven by real
  duplication after LPG ships, each as its own small decision.
- Whether commerce and delivery are one module or two (catalog/order vs fulfilment) —
  decide once the logistics scope is confirmed.

Concrete Drizzle/D1 schema + migration plan for Phases 0–1:
[plan/multi-vertical-schema-design.md](../plan/multi-vertical-schema-design.md).

## Action items

1. [x] **Confirm scope** of the first LPG release → **commerce-only**, manual fulfilment,
   delivery logistics deferred (resolved 2026-06-08).
2. [x] **Phase 0 — rename-first (no behaviour change):** rename `venues → businesses`
   table + add immutable `vertical` column (backfill all existing rows as `booking`);
   rename `venueId → businessId` across booking children; `assertVenueOwner →
   assertBusinessOwner`; update KV cache keys, search module, api-client method names, and
   all 4 frontends. Land as its own PR series with a full test pass, decoupled from LPG.
3. [x] **Phase 1 — commerce (LPG) vertical:** new `products` (stock per branch), `orders`
   (status machine + atomic stock decrement at placement), and `payments` (cash receipts)
   tables; a `commerceApp` module mounted alongside `bookingsApp` in
   [`routes.ts`](../../workers/api/src/modules/routes.ts); ownership chains to `business`.
   Manual fulfilment only (owner advances order status by hand). **Cash-only** — no payment
   provider.
4. [x] **Phase 1 (cont.) — khata due-ledger:** per-`(business, customer)` running balance
   (Σ delivered-order totals − Σ payments); owner balance-management + customer due view.
5. [ ] **Phase 2 — delivery logistics (deferred):** driver entity, driver app, dispatch,
   live tracking — plugs into the order status seam. Its own ADR when scheduled.
6. [ ] **Phase 3 — extract shared-kernel concerns** (reviews, media, geo, search shell)
   **only where the commerce vertical actually duplicated them**; each extraction its own ADR.
7. [x] Update [docs/architecture.md](../architecture.md) once Phase 0 lands (the tenant
   root rename changes the system diagram).

**Parallel track (not blocking LPG; only shared prerequisite is Phase 0 rename):**

8. [x] **Booking owner money-management** — extend the `analytics` module with earnings by
   **staff** / service / branch / over time. Data already present (`bookings.staffId`,
   `price`, `discount`); staff **commission rates** deferred.
