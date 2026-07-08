# Commerce Discovery (#75) — Design

- **Date:** 2026-06-10
- **Issue:** [#75 — Phase 1: commerce discovery (vertical-aware search by area)](https://github.com/hasib-devs/Talash/issues/75)
- **Source:** [ADR-0004 — Extending Talash to multiple business verticals](../../adr/0004-multi-vertical-platform-extension.md)
- **Status:** approved — ready for implementation plan

## Problem

Talash discovery is booking-shaped end to end. `GET /api/v1/search` joins `services` for
`minPrice`, AI re-ranks on `name/category/city`, and never filters by `vertical` — so a
customer cannot find an LPG (commerce) seller, and every result is implicitly tagged
`booking` (the mobile hook hard-codes `vertical: "booking"` with a `// real per-result
vertical lands with #75` marker). The commerce vertical now has businesses, branches with
`area`, products, and orders, but no **discovery** surface: a customer can open a known
seller's `CommerceBusinessScreen`, but cannot *find* one by where they are.

This slice makes discovery vertical-aware: a customer finds LPG sellers serving their
location, sees them listed with price/rating, and can jump back into a past seller's
catalog to reorder. Booking discovery is unchanged.

## Decisions

| Area | Decision |
| --- | --- |
| **Navigation** | A segment toggle (`Salons \| Gas sellers`) on the existing Search tab. Booking is the default segment, so booking discovery is literally untouched. |
| **API shape** | One vertical-aware `GET /api/v1/search` with a `vertical` param defaulting to `booking`, dispatching internally to per-vertical query **strategies** (the "search shell" of ADR-0004). Not a separate commerce endpoint — that would be "two searches," not a vertical-aware shell. |
| **Location source** | Device GPS with manual override. |
| **GPS behavior** | Nearest-first by distance over `branches.lat/lng` (Haversine), header reads "Near you". **No reverse geocoding** — coordinates are never resolved to an area name. |
| **Area matching** | The manual **area picker** (a `branches.area` string) is both the GPS override and the GPS-denied / cold-start fallback. This is the path that satisfies the "returns sellers by area (uses `branches.area`)" acceptance criterion. |
| **Reorder** | An "Order again" row surfacing distinct past sellers, each tapping into the existing `CommerceBusinessScreen` catalog + cart flow. **No order-cloning / one-tap reorder.** |

## Architecture

### Backend — search shell + per-vertical strategies

Refactor `workers/api/src/modules/search/index.ts` from a single handler into a shell that
reads `vertical` (default `booking`) and dispatches to a strategy:

- **`bookingStrategy`** — the current query **lifted verbatim**: `services` join for
  `minPrice`, city/category/price/rating filters, Workers-AI re-rank on
  `name + category + city`. Behavior-preserving; no logic change.
- **`commerceStrategy`** (new) — base filter `businesses.vertical = 'commerce'`,
  `status = 'Active'`, `deletedAt IS NULL`. LEFT JOINs: `branches` (for `area`, `lat`,
  `lng`, nearest branch), `products` (`min(price)` → "from ৳X"), `reviews` (avg published
  rating), cover photo (existing correlated subquery). `GROUP BY businesses.id`. Two input
  modes:
  - **`area` provided** → restrict to sellers having a branch whose `area` matches.
  - **`lat`/`lng` provided** → over-fetch candidates (bounded by `city` when supplied),
    compute **Haversine distance in application code** per the seller's nearest branch
    (D1/SQLite has no reliable math functions; this mirrors the existing
    over-fetch-then-post-filter pattern in the booking path), sort ascending, attach
    `distanceKm`.
  - No Workers-AI re-rank — commerce results are location-ranked, not text-relevance ranked.

**Response contract.** Additive new fields only: `vertical`, `area`, `distanceKm`. Booking
responses keep their exact current shape (`vertical = "booking"`, the new fields absent or
null). The envelope (`{ data, aiRanked }`) is unchanged.

### Data / seed

`createBranch` (`tools/cli/factories/branch.factory.ts`) currently sets `area` + `city` but
**not** `lat`/`lng`. Add realistic per-area Bangladeshi `lat`/`lng` so commerce
distance-ranking is seedable, demoable, and testable against a real D1. `area` is already
well-seeded from `BD_AREAS`.

### api-client

- `search.businesses` params extended with `vertical?`, `area?`, `lat?`, `lng?`.
- `EnrichedSearchResult` extended with `vertical`, `area?`, `distanceKm?`.
- `BusinessVertical` type already exists and is reused.

### Mobile-app

- **`SearchScreen`** gains a vertical **segment**; `vertical` state selects the hook params
  and which filter UI renders. The booking segment renders exactly as today.
- **`expo-location`** added (new Expo native dependency). On entering the Gas segment:
  request location → if granted, send `lat`/`lng` and show a "Near you" location bar; the
  bar taps open the **area picker** (override). If denied, the area picker is the immediate
  fallback (also the cold-start state — first-time customers have no saved address).
- **`useBusinessSearch`** passes `vertical` + `area`/`lat`/`lng`; the hard-coded
  `vertical: "booking"` marker is **removed** in favor of the real per-result `vertical`.
- **Seller card** — name, area / distance, rating, "from ৳X", cover photo → taps to the
  business route → `CommerceBusinessScreen` (existing, registry-selected).
- **"Order again" row** — distinct sellers derived from `useMyOrders` → seller detail.

## Testing

- **Booking-unchanged:** the booking query is lifted into a function untouched; the existing
  3 `search.routes.test.ts` tests stay green; add a route test asserting that an omitted
  `vertical` resolves to the booking path.
- **Shell dispatch:** route tests for the `vertical=commerce` path and `vertical` param
  validation.
- **Commerce query (real-D1 integration, mirroring the khata real-DB derivation test):**
  area filter returns only commerce sellers in that area; distance ordering is correct with
  seeded `lat`/`lng`; booking sellers are excluded from commerce results.
- **Mobile:** segment switch changes hook params; seller card navigates to detail; "Order
  again" derives distinct past sellers; GPS-denied falls back to the area picker.

## Non-goals

- No reverse geocoding (coordinates are never named).
- No delivery-zone editor — coverage stays implicit (owner cancels out-of-range orders),
  per ADR-0004.
- No order-cloning / one-tap reorder.
- No change to booking discovery behavior or response shape.

## Notes

- `expo-location` is the one new dependency — a native module entering the Expo build.
- Haversine is computed in app code by design, not in SQL, due to D1/SQLite math-function
  uncertainty; consistent with the existing over-fetch pattern.
- On completion, update docs per the documentation policy (search/discovery guide,
  `docs/guides/api-endpoints.md`, and the `useBusinessSearch` marker removal) and check off
  #75.
