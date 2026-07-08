# Feature Map — Backend vs Frontend Coverage

**Legend:** ✅ Implemented · ⬜ Not applicable · ❌ Missing (gap)

Columns: **API** (workers/api) · **mobile-app** (customer) · **owner-app** (mobile owner) · **business-dashboard** (web owner) · **marketing-site** (customer web)

> Note: grep-based analysis misses multi-line method chains. All entries below are verified against source.

---

## Auth

| Feature | API | mobile-app | owner-app | business-dashboard | marketing-site |
|---|:---:|:---:|:---:|:---:|:---:|
| Google sign-in | ✅ | ✅ | ✅ | ✅ | ✅ |
| Get Google OAuth URL | ✅ | ✅ | ✅ | ✅ | ✅ |
| Current user (`me`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Logout | ✅ | ✅ | ✅ | ✅ | ✅ |
| List sessions | ✅ | ✅ | ✅ | ✅ | ✅ |
| Revoke session | ✅ | ✅ | ✅ | ✅ | ✅ |
| Register push token | ✅ | ✅ | ✅ | ⬜ | ⬜ |

---

## Users

| Feature | API | mobile-app | owner-app | business-dashboard | marketing-site |
|---|:---:|:---:|:---:|:---:|:---:|
| Get user | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| Update profile | ✅ | ✅ | ✅ | ✅ | ✅ |
| Profile photo upload (self) | ✅ | ⬜ | ⬜ | ⬜ | ✅ |
| List / search users | ✅ | ⬜ | ⬜ | ✅ | ⬜ |
| Delete account (self) | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Businesses

| Feature | API | mobile-app | owner-app | business-dashboard | marketing-site |
|---|:---:|:---:|:---:|:---:|:---:|
| List businesses | ✅ | ✅ | ✅ | ✅ | ✅ |
| Get business | ✅ | ✅ | ⬜ | ⬜ | ✅ |
| Create business | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Update business | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Delete business (archive) | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Restore business (soft-delete) | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Upload photo | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Delete photo | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Reorder photos | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| List photos | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Branches

| Feature | API | mobile-app | owner-app | business-dashboard | marketing-site |
|---|:---:|:---:|:---:|:---:|:---:|
| List branches | ✅ | ✅ | ✅ | ✅ | ✅ |
| Get branch | ✅ | ✅ | ⬜ | ⬜ | ⬜ |
| Create branch | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Update branch | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Delete branch | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Get hours | ✅ | ✅ | ✅ | ✅ | ✅ |
| Upsert hours | ✅ | ⬜ | ✅ | ✅ | ⬜ |

---

## Services

| Feature | API | mobile-app | owner-app | business-dashboard | marketing-site |
|---|:---:|:---:|:---:|:---:|:---:|
| List services | ✅ | ✅ | ✅ | ✅ | ✅ |
| Get service | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create service | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Update service | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Delete service | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Upload photo | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Delete photo | ✅ | ⬜ | ✅ | ✅ | ⬜ |

---

## Bookings

| Feature | API | mobile-app | owner-app | business-dashboard | marketing-site |
|---|:---:|:---:|:---:|:---:|:---:|
| List my bookings | ✅ | ✅ | ⬜ | ⬜ | ✅ |
| Get booking | ✅ | ✅ | ⬜ | ⬜ | ✅ |
| Create booking | ✅ | ✅ | ⬜ | ⬜ | ✅ |
| Cancel booking | ✅ | ✅ | ✅ | ✅ | ✅ |
| List branch bookings | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Calendar view | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Confirm booking | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Complete booking | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Assign staff | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Export CSV | ✅ | ⬜ | ✅ | ✅ | ⬜ |

> mobile-app uses `BookingDetailSheet` (data passed from list); single `api.bookings.get` not needed.

---

## Reviews

| Feature | API | mobile-app | owner-app | business-dashboard | marketing-site |
|---|:---:|:---:|:---:|:---:|:---:|
| List business reviews | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create review | ✅ | ✅ | ⬜ | ⬜ | ✅ |
| Reviews I've written (`GET /reviews/mine` → `ReviewsSection`) | ✅ | ⬜ | ⬜ | ⬜ | ✅ |
| List pending reviews | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Approve review | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Reject review | ✅ | ⬜ | ✅ | ✅ | ⬜ |

---

## Coupons

| Feature | API | mobile-app | owner-app | business-dashboard | marketing-site |
|---|:---:|:---:|:---:|:---:|:---:|
| List coupons | ✅ | ✅ | ✅ | ✅ | ✅ |
| Get coupon | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Create coupon | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Delete / deactivate coupon | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Validate coupon (checkout) | ✅ | ✅ | ⬜ | ⬜ | ✅ |

---

## Team

| Feature | API | mobile-app | owner-app | business-dashboard | marketing-site |
|---|:---:|:---:|:---:|:---:|:---:|
| List team members | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Add team member | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Update team member | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Remove team member | ✅ | ⬜ | ✅ | ✅ | ⬜ |

---

## Staff Availability

| Feature | API | mobile-app | owner-app | business-dashboard | marketing-site |
|---|:---:|:---:|:---:|:---:|:---:|
| Get staff availability | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Upsert staff availability | ✅ | ⬜ | ✅ | ✅ | ⬜ |

---

## Rewards

| Feature | API | mobile-app | owner-app | business-dashboard | marketing-site |
|---|:---:|:---:|:---:|:---:|:---:|
| Get balance | ✅ | ✅ | ⬜ | ⬜ | ✅ |
| Transaction history | ✅ | ✅ | ⬜ | ⬜ | ✅ |
| Redeem points | ✅ | ✅ | ⬜ | ⬜ | ✅ |

---

## Search

| Feature | API | mobile-app | owner-app | business-dashboard | marketing-site |
|---|:---:|:---:|:---:|:---:|:---:|
| Search businesses (full filters) | ✅ | ✅ | ⬜ | ⬜ | ✅ |

---

## Analytics

| Feature | API | mobile-app | owner-app | business-dashboard | marketing-site |
|---|:---:|:---:|:---:|:---:|:---:|
| Overview stats | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Revenue chart | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Services breakdown | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Peak hours heatmap | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Review stats | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Coupon stats | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Staff performance | ✅ | ⬜ | ✅ | ✅ | ⬜ |

---

## Customers (Owner)

| Feature | API | mobile-app | owner-app | business-dashboard | marketing-site |
|---|:---:|:---:|:---:|:---:|:---:|
| List customers | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Customer visit history | ✅ | ⬜ | ✅ | ✅ | ⬜ |

---

## Campaigns

| Feature | API | mobile-app | owner-app | business-dashboard | marketing-site |
|---|:---:|:---:|:---:|:---:|:---:|
| List campaigns | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Create campaign | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Update campaign | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Delete campaign | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| Send campaign | ✅ | ⬜ | ✅ | ✅ | ⬜ |

---

## Notifications

| Feature | API | mobile-app | owner-app | business-dashboard | marketing-site |
|---|:---:|:---:|:---:|:---:|:---:|
| List notifications | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mark single read | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mark all read | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Favourites

| Feature | API | mobile-app | owner-app | business-dashboard | marketing-site |
|---|:---:|:---:|:---:|:---:|:---:|
| List favourites | ✅ | ✅ | ⬜ | ⬜ | ✅ |
| Check if favourited | ✅ | ⬜ | ⬜ | ⬜ | ✅ |
| Add favourite | ✅ | ✅ | ⬜ | ⬜ | ✅ |
| Remove favourite | ✅ | ✅ | ⬜ | ⬜ | ✅ |

> mobile-app derives favourite state from the list; no per-business check call needed.

---

## Demo Requests

| Feature | API | mobile-app | owner-app | business-dashboard | marketing-site |
|---|:---:|:---:|:---:|:---:|:---:|
| Submit demo request | ✅ | ⬜ | ⬜ | ⬜ | ✅ |

---

## Cross-Platform Parity

Both platforms in each pair serve the same user role and should have feature parity unless the platform genuinely can't support it.

### Owner: owner-app (mobile) vs business-dashboard (web)

| Feature | owner-app | business-dashboard | Notes |
|---|:---:|:---:|---|
| **Auth** | | | |
| Google sign-in | ✅ | ✅ | |
| Push token registration | ✅ | ⬜ | Web push not implemented (acceptable) |
| Revoke session | ✅ | ✅ | |
| **Analytics** — all 7 endpoints | ✅ | ✅ | Full parity |
| **Bookings** — list/calendar/confirm/complete/cancel/assign/CSV | ✅ | ✅ | Full parity |
| **Branches** — list/create/update/delete/hours | ✅ | ✅ | Full parity |
| **Services** — list/create/update/delete/photos | ✅ | ✅ | Full parity |
| **Coupons** — list/create/delete | ✅ | ✅ | Full parity |
| **Team** — list/add/update/remove | ✅ | ✅ | Full parity |
| **Staff availability** — get/upsert | ✅ | ✅ | Full parity |
| **Campaigns** — list/create/update/delete/send | ✅ | ✅ | Full parity |
| **Customers** — list/visits | ✅ | ✅ | Full parity |
| **Reviews** — list/pending/approve/reject | ✅ | ✅ | Full parity |
| **Businesses** — create/update/photos | ✅ | ✅ | Full parity |
| **Notifications** | ✅ | ✅ | Full parity |

**Owner parity: no gaps.** Both platforms have full feature parity.

---

### Customer: mobile-app (native) vs marketing-site (web)

| Feature | mobile-app | marketing-site | Notes |
|---|:---:|:---:|---|
| **Auth** | | | |
| Google sign-in | ✅ | ✅ | mobile uses native SDK; web uses OAuth URL redirect |
| Push token registration | ✅ | ⬜ | Web push not implemented (acceptable) |
| Sessions / Logout / Revoke | ✅ | ✅ | |
| **Search** — business search, city + all filters | ✅ | ✅ | City filter on mobile filter sheet; search page has full filter panel |
| **Businesses** — get, list, list photos | ✅ | ✅ | Cover photos from search; service photos shown on business detail (both); FavouritesScreen pull-to-refresh (mobile) |
| **Branches** | | | |
| List branches | ✅ | ✅ | |
| Get branch hours | ✅ | ✅ | Booking flow uses branch hours for slot generation (web) |
| **Services** — list, get, photos | ✅ | ✅ | `photoUrl` shown in service row on business detail (web + mobile) |
| **Bookings** | | | |
| List / Create / Cancel | ✅ | ✅ | Full parity |
| Booking detail | ✅ | ✅ | mobile `BookingDetailSheet` uses background `api.bookings.get` for fresh status; web calls it directly |
| **Coupons** — list, validate | ✅ | ✅ | Full parity |
| **Favourites** — list, add, remove | ✅ | ✅ | BusinessGrid heart connected to API (web); FavouritesScreen shows cover photos (mobile) |
| **Reviews** — list (with author name), create | ✅ | ✅ | Repository JOINs users table; `userName` returned in API response |
| **Rewards** — balance, history, redeem | ✅ | ✅ | Full parity |
| **Notifications** | ✅ | ✅ | Full parity |
| **Profile** — update name | ✅ | ✅ | Full parity |
| **Demo request** | ⬜ | ✅ | Marketing-only feature |

**Customer parity: no gaps.**

---

## Remaining Known Gaps

| Gap | Where | Notes |
|---|---|---|
| `users.create` — register without OAuth | all frontends | Users are created via Google sign-in; no manual create UI needed |
| `businesses.delete` (hard) | all frontends | Soft-delete (archive) is now implemented; hard delete intentionally admin-only |

All implementation gaps have been resolved as of June 2026. Public-facing UX enhancements completed June 2026:
- Booking slots now respect branch working hours (closed days show no slots; hours drive slot range)
- `next/image` replaced with `<img>` in search and business pages (no missing `width`/`height` props)
- Homepage BusinessGrid loading skeleton upgraded to card-shaped pulse skeletons (6 cards)
- "Similar businesses" section on business detail page (same city + category, 3 cards)
- BusinessScreen skeleton replaced with gallery + content block skeletons (mobile)
- Pull-to-refresh added to FavouritesScreen (mobile)
- Service `photoUrl` shown in service rows on business detail (web + mobile)
- OG / Twitter meta tags on `/businesses/[id]` via server component `generateMetadata`

---

## Out of Scope per Client Type

- Analytics, campaigns, customers, team, staff availability → owner tools only; customer frontends correctly omit these.
- Favourites, rewards, search → customer tools only; owner frontends correctly omit these.
- Demo requests → marketing-site only.
- Push token → mobile apps only; web frontends correctly omit this.
- Auth method difference: web uses `getGoogleUrl` redirect flow; mobile uses native Google SDK — both correct for their platform.
