# Booking-service worker split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the entire booking vertical into a new Cloudflare Worker (`workers/booking-service`) so booking routes can be deployed and scaled independently, while clients keep calling the gateway (`workers/api`) at the same `/api/v1/*` URLs.

**Architecture:** Keep `workers/api` as the only public edge API. Proxy booking-vertical prefixes to `BOOKING_SERVICE`, proxy commerce to `LPG_SERVICE`, proxy auth/users to `AUTH_SERVICE`. Split `search` and `walk-in` by vertical: the gateway dispatches, while `booking-service` owns booking logic and `lpg-service` owns commerce logic.

**Tech Stack:** Cloudflare Workers + Hono + Drizzle/D1 + Service Bindings + KV/R2/Queue + `@repo/core` repositories + `@repo/api-client` unchanged.

---

## Scope (from spec)

- New worker: `workers/booking-service` (name `talash-booking-service`, binding `BOOKING_SERVICE`)
- Gateway proxy booking prefixes:
  - `/api/v1/services/*`, `/bookings/*`, `/team/*`, `/coupons/*`, `/reviews/*`, `/rewards/*`, `/analytics/*`, `/campaigns/*`, `/customers/*`
- Search split:
  - `booking-strategy.ts` + booking search endpoint → `booking-service`
  - `commerce-strategy.ts` + commerce search endpoint → `lpg-service`
  - gateway `/api/v1/search` becomes vertical dispatcher
- Walk-in split:
  - booking walk-in path → `booking-service`
  - commerce walk-in path → `lpg-service`
  - gateway `/api/v1/walk-in` becomes vertical dispatcher (including sync fan-out and receipts fan-in)
- Shared shell stays in gateway: `businesses`, `branches`, `notifications`, `favourites`, `demo-requests`
- No API-client path changes

## File map (what changes where)

### Create

- `workers/booking-service/wrangler.jsonc`
- `workers/booking-service/package.json`
- `workers/booking-service/src/index.ts`
- `workers/booking-service/src/app.ts`
- `workers/booking-service/src/core/*` (copy patterns from `workers/lpg-service` and/or `workers/auth-service`)
- `workers/booking-service/src/middleware/*` (copy patterns from `workers/lpg-service`)
- `workers/booking-service/src/modules/<booking-modules>/*`
- `workers/booking-service/src/__tests__/helpers/*`
- `workers/booking-service/src/__tests__/modules/*`
- `workers/booking-service/CLAUDE.md`

### Modify

- `workers/api/wrangler.jsonc` (add `BOOKING_SERVICE` binding)
- `workers/api/src/modules/routes.ts` (proxy booking prefixes; replace `searchApp` and `walkInApp` with dispatchers)
- `workers/api/src/core/authorization.ts` (trim to shell-only checks)
- `workers/lpg-service/wrangler.jsonc` (add missing bindings needed for `search` + walk-in)
- `workers/lpg-service/src/modules/search/*` (add search module copied from api; strategy lives here)
- `workers/lpg-service/src/modules/walk-in/*` (add commerce walk-in module)
- `docs/architecture.md`, `docs/guides/api-endpoints.md`, `workers/api/CLAUDE.md`, `workers/lpg-service/CLAUDE.md` (implementation docs; do at the end of coding)

### Move (delete from gateway after port)

- `workers/api/src/modules/services/*` → `workers/booking-service/src/modules/services/*`
- `workers/api/src/modules/bookings/*` → `workers/booking-service/src/modules/bookings/*`
- `workers/api/src/modules/team/*` + `workers/api/src/modules/staff-availability/*` → `workers/booking-service/src/modules/...`
- `workers/api/src/modules/coupons/*` → `workers/booking-service/src/modules/coupons/*`
- `workers/api/src/modules/reviews/*` → `workers/booking-service/src/modules/reviews/*`
- `workers/api/src/modules/rewards/*` → `workers/booking-service/src/modules/rewards/*`
- `workers/api/src/modules/analytics/*` → `workers/booking-service/src/modules/analytics/*`
- `workers/api/src/modules/campaigns/*` → `workers/booking-service/src/modules/campaigns/*`
- `workers/api/src/modules/customers/*` → `workers/booking-service/src/modules/customers/*`
- `workers/api/src/modules/search/*` split: booking strategy to booking-service; commerce strategy to lpg-service; gateway keeps only a dispatcher
- `workers/api/src/modules/walk-in/*` split: booking path to booking-service; commerce path to lpg-service; gateway keeps only a dispatcher

---

### Task 1: Create the `booking-service` worker scaffold

**Files:**
- Create: `workers/booking-service/wrangler.jsonc`
- Create: `workers/booking-service/package.json`
- Create: `workers/booking-service/src/index.ts`
- Create: `workers/booking-service/src/app.ts`
- Create: `workers/booking-service/CLAUDE.md`
- Modify: `workers/api/wrangler.jsonc` (add `BOOKING_SERVICE` service binding)
- Modify: root `package.json` (add `booking-service:dev` script)

- [ ] **Step 1: Create `workers/booking-service` package skeleton**

Run:

```bash
mkdir -p workers/booking-service/src
```

Create `workers/booking-service/package.json`:

```json
{
  "name": "@repo/booking-service",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev --env local",
    "deploy:staging": "wrangler deploy --env staging",
    "deploy:production": "wrangler deploy --env production",
    "test": "bun test",
    "cf-typegen": "wrangler types --env local"
  }
}
```

- [ ] **Step 2: Create `wrangler.jsonc` mirroring `lpg-service`**

Create `workers/booking-service/wrangler.jsonc` with the same observability + nodejs_compat setup as `workers/lpg-service/wrangler.jsonc`, and bindings:

- D1: `TALASH_DB` (migrations_dir points at `../api/src/database/migrations`)
- KV: `TALASH_KV`
- R2: `TALASH_STORAGE`
- Queue producer: `TALASH_QUEUE`
- AI: `TALASH_AI` (optional in local env)
- Service binding: `AUTH_SERVICE`
- Vars: `ENVIRONMENT`, `ALLOWED_ORIGINS`, `PUBLIC_R2_URL`, `JWT_SECRET`

Expected worker name:

```jsonc
{ "name": "talash-booking-service" }
```

- [ ] **Step 3: Wire up minimal app + index**

Create `workers/booking-service/src/app.ts`:

```ts
import { createApp } from "./core/create-app";

const app = createApp();

app.get("/health", (c) => c.json({ ok: true, message: "booking-service is running" }, 200));

export default app;
```

Create `workers/booking-service/src/index.ts`:

```ts
import app from "./app";

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
```

- [ ] **Step 4: Add gateway binding + dev script**

Modify root `package.json` scripts:

```json
{
  "scripts": {
    "booking-service:dev": "bun run --filter @repo/booking-service dev"
  }
}
```

Modify `workers/api/wrangler.jsonc` to add:

```jsonc
{
  "services": [
    // ...
    { "binding": "BOOKING_SERVICE", "service": "talash-booking-service" }
  ]
}
```

- [ ] **Step 5: Smoke run**

Run:

```bash
bun install
bun run booking-service:dev
```

Expected: `GET /health` returns 200 JSON.

- [ ] **Step 6: Commit**

```bash
git add workers/booking-service workers/api/wrangler.jsonc package.json
git commit -m "chore(booking-service): scaffold new worker and bind in gateway"
```

---

### Task 2: Port shared worker primitives (create-app, middleware, errors) into booking-service

**Files:**
- Create: `workers/booking-service/src/core/create-app.ts`
- Create: `workers/booking-service/src/core/errors.ts`
- Create: `workers/booking-service/src/middleware/*` (auth, auth-guard, exceptions, services injection, query-parser, timeout, cors)
- Modify: `workers/booking-service/src/app.ts` (use middleware and `injectServices`)
- Test: `workers/booking-service/src/__tests__/helpers/create-test-app.ts`

- [ ] **Step 1: Copy core/middleware patterns from `workers/lpg-service`**

Do a straight port of the following files (keeping imports adjusted to `workers/booking-service` paths):

- `src/core/create-app.ts` (must use OpenAPIHono factory pattern)
- `src/core/errors.ts`
- `src/middleware/auth.ts` (local JWT verify)
- `src/middleware/auth-guard.ts` (role gate + `branchScope` calls to `AUTH_SERVICE` internal authorise)
- `src/middleware/exceptions.ts`
- `src/middleware/services.ts` + `src/middleware/shared-deps.ts`
- `src/middleware/query-parser.ts`
- `src/middleware/timeout.ts`
- any other middleware required by the above imports

- [ ] **Step 2: Add a tiny test app helper**

Create `workers/booking-service/src/__tests__/helpers/create-test-app.ts` similar to `workers/api/src/__tests__/helpers/create-test-app.ts`, but only mounts what exists in booking-service at the time (initially just `/health`).

- [ ] **Step 3: Run tests**

```bash
bun run --filter @repo/booking-service test
```

Expected: PASS (even if only a trivial test exists).

- [ ] **Step 4: Commit**

```bash
git add workers/booking-service/src
git commit -m "chore(booking-service): port shared app factory and middleware stack"
```

---

### Task 3: Move booking core modules (services, bookings, team, staff-availability) into booking-service

**Files:**
- Move: `workers/api/src/modules/services/**` → `workers/booking-service/src/modules/services/**`
- Move: `workers/api/src/modules/bookings/**` → `workers/booking-service/src/modules/bookings/**`
- Move: `workers/api/src/modules/team/**` → `workers/booking-service/src/modules/team/**`
- Move: `workers/api/src/modules/staff-availability/**` → `workers/booking-service/src/modules/staff-availability/**`
- Modify: `workers/booking-service/src/app.ts` (mount these module routers and inject their installers)
- Modify: `workers/api/src/modules/routes.ts` (proxy `/v1/services/*`, `/v1/bookings/*`, `/v1/team/*` to `BOOKING_SERVICE` and remove the local mounts)
- Test: port corresponding test files into booking-service

- [ ] **Step 1: Port module code verbatim**

For each module above:\n\n- Copy the `index.ts` installer, routes, and service files into booking-service under `src/modules/<name>/`.\n- Ensure imports still resolve (`@repo/core` repos remain the same).\n\n- [ ] **Step 2: Add booking-service `routes.ts` equivalent (or mount in `app.ts`)**
\n+In `workers/booking-service/src/app.ts`, mount:\n+\n+```ts\n+app.route(\"/api/v1/services\", servicesApp);\n+app.route(\"/api/v1/bookings\", bookingsApp);\n+app.route(\"/api/v1/team\", teamApp);\n+app.route(\"/api/v1/team\", staffAvailabilityApp);\n+```\n+\n+and call `injectServices([...installers])` like the gateway does.\n+\n+- [ ] **Step 3: Gateway proxy + remove local mounts**\n+\n+Modify `workers/api/src/modules/routes.ts`:\n+\n+```ts\n+apiRoutes.all(\"/v1/services/*\", (c) => c.env.BOOKING_SERVICE.fetch(c.req.raw));\n+apiRoutes.all(\"/v1/services\", (c) => c.env.BOOKING_SERVICE.fetch(c.req.raw));\n+apiRoutes.all(\"/v1/bookings/*\", (c) => c.env.BOOKING_SERVICE.fetch(c.req.raw));\n+apiRoutes.all(\"/v1/bookings\", (c) => c.env.BOOKING_SERVICE.fetch(c.req.raw));\n+apiRoutes.all(\"/v1/team/*\", (c) => c.env.BOOKING_SERVICE.fetch(c.req.raw));\n+apiRoutes.all(\"/v1/team\", (c) => c.env.BOOKING_SERVICE.fetch(c.req.raw));\n+```\n+\n+and delete (or comment out temporarily during the phase) the local `route(\"/v1/services\"...)`, `route(\"/v1/bookings\"...)`, and `route(\"/v1/team\"...)` lines.\n+\n+- [ ] **Step 4: Port tests**\n+\n+Copy the corresponding `workers/api/src/__tests__/modules/<name>/` tests into `workers/booking-service/src/__tests__/modules/<name>/` and update any test-app bootstrapping imports to use booking-service helpers.\n+\n+- [ ] **Step 5: Run scoped tests**\n+\n+```bash\n+bun run api:test\n+bun run --filter @repo/booking-service test\n+```\n+\n+Expected: both PASS.\n+\n+- [ ] **Step 6: Commit**\n+\n+```bash\n+git add workers/api/src/modules/routes.ts workers/booking-service workers/api/src/modules/{services,bookings,team,staff-availability}*\n+git commit -m \"feat(booking-service): move core booking modules behind gateway proxy\"\n+```\n+\n+---\n+\n+### Task 4: Move booking feature modules (coupons, reviews, rewards, analytics, campaigns, customers)\n+\n+**Files:**\n+- Move: `workers/api/src/modules/coupons/**` → `workers/booking-service/src/modules/coupons/**`\n+- Move: `workers/api/src/modules/reviews/**` → `workers/booking-service/src/modules/reviews/**`\n+- Move: `workers/api/src/modules/rewards/**` → `workers/booking-service/src/modules/rewards/**`\n+- Move: `workers/api/src/modules/analytics/**` → `workers/booking-service/src/modules/analytics/**`\n+- Move: `workers/api/src/modules/campaigns/**` → `workers/booking-service/src/modules/campaigns/**`\n+- Move: `workers/api/src/modules/customers/**` → `workers/booking-service/src/modules/customers/**`\n+- Modify: `workers/booking-service/src/app.ts` (mount)\n+- Modify: `workers/api/src/modules/routes.ts` (proxy + remove local mounts)\n+- Test: port tests\n+\n+- [ ] **Step 1: Port modules and installers**\n+\n+Copy each module into booking-service and add its installer to the `injectServices` list.\n+\n+- [ ] **Step 2: Mount routes in booking-service**\n+\n+In `workers/booking-service/src/app.ts`:\n+\n+```ts\n+app.route(\"/api/v1/coupons\", couponsApp);\n+app.route(\"/api/v1/reviews\", reviewsApp);\n+app.route(\"/api/v1/rewards\", rewardsApp);\n+app.route(\"/api/v1/analytics\", analyticsApp);\n+app.route(\"/api/v1/campaigns\", campaignsApp);\n+app.route(\"/api/v1/customers\", customersApp);\n+```\n+\n+- [ ] **Step 3: Add gateway proxies**\n+\n+In `workers/api/src/modules/routes.ts`, proxy each prefix to `BOOKING_SERVICE` (follow the auth/lpg proxy style).\n+\n+- [ ] **Step 4: Port tests and run**\n+\n+```bash\n+bun run api:test\n+bun run --filter @repo/booking-service test\n+```\n+\n+- [ ] **Step 5: Commit**\n+\n+```bash\n+git commit -am \"feat(booking-service): proxy booking feature modules from gateway\"\n+```\n+\n+---\n+\n+### Task 5: Split `AuthorizationService` (gateway trimmed, booking-service gets booking checks)\n+\n+**Files:**\n+- Modify: `workers/api/src/core/authorization.ts`\n+- Create: `workers/booking-service/src/core/authorization.ts`\n+- Modify: booking-service installers to use its authz\n+\n+- [ ] **Step 1: Create booking-service `AuthorizationService`**\n+\n+Copy `workers/api/src/core/authorization.ts` into `workers/booking-service/src/core/authorization.ts` and keep all booking-related assertions.\n+\n+- [ ] **Step 2: Trim gateway `AuthorizationService`**\n+\n+In `workers/api/src/core/authorization.ts`, keep only:\n+- `assertBusinessOwner`\n+- `assertBranchAccess`\n+- `assertBranchOwner`\n+\n+and remove dependencies on booking-only repos (services, coupons, bookings, team, reviews).\n+\n+- [ ] **Step 3: Update dependency injection**\n+\n+Ensure `injectServices` in booking-service constructs its authz with required repos; ensure gateway injection still compiles with the trimmed constructor.\n+\n+- [ ] **Step 4: Run typecheck + tests**\n+\n+```bash\n+bun run check-types\n+bun run api:test\n+bun run --filter @repo/booking-service test\n+```\n+\n+- [ ] **Step 5: Commit**\n+\n+```bash\n+git add workers/api/src/core/authorization.ts workers/booking-service/src/core/authorization.ts\n+git commit -m \"refactor: split authorization between gateway and booking-service\"\n+```\n+\n+---\n+\n+### Task 6: Search split (gateway dispatcher, strategies move)\n+\n+**Files:**\n+- Move: `workers/api/src/modules/search/booking-strategy.ts` → `workers/booking-service/src/modules/search/booking-strategy.ts`\n+- Move: `workers/api/src/modules/search/commerce-strategy.ts` → `workers/lpg-service/src/modules/search/commerce-strategy.ts`\n+- Create: `workers/booking-service/src/modules/search/*` (index/routes/service/result)\n+- Create: `workers/lpg-service/src/modules/search/*` (index/routes/service/result)\n+- Modify: `workers/api/src/modules/routes.ts` (replace `searchApp` mount with proxy dispatcher)\n+- Test: move commerce search integration test to `lpg-service`\n+\n+- [ ] **Step 1: Implement booking-service `GET /api/v1/search`**\n+\n+Copy the `workers/api/src/modules/search/*` module into booking-service and change `SearchService.search()` to only call `bookingSearch()`.\n+\n+- [ ] **Step 2: Implement lpg-service `GET /api/v1/search`**\n+\n+Copy the same module into lpg-service and change it to only call `commerceSearch()`.\n+\n+- [ ] **Step 3: Gateway dispatcher**\n+\n+In `workers/api/src/modules/routes.ts`:\n+\n+```ts\n+apiRoutes.all(\"/v1/search/*\", (c) => {\n+  const url = new URL(c.req.url);\n+  const vertical = url.searchParams.get(\"vertical\") ?? \"booking\";\n+  return (vertical === \"commerce\" ? c.env.LPG_SERVICE : c.env.BOOKING_SERVICE).fetch(c.req.raw);\n+});\n+apiRoutes.all(\"/v1/search\", (c) => {\n+  const url = new URL(c.req.url);\n+  const vertical = url.searchParams.get(\"vertical\") ?? \"booking\";\n+  return (vertical === \"commerce\" ? c.env.LPG_SERVICE : c.env.BOOKING_SERVICE).fetch(c.req.raw);\n+});\n+```\n+\n+and remove `apiRoutes.route(\"/v1/search\", searchApp)`.\n+\n+- [ ] **Step 4: Port the commerce integration test**\n+\n+Move `workers/api/src/__tests__/modules/search/commerce-strategy.integration.test.ts` into `workers/lpg-service/src/__tests__/modules/search/commerce-strategy.integration.test.ts` and update imports.\n+\n+- [ ] **Step 5: Run tests**\n+\n+```bash\n+bun run api:test\n+bun run --filter @repo/booking-service test\n+bun run --filter @repo/lpg-service test\n+```\n+\n+- [ ] **Step 6: Commit**\n+\n+```bash\n+git commit -am \"feat: split search by vertical across booking-service and lpg-service\"\n+```\n+\n+---\n+\n+### Task 7: Walk-in split (gateway dispatcher, booking walk-in → booking-service, commerce walk-in → lpg-service)\n+\n+**Files:**\n+- Split: `workers/api/src/modules/walk-in/*`\n+- Create: `workers/booking-service/src/modules/walk-in/*` (booking-only)\n+- Create: `workers/lpg-service/src/modules/walk-in/*` (commerce-only)\n+- Modify: `workers/api/src/modules/routes.ts` (replace mount with dispatcher)\n+- Modify: `workers/api` and/or shared KV usage for `branch:<id>:vertical`\n+- Tests: port to both workers + gateway dispatcher tests\n+\n+- [ ] **Step 1: Extract booking walk-in into booking-service**\n+\n+Start from `workers/api/src/modules/walk-in/*` and remove commerce-specific dependencies:\n+- drop `productsRepo`, `ordersRepo`, `ordersService`\n+- keep booking submit path and `notification.booking_created` queue push\n+- keep sessions + QR signing (KV + `JWT_SECRET`)\n+\n+- [ ] **Step 2: Extract commerce walk-in into lpg-service**\n+\n+Port only commerce-specific bits:\n+- context snapshot uses products\n+- submit uses `OrdersService.createCounterWalkIn`\n+- sessions + QR signing (KV + `JWT_SECRET`)\n+\n+- [ ] **Step 3: Implement gateway vertical resolver**\n+\n+In `workers/api` add a small helper (new file) to resolve `branchId → vertical` using D1 with KV caching:\n+\n+Cache key: `branch:${branchId}:vertical` TTL 300 seconds.\n+\n+- [ ] **Step 4: Gateway dispatcher routes**\n+\n+Replace `apiRoutes.route(\"/v1/walk-in\", walkInApp)` with:\n+- `/v1/walk-in/context` → route by `branchId`\n+- `/v1/walk-in/submit` → route by `branchId` and validate body vertical matches\n+- `/v1/walk-in/sync` → split entries by vertical and call both workers; merge `{ synced }`\n+- `/v1/walk-in/branch-qr` and `/sessions` → route by `branchId`\n+- `/v1/walk-in/receipts` → call both workers and merge `{ bookings, orders }`\n+\n+- [ ] **Step 5: Port tests**\n+\n+Move walk-in service tests from `workers/api` into booking-service and lpg-service with the split coverage. Add a new gateway test file validating fan-in/fan-out behaviour.\n+\n+- [ ] **Step 6: Run tests**\n+\n+```bash\n+bun run api:test\n+bun run --filter @repo/booking-service test\n+bun run --filter @repo/lpg-service test\n+```\n+\n+- [ ] **Step 7: Commit**\n+\n+```bash\n+git commit -am \"feat: split walk-in by vertical with gateway dispatch\"\n+```\n+\n+---\n+\n+### Task 8: Docs + dev-all integration\n+\n+**Files:**\n+- Modify: `scripts/dev-all.ts` (add booking-service)\n+- Modify: `docs/architecture.md`\n+- Modify: `docs/guides/api-endpoints.md`\n+- Modify: `workers/api/CLAUDE.md`\n+- Modify: `workers/lpg-service/CLAUDE.md`\n+- Create: `workers/booking-service/CLAUDE.md`\n+\n+- [ ] **Step 1: Add booking-service to `dev:all`**\n+\n+Update `scripts/dev-all.ts` to start `booking-service` alongside api/auth/lpg.\n+\n+- [ ] **Step 2: Update docs**\n+\n+- `docs/architecture.md`: add `booking-service` to the diagram and narrative.\n+- `docs/guides/api-endpoints.md`: annotate booking prefixes as served by booking-service behind gateway.\n+- `workers/api/CLAUDE.md`: describe new booking proxies + search/walk-in dispatch.\n+- `workers/lpg-service/CLAUDE.md`: document commerce search + walk-in.\n+- `workers/booking-service/CLAUDE.md`: responsibilities, auth pattern, module layout, local dev.\n+\n+- [ ] **Step 3: Full checks**\n+\n+```bash\n+bun run lint\n+bun run check-types\n+bun run test\n+bun run build\n+```\n+\n+- [ ] **Step 4: Commit**\n+\n+```bash\n+git commit -am \"docs/dev: document booking-service split and wire into dev-all\"\n+```\n+\n+---\n+\n+## Plan self-review (run after writing code)\n+\n+- **Spec coverage:** confirm each spec section has matching implemented tasks.\n+- **No placeholders:** ensure tasks did not skip code/test specifics.\n+- **Type consistency:** ensure bindings and route prefixes are consistent (`BOOKING_SERVICE`, `talash-booking-service`, `/api/v1/*`).\n+\n+## Execution handoff\n+\n+Plan complete and saved to `docs/superpowers/plans/2026-06-16-booking-service-split.md`.\n+\n+Two execution options:\n+\n+1. **Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks\n+2. **Inline Execution** - execute tasks in this session with checkpoints\n+\n+Which approach?\n+
