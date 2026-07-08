# API endpoint index

Reference for routes exposed via `@repo/api-client`. Base path: `/api/v1` on the **gateway** (`workers/api`).

Auth and users routes are implemented in `workers/auth-service` and proxied by the gateway — clients still call `http://localhost:8787` (or production API URL).

**Live docs:** run `bun run api:dev` then open [http://localhost:8787/api/docs](http://localhost:8787/api/docs) (Scalar API reference). OpenAPI spec at `/api/docs/openapi.json`.

**Health:** `GET /health` (outside `/api`, no auth) — D1 probe.

Auth column: **Public** = no JWT · **User** = any authenticated user · **Owner** = business owner/manager/staff (RBAC varies by route).

---

## Auth (`/api/v1/auth`)

> Served by `workers/auth-service` behind the `workers/api` gateway (frontends still call `workers/api`).

| Method | Path | Auth | Client method |
| --- | --- | --- | --- |
| GET | `/google?redirect_uri=&source=` | Public | `auth.getGoogleUrl` |
| POST | `/google/callback` | Public | `auth.googleCallback` |
| POST | `/google/token` | Public | `auth.googleSignIn` |
| POST | `/register` | Public | `auth.register` |
| POST | `/login` | Public | `auth.login` |
| POST | `/forgot-password` | Public | `auth.forgotPassword` |
| POST | `/reset-password` | Public | `auth.resetPassword` |
| POST | `/refresh` | Public | (via `createRefreshFn`) |
| POST | `/logout` | User | `auth.logout` |
| GET | `/me` | User | `auth.me` — includes `authMethods: { password, google }` |
| POST | `/push-token` | User | `auth.registerPushToken` |
| GET | `/sessions` | User | `auth.listSessions` |
| DELETE | `/sessions/:id` | User | `auth.revokeSession` |

---

## Users (`/api/v1/users`)

> Served by `workers/auth-service` behind the `workers/api` gateway (frontends still call `workers/api`).

| Method | Path | Auth | Client method |
| --- | --- | --- | --- |
| GET | `/` | Owner | `users.list` (search) |
| GET | `/:id` | Public | `users.get` |
| POST | `/` | Public | `users.create` |
| PATCH | `/:id` | Public | `users.update` |
| DELETE | `/:id` | User (self) | `users.delete` — body: `{ password }` or `{ idToken }` (required) |
| POST | `/:id/photo` | User (self) | `users.uploadPhoto` (multipart `file`; JPEG/PNG/WebP ≤ 5MB; R2) |

> **Response shape:** `get` / `create` / `update` / `delete` return `SingleResponse<User>` — `{ data: User }`; `list` returns `PaginatedResponse<User>` — `{ data: User[], query }`. `uploadPhoto` returns `{ url }`; `restore` returns a raw `User` (no api-client method). Consumers read `.data` for the single-item reads/writes.

---

## Businesses (`/api/v1/businesses`)

| Method | Path | Auth | Client method |
| --- | --- | --- | --- |
| GET | `/` | Public | `businesses.list` |
| GET | `/:id` | Public | `businesses.get` |
| POST | `/` | Owner | `businesses.create` |
| PATCH | `/:id` | Owner | `businesses.update` |
| DELETE | `/:id` | Owner | `businesses.delete` (soft) |
| PATCH | `/:id/restore` | Owner | `businesses.restore` |
| GET | `/:id/photos` | Public | `businesses.listPhotos` |
| POST | `/:id/photos` | Owner | `businesses.uploadPhoto` (multipart `file`) |
| DELETE | `/:id/photos/:photoId` | Owner | `businesses.deletePhoto` |
| PATCH | `/:id/photos/order` | Owner | `businesses.reorderPhotos` |

> **Response shape:** the single-item endpoints (`get` / `create` / `update` / `delete` / `restore`) return a `SingleResponse<Business>` envelope — `{ data: Business }` — matching the api-client types and the list endpoint. `listPhotos` / `reorderPhotos` return a raw `BusinessPhoto[]`; `uploadPhoto` returns `{ url }`; `deletePhoto` is `204`. Consumers must read `.data` for the single-item reads/writes.

---

## Branches (`/api/v1/branches`)

| Method | Path | Auth | Client method |
| --- | --- | --- | --- |
| GET | `/?businessId=` | Public | `branches.list` |
| GET | `/:id` | Public | `branches.get` |
| POST | `/?businessId=` | Owner | `branches.create` |
| PATCH | `/:id` | Owner | `branches.update` |
| DELETE | `/:id` | Owner | `branches.delete` |
| GET | `/:id/hours` | Public | `branches.getHours` |
| PUT | `/:id/hours` | Owner | `branches.upsertHours` |
| GET | `/:id/availability?date=&serviceId=` | Public | `branches.getAvailability` |

> **Response shape:** `list` returns `PaginatedResponse<Branch>` — `{ data: Branch[], query }` (the endpoint returns all branches for the business as a single page; `query` is synthesized). The single-item endpoints (`get` / `create` / `update` / `delete`) return `SingleResponse<Branch>` — `{ data: Branch }`. `getHours` / `upsertHours` return a raw `BranchHours[]`; `getAvailability` returns a raw `{ date, serviceId, isClosed, slots }`. Consumers must read `.data` for `list` and the single-item reads/writes.

---

## Services (`/api/v1/services`)

> **Worker:** Implemented in `workers/booking-service`; the gateway (`workers/api`) proxies these paths via the `BOOKING_SERVICE` Service Binding. Frontends keep the same `/api/v1/...` URLs.

| Method | Path | Auth | Client method |
| --- | --- | --- | --- |
| GET | `/?branchId=` | Public | `services.list` |
| GET | `/:id` | Public | `services.get` |
| POST | `/?branchId=` | Owner | `services.create` |
| PATCH | `/:id` | Owner | `services.update` |
| DELETE | `/:id` | Owner | `services.delete` |
| POST | `/:id/photo` | Owner | `services.uploadPhoto` (multipart `file`) |
| DELETE | `/:id/photo` | Owner | `services.deletePhoto` |

> **Response shape:** `list` returns `PaginatedResponse<Service>` — `{ data: Service[], query }` (all services for the branch as one synthesized page; `query` is synthesized). `get` / `create` / `update` / `delete` return `SingleResponse<Service>` — `{ data: Service }`. `uploadPhoto` returns `{ url }`; `deletePhoto` is `204`. Consumers read `.data`.

---

## Products (`/api/v1/products`) — commerce vertical

> **Worker:** Implemented in `workers/lpg-service`; the gateway (`workers/api`) proxies these paths via the `LPG_SERVICE` Service Binding. Frontends keep the same `/api/v1/...` URLs.

Branch-scoped product catalog for the `commerce` vertical (LPG retail). Stock is tracked per branch with a DB `CHECK(stock >= 0)`. Ownership chains product → branch → business.owner via `assertProductAccess`.

| Method | Path | Auth | Client method |
| --- | --- | --- | --- |
| GET | `/?branchId=` | Public | `products.list` |
| GET | `/:id` | Public | `products.get` |
| POST | `/?branchId=` | Owner/Manager | `products.create` |
| PATCH | `/:id` | Owner/Manager | `products.update` |
| DELETE | `/:id` | Owner/Manager | `products.delete` |
| POST | `/:id/photo` | Owner/Manager | `products.uploadPhoto` (multipart `file`) |
| DELETE | `/:id/photo` | Owner/Manager | `products.deletePhoto` |

> **Response shape:** `get` / `create` / `update` / `delete` return `SingleResponse<Product>` — `{ data: Product }`. **`list` is the exception — it returns a raw `Product[]`** (no envelope; the api-client types it `Product[]` and mobile consumers read it as a bare array). Do not envelope `products.list`.

---

## Orders (`/api/v1/orders`) — commerce vertical

Atomic order placement and fulfillment queue. Customer routes require `authenticate`; owner/manager routes additionally require `requireAuth(["owner","manager"], { branchScope: true })`.

| Method | Path | Auth | Client method |
| --- | --- | --- | --- |
| POST | `/` | User | `orders.create` — place order; 201 with order snapshot; 409 on out-of-stock |
| GET | `/` | User | `orders.listMine` — caller's own orders |
| GET | `/:id` | User | `orders.get` — caller's own order detail with line items; 403 on another user's order, 404 if missing |
| PATCH | `/:id/cancel` | User | `orders.cancel` — cancel Pending/Confirmed; restores stock atomically; 204 |
| GET | `/branch?branchId=` | Owner/Manager | `orders.listByBranch` — fulfillment queue |
| PATCH | `/:id/status` | Owner/Manager | `orders.updateStatus` — advance status (forward-only: Pending→Confirmed→OutForDelivery→Delivered) **or cancel** (`{ "status": "Cancelled" }` — owner cancel, restores stock atomically, only from Pending/Confirmed; 422 otherwise); notifies the customer on every transition |

---

## Customer Addresses (`/api/v1/customer-addresses`) — commerce vertical

Self-scoped address book. All routes require `authenticate` only.

| Method | Path | Auth | Client method |
| --- | --- | --- | --- |
| GET | `/` | User | `customerAddresses.list` |
| POST | `/` | User | `customerAddresses.create` — 201; sets `isDefault` clears other defaults first |
| PATCH | `/:id` | User | `customerAddresses.update` — partial update; `isDefault: true` clears other defaults |
| DELETE | `/:id` | User | `customerAddresses.remove` |

---

## Bookings (`/api/v1/bookings`)

> **Worker:** Implemented in `workers/booking-service` (gateway proxy via `BOOKING_SERVICE`).

| Method | Path | Auth | Client method |
| --- | --- | --- | --- |
| GET | `/` | User | `bookings.list` (own bookings) |
| GET | `/:id` | User | `bookings.get` |
| POST | `/` | User | `bookings.create` |
| PATCH | `/:id/confirm` | Owner | `bookings.confirm` |
| PATCH | `/:id/complete` | Owner | `bookings.complete` |
| PATCH | `/:id/cancel` | User/Owner | `bookings.cancel` |
| PATCH | `/:id/assign` | Owner | `bookings.assign` |
| GET | `/branch?businessId=&branchId=&status=` | Owner | `bookings.listBranch` |
| GET | `/calendar?branchId=&start=&end=` | Owner | `bookings.calendar` |
| GET | `/export?businessId=&status=` | Owner | `bookings.exportCsv` → Blob |

> **Response shape:** every single-item route (`get` / `create` / `confirm` / `complete` / `cancel` / `assign`) returns `SingleResponse<Booking>` — `{ data: Booking }`; `list` and `listBranch` return `PaginatedResponse<Booking>` — `{ data: Booking[], query }` (single synthesized page; `listBranch.query` reflects the pre-`limit`-slice count). `calendar` returns a raw `CalendarBooking[]`; `exportCsv` is a CSV Blob. Consumers read `.data` — including the mobile `BookingDetailSheet` (`freshQuery.data?.data?.status`).

---

## Walk-in (`/api/v1/walk-in`)

> **Gateway dispatcher:** `workers/api` resolves each request's branch vertical (D1 + KV cache `branch:<id>:vertical`) and forwards booking paths to `workers/booking-service`, commerce paths to `workers/lpg-service`. `/sync` fans out by entry vertical and merges `{ synced }`; `/receipts` fans in from both workers and merges `{ bookings, orders }`.

QR walk-in booking/order for guests and signed-in customers. Spec: [walk-in design](../superpowers/specs/2026-06-12-walk-in-qr-lan-sync-design.md).

| Method | Path | Auth | Client method |
| --- | --- | --- | --- |
| GET | `/context?branchId=&session=&signature=` | Optional | `walkIn.getContext` — catalog + vertical |
| POST | `/submit` | Optional | `walkIn.submit` — guest or signed-in; walk-in bookings land **Confirmed** |
| POST | `/sync` | Owner/Manager | `walkIn.sync` — batch upload from owner queue (max 20) |
| POST | `/branch-qr` | Owner | `walkIn.regenerateBranchQr` — signed branch QR payload |
| POST | `/sessions` | Owner | `walkIn.createSession` — 15 min session token (KV) |
| GET | `/receipts` | User | `walkIn.listReceipts` — signed-in walk-in history |

---

## Reviews (`/api/v1/reviews`)

> **Worker:** `workers/booking-service` (gateway proxy via `BOOKING_SERVICE`).

| Method | Path | Auth | Client method |
| --- | --- | --- | --- |
| GET | `/?businessId=` | Public | `reviews.list` |
| GET | `/mine` | User | `reviews.listMine` |
| GET | `/pending?businessId=` | Owner | `reviews.listPending` |
| POST | `/` | User | `reviews.create` |
| PATCH | `/:id/approve` | Owner | `reviews.approve` |
| PATCH | `/:id/reject` | Owner | `reviews.reject` |

> **Response shape:** `list` (published) returns `PaginatedResponse<Review>` — `{ data: Review[], query }`; `create` / `approve` / `reject` return `SingleResponse<Review>` — `{ data: Review }`. `listMine` (`MyReview[]`) and `listPending` (`Review[]`) are **raw arrays** (api-client types them bare). Consumers read `.data` for `list`/`create`/`approve`/`reject`.

---

## Coupons (`/api/v1/coupons`)

> **Worker:** `workers/booking-service` (gateway proxy via `BOOKING_SERVICE`).

| Method | Path | Auth | Client method |
| --- | --- | --- | --- |
| GET | `/?businessId=` | Owner | `coupons.list` |
| GET | `/:id` | Owner | `coupons.get` |
| POST | `/` | Owner | `coupons.create` |
| DELETE | `/:id` | Owner | `coupons.delete` |
| POST | `/validate` | User | `coupons.validate` |

> **Response shape:** `get` / `create` / `delete` return `SingleResponse<Coupon>` — `{ data: Coupon }`. `list` returns `PaginatedResponse<Coupon>` — `{ data: Coupon[], query }` (genuinely paginated). `validate` returns a raw `{ valid, coupon?, discount?, message? }` (not enveloped). Consumers read `.data` for `list`/`get`/`create`/`delete`.

---

## Team (`/api/v1/team`)

> **Worker:** `workers/booking-service` (gateway proxy via `BOOKING_SERVICE`). Staff availability routes share the `/team` prefix.

| Method | Path | Auth | Client method |
| --- | --- | --- | --- |
| GET | `/?businessId=` | Owner | `team.list` |
| POST | `/` | Owner | `team.add` |
| PATCH | `/:id` | Owner | `team.update` |
| DELETE | `/:id` | Owner | `team.remove` |

> **Response shape:** `list` returns `PaginatedResponse<TeamMember>` — `{ data: TeamMember[], query }`; `add` / `update` / `remove` return `SingleResponse<TeamMember>` — `{ data: TeamMember }`. Consumers read `.data`.

### Staff availability (same `/team` prefix)

| Method | Path | Auth | Client method |
| --- | --- | --- | --- |
| GET | `/:id/availability` | Owner | `staffAvailability.get` |
| PUT | `/:id/availability` | Owner | `staffAvailability.upsert` |

---

## Rewards (`/api/v1/rewards`)

> **Worker:** `workers/booking-service` (gateway proxy via `BOOKING_SERVICE`).

| Method | Path | Auth | Client method |
| --- | --- | --- | --- |
| GET | `/balance` | User | `rewards.balance` |
| GET | `/history` | User | `rewards.history` |
| POST | `/redeem` | User | `rewards.redeem` |

> **Response shape:** `history` returns `PaginatedResponse<RewardTransaction>` — `{ data: RewardTransaction[], query }` (single synthesized page). `balance` (`RewardBalance`) and `redeem` return raw objects (not enveloped).

---

## Search (`/api/v1/search`)

> **Gateway dispatcher:** `workers/api` reads `?vertical=` (default `booking`) and proxies to `workers/booking-service` (`vertical=booking`) or `workers/lpg-service` (`vertical=commerce`). Each worker runs only its vertical strategy.

| Method | Path | Auth | Client method |
| --- | --- | --- | --- |
| GET | `/?q=&vertical=&city=&category=&minPrice=&maxPrice=&minRating=&sortBy=&limit=&area=&lat=&lng=` | Public | `search.businesses` |

Vertical-aware (`vertical=booking|commerce`, default `booking`). Booking is AI-ranked text search and only returns booking sellers. Commerce returns `vertical=commerce` sellers matched by `area` (exact `branches.area`) or, when `lat`/`lng` are passed, ranked nearest-first by Haversine distance over `branches.lat/lng` (computed in app code; no reverse geocoding). `area`, `lat`, `lng` are commerce-only.

Returns `coverPhotoUrl`, `lat`, `lng` per business when available. Each result row also carries `vertical`, `area`, and `distanceKm` (set only in commerce distance mode).

---

## Analytics (`/api/v1/analytics`)

> **Worker:** `workers/booking-service` (gateway proxy via `BOOKING_SERVICE`).

All accept `businessId` + `range` (7 | 30 | 90). **Owner only** (`requireAuth(["owner"])` — managers get 403 at middleware).

| Method | Path | Client method |
| --- | --- | --- |
| GET | `/overview` | `analytics.overview` |
| GET | `/revenue` | `analytics.revenue` |
| GET | `/services` | `analytics.services` |
| GET | `/peak` | `analytics.peak` |
| GET | `/reviews` | `analytics.reviews` |
| GET | `/coupons` | `analytics.coupons` |
| GET | `/staff` | `analytics.staff` |
| GET | `/earnings?businessId=&range=7\|30\|90` | `analytics.earnings` |

Earnings endpoint returns reconciled earnings for Completed bookings (discount netted, bucketed by slot): `{ total, byStaff[], byService[], byBranch[], overTime[] }`; staffless bookings roll into an "Unassigned" bucket.

---

## Customers (`/api/v1/customers`)

> **Worker:** `workers/booking-service` (gateway proxy via `BOOKING_SERVICE`).

| Method | Path | Auth | Client method |
| --- | --- | --- | --- |
| GET | `/?businessId=` | Owner | `customers.list` |
| GET | `/:userId/visits?businessId=` | Owner | `customers.visits` |

---

## Campaigns (`/api/v1/campaigns`)

> **Worker:** `workers/booking-service` (gateway proxy via `BOOKING_SERVICE`).

| Method | Path | Auth | Client method |
| --- | --- | --- | --- |
| GET | `/?businessId=` | Owner | `campaigns.list` |
| POST | `/` | Owner | `campaigns.create` |
| PATCH | `/:id` | Owner | `campaigns.update` |
| POST | `/:id/send?businessId=` | Owner | `campaigns.send` |
| DELETE | `/:id` | Owner | `campaigns.delete` |

---

## Notifications (`/api/v1/notifications`)

| Method | Path | Auth | Client method |
| --- | --- | --- | --- |
| GET | `/?businessId=` | Owner | `notifications.list` |
| PATCH | `/:id/read` | Owner | `notifications.markRead` |
| POST | `/read-all` | Owner | `notifications.markAllRead` |

---

## Favourites (`/api/v1/favourites`)

| Method | Path | Auth | Client method |
| --- | --- | --- | --- |
| GET | `/` | User | `favourites.list` |
| GET | `/:businessId` | User | `favourites.check` |
| POST | `/:businessId` | User | `favourites.add` |
| DELETE | `/:businessId` | User | `favourites.remove` |

---

## Demo requests (`/api/v1/demo-requests`)

| Method | Path | Auth | Client method |
| --- | --- | --- | --- |
| POST | `/` | Public | `demoRequests.create` |

---

## Payments (`/api/v1/payments`) — commerce vertical

Owner-recorded cash receipts for the khata ledger. `recordedBy` is set to the acting owner. Void = soft-delete; the derived balance self-corrects. `order_id` is an optional audit tag — never used in balance derivation.

| Method | Path | Auth | Client method |
| --- | --- | --- | --- |
| POST | `/` | Owner | `payments.record` — body: `{ businessId, userId, amount (positive int), note?, orderId? }`; 201 |
| DELETE | `/:id` | Owner | `payments.void` — soft-delete; 204 |

---

## Khata (`/api/v1/khata`) — commerce vertical

Derived ledger view. **No stored balance column** — `due = Σ delivered-order totals − Σ payments` per `(business, customer)`, computed on every request. Owner auth required for both routes.

| Method | Path | Auth | Client method |
| --- | --- | --- | --- |
| GET | `/dues?businessId=` | Owner | `khata.dues` — customers with `due > 0`, ordered by due desc; `[{ userId, name, due }]` |
| GET | `/customers/:userId?businessId=` | Owner | `khata.customerLedger` — full ledger: `{ userId, name, due, totalDelivered, totalPaid, deliveredOrders[], payments[] }` |

---

## Adding a new endpoint

1. Implement route in `workers/api/src/modules/<name>/`
2. Add method to `packages/api-client/src/endpoints/<name>.ts`
3. Export types from `packages/api-client/src/index.ts`
4. Update this file and [feature-map.md](../feature-map.md)
5. Add route tests — see [testing.md](testing.md)

Source of truth for client paths: `packages/api-client/src/endpoints/*.ts`.
