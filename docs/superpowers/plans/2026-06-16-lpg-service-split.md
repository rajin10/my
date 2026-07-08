# LPG-service split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split commerce (LPG) API modules into `workers/lpg-service` while keeping `workers/api` as the public gateway and preserving all existing `/api/v1/products|orders|customer-addresses|payments|khata` contracts for frontends.

**Architecture:** `workers/api` proxies the five commerce prefixes to `workers/lpg-service` via Cloudflare Service Bindings (`LPG_SERVICE`). `lpg-service` verifies JWT locally, calls `auth-service` `POST /internal/authorise` for role/branch scope (same pattern as the gateway), and runs commerce services against shared D1 via `@repo/core`.

**Tech Stack:** Cloudflare Workers + Hono, Drizzle/D1, R2, Queues, Service Bindings, Vitest.

**Design spec:** [../specs/2026-06-16-lpg-service-split-design.md](../specs/2026-06-16-lpg-service-split-design.md)

---

## File structure (planned)

### `workers/lpg-service/` (new worker)

- Create: `workers/lpg-service/wrangler.jsonc`
- Create: `workers/lpg-service/package.json`
- Create: `workers/lpg-service/src/index.ts`
- Create: `workers/lpg-service/src/app.ts`
- Create: `workers/lpg-service/src/types.ts`
- Create: `workers/lpg-service/src/core/**` (copied/adapted from api worker)
- Create: `workers/lpg-service/src/middleware/**` (auth, auth-guard with branchScope, cors, exceptions, services, etc.)
- Create: `workers/lpg-service/src/modules/products/**` (ported from api)
- Create: `workers/lpg-service/src/modules/orders/**` (ported from api)
- Create: `workers/lpg-service/src/modules/customer-addresses/**` (ported from api)
- Create: `workers/lpg-service/src/modules/payments/**` (ported from api)
- Create: `workers/lpg-service/src/modules/khata/**` (ported from api)
- Create: `workers/lpg-service/CLAUDE.md`
- Tests: `workers/lpg-service/src/__tests__/**` (ported from api commerce tests)

### `workers/api/` (gateway)

- Modify: `workers/api/wrangler.jsonc` (add `LPG_SERVICE` binding per env)
- Modify: `workers/api/src/modules/routes.ts` (proxy commerce prefixes; remove commerce installers/routes as each phase lands)
- Modify: `workers/api/src/middleware/services.ts` (drop commerce repos when all modules moved)
- Modify: `workers/api/src/core/authorization.ts` (trim commerce-only methods in final cleanup)
- Delete (after port): `workers/api/src/modules/{products,orders,customer-addresses,payments,khata}/**`
- Delete (after port): `workers/api/src/__tests__/modules/{products,orders,...}/**`
- Create: `workers/api/src/__tests__/modules/gateway-lpg-proxy.test.ts`
- Modify: `workers/api/CLAUDE.md`

### Root / dev tooling

- Modify: `package.json` (add `lpg-service:dev`, `deploy:lpg-service`, extend `deploy:workers`)
- Modify: `scripts/dev/constants.ts` (add auth-service + lpg-service to `DEV_SERVICES`)
- Modify: `docs/architecture.md`, `docs/guides/api-endpoints.md`, `AGENTS.md`

---

## Task 1: Isolated worktree + baseline checks

**Files:** none

- [ ] **Step 1: Create worktree from `develop`**

```bash
cd "/Users/hasib/Documents/Talash/monorepo"
git fetch origin
git worktree add ../talash-lpg-service-split -b chore/lpg-service-split develop
cd ../talash-lpg-service-split
```

- [ ] **Step 2: Install deps**

```bash
bun install
```

- [ ] **Step 3: Baseline verification**

```bash
bun run lint
bun run test
bun run build
```

Expected: all pass before any changes.

---

## Task 2: Scaffold `workers/lpg-service`

**Files:**
- Create: `workers/lpg-service/**` (Cloudflare scaffold)
- Modify: `workers/lpg-service/wrangler.jsonc`
- Modify: `workers/lpg-service/package.json`

- [ ] **Step 1: Create worker scaffold**

```bash
cd workers
npm create cloudflare@latest -- lpg-service -- --type hello-world --ts true --deploy false
```

- [ ] **Step 2: Set `workers/lpg-service/package.json`**

```json
{
  "name": "@repo/lpg-service",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev --env local",
    "start": "wrangler dev --env local",
    "deploy": "wrangler deploy --env staging --minify",
    "deploy:staging": "wrangler deploy --env staging --minify",
    "deploy:production": "wrangler deploy --env production --minify",
    "cf-typegen": "wrangler types --env-interface CloudflareBindings",
    "lint": "biome check .",
    "format": "biome format . --write",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@repo/core": "workspace:*",
    "@hono/zod-openapi": "^1.4.0",
    "hono": "^4.12.23",
    "qs": "^6.15.2",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "vitest": "^4.1.8",
    "@cloudflare/workers-types": "^4.20260413.1",
    "@types/node": "^25.6.0",
    "@types/qs": "^6.15.1",
    "wrangler": "^4.81.1"
  }
}
```

- [ ] **Step 3: Configure `workers/lpg-service/wrangler.jsonc`**

Mirror `workers/auth-service/wrangler.jsonc` structure. Minimum `env.local`:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "talash-lpg-service",
  "main": "src/index.ts",
  "compatibility_date": "2026-05-26",
  "account_id": "e24dc81d9dd498a4f9a012836121167b",
  "compatibility_flags": ["nodejs_compat"],
  "observability": { "enabled": true },
  "env": {
    "local": {
      "vars": {
        "ENVIRONMENT": "development",
        "PUBLIC_R2_URL": "storage.talash.bd",
        "ALLOWED_ORIGINS": "http://localhost:3000,http://localhost:3001",
        "JWT_SECRET": "a94db32b-08ec-4cbc-9795-a17aa55ca685"
      },
      "d1_databases": [
        {
          "binding": "TALASH_DB",
          "database_name": "talash-db-local",
          "database_id": "00000000-0000-0000-0000-000000000000",
          "migrations_dir": "../api/src/database/migrations",
          "migrations_table": "migrations",
          "remote": false
        }
      ],
      "r2_buckets": [
        { "bucket_name": "talash-storage-local", "binding": "TALASH_STORAGE", "remote": false }
      ],
      "queues": {
        "producers": [{ "binding": "TALASH_QUEUE", "queue": "talash-queue-local" }]
      },
      "services": [
        { "binding": "AUTH_SERVICE", "service": "talash-auth-service" }
      ]
    }
  }
}
```

**Critical:** `JWT_SECRET` in `env.local` must match `workers/api/wrangler.jsonc` and `workers/auth-service/wrangler.jsonc`.

Add `staging` and `production` env blocks mirroring `workers/api/wrangler.jsonc` bindings (D1, R2, Queue, AUTH_SERVICE) before deploy.

- [ ] **Step 4: Create minimal app shell**

`workers/lpg-service/src/index.ts`:

```ts
import app from "./app";

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
```

`workers/lpg-service/src/app.ts`:

```ts
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { createApp } from "./core/create-app";
import { corsMiddleware } from "./middleware/cors";
import { errorHandler, notFoundHandler } from "./middleware/exceptions";
import { queryParserMiddleware } from "./middleware/query-parser";
import { requestTimeout } from "./middleware/timeout";

const app = createApp({ strict: false });

app.use("*", requestId());
app.use("*", logger());
app.use("*", secureHeaders({ crossOriginResourcePolicy: "cross-origin" }));
app.use("*", corsMiddleware);
app.use("*", queryParserMiddleware);
app.use("/api/*", requestTimeout(15_000));

app.get("/health", async (c) => {
  try {
    await c.env.TALASH_DB.prepare("SELECT 1").first();
    return c.json({ status: "ok", db: "ok" });
  } catch {
    return c.json({ status: "error", db: "unavailable" }, 503);
  }
});

app.notFound(notFoundHandler);
app.onError(errorHandler);

export default app;
```

`workers/lpg-service/src/types.ts`:

```ts
import type { AuthUser } from "./modules/auth/session-tokens";

export type Env = CloudflareBindings;

export type AppEnv = {
  Bindings: CloudflareBindings;
  Variables: {
    user?: AuthUser;
    scopedBranchIds?: string[] | null;
    parsedQuery?: unknown;
    requestId?: string;
    authz: import("./core/authorization").AuthorizationService;
    productsService: import("./modules/products/products.service").ProductsService;
    ordersService: import("./modules/orders/orders.service").OrdersService;
    customerAddressesService: import("./modules/customer-addresses/customer-addresses.service").CustomerAddressesService;
    paymentsService: import("./modules/payments/payments.service").PaymentsService;
    khataService: import("./modules/khata/khata.service").KhataService;
  };
};
```

(Trim unused `Variables` entries until each module is ported.)

- [ ] **Step 5: Run typegen**

```bash
cd workers/lpg-service
bun run cf-typegen
bun install
```

- [ ] **Step 6: Commit**

```bash
git add workers/lpg-service
git commit -m "chore(lpg-service): scaffold Talash commerce worker"
```

---

## Task 3: Shared core, middleware, and commerce authz

**Files:**
- Create: `workers/lpg-service/src/core/create-app.ts` (copy from api)
- Create: `workers/lpg-service/src/core/errors.ts` (copy from api)
- Create: `workers/lpg-service/src/core/http/validation.ts` (copy from api)
- Create: `workers/lpg-service/src/core/http/query-parse.ts` (copy from api if needed)
- Create: `workers/lpg-service/src/core/storage/r2.ts` (copy from api)
- Create: `workers/lpg-service/src/core/storage/image-upload.ts` (copy from api)
- Create: `workers/lpg-service/src/core/authorization.ts` (commerce-only subset)
- Create: `workers/lpg-service/src/middleware/cors.ts`, `exceptions.ts`, `query-parser.ts`, `timeout.ts`, `auth.ts`, `auth-guard.ts`, `services.ts`, `shared-deps.ts`
- Create: `workers/lpg-service/src/modules/auth/session-tokens.ts` (copy verify path from auth-service)

- [ ] **Step 1: Copy shared files from `workers/api/src/`**

Copy verbatim:

```text
core/create-app.ts
core/errors.ts
core/http/validation.ts
core/storage/r2.ts
core/storage/image-upload.ts
middleware/cors.ts
middleware/exceptions.ts
middleware/query-parser.ts
middleware/timeout.ts
```

Copy `workers/auth-service/src/modules/auth/session-tokens.ts` → `workers/lpg-service/src/modules/auth/session-tokens.ts` (JWT verify + `AuthUser` type only — no issue/rotate needed).

Copy `workers/api/src/middleware/auth.ts` → `workers/lpg-service/src/middleware/auth.ts` (update import to local `session-tokens`).

Copy `workers/api/src/middleware/auth-guard.ts` → `workers/lpg-service/src/middleware/auth-guard.ts` unchanged (uses `c.env.AUTH_SERVICE` for branchScope).

- [ ] **Step 2: Create commerce-scoped `AuthorizationService`**

Create `workers/lpg-service/src/core/authorization.ts` with only:

```ts
export class AuthorizationService {
  constructor(
    private readonly businessesRepo: BusinessesRepository,
    private readonly branchesRepo: BranchesRepository,
    private readonly productsRepo: ProductsRepository,
    private readonly ordersRepo: OrdersRepository,
    private readonly customerAddressesRepo: CustomerAddressesRepository,
  ) {}

  async assertBusinessOwner(actorId: string, businessId: string): Promise<BusinessSelect> { /* copy from api */ }
  async assertBranchAccess(actorId: string, branchId: string, scopedBranchIds: string[] | null): Promise<void> { /* copy */ }
  async assertProductAccess(actorId: string, productId: string, scopedBranchIds: string[] | null): Promise<ProductSelect> { /* copy */ }
  async assertOrderAccess(actorId: string, orderId: string, scopedBranchIds: string[] | null): Promise<OrderSelect> { /* copy */ }
  async assertCustomerOwnsOrder(userId: string, orderId: string): Promise<OrderSelect> { /* copy */ }
  async assertCustomerOwnsAddress(userId: string, addressId: string): Promise<CustomerAddressSelect> { /* copy */ }
}
```

Source: `workers/api/src/core/authorization.ts` lines 46–193 (commerce methods only).

- [ ] **Step 3: Create `shared-deps.ts` and `injectServices`**

`workers/lpg-service/src/middleware/shared-deps.ts`:

```ts
import type { getDB } from "@repo/core/src/database/client";
import type { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import type { BusinessesRepository } from "@repo/core/src/database/repositories/businesses.repository";
import type { CustomerAddressesRepository } from "@repo/core/src/database/repositories/customer-addresses.repository";
import type { KhataRepository } from "@repo/core/src/database/repositories/khata.repository";
import type { OrdersRepository } from "@repo/core/src/database/repositories/orders.repository";
import type { PaymentsRepository } from "@repo/core/src/database/repositories/payments.repository";
import type { ProductsRepository } from "@repo/core/src/database/repositories/products.repository";
import type { QueueProducer } from "@repo/core/src/queue/producer";
import type { Context } from "hono";
import type { AuthorizationService } from "../core/authorization";
import type { R2Storage } from "../core/storage/r2";
import type { AppEnv } from "../types";

export interface SharedDeps {
  db: ReturnType<typeof getDB>;
  queue: QueueProducer;
  storage: R2Storage;
  authz: AuthorizationService;
  env: CloudflareBindings;
  businessesRepo: BusinessesRepository;
  branchesRepo: BranchesRepository;
  productsRepo: ProductsRepository;
  ordersRepo: OrdersRepository;
  customerAddressesRepo: CustomerAddressesRepository;
  paymentsRepo: PaymentsRepository;
  khataRepo: KhataRepository;
}

export type ServiceInstaller = (c: Context<AppEnv>, deps: SharedDeps) => void;
```

`workers/lpg-service/src/middleware/services.ts` — mirror `workers/api/src/middleware/services.ts` but only commerce repos + `QueueProducer` + `R2Storage`; set `c.set("authz", deps.authz)`.

- [ ] **Step 4: Add vitest config**

Copy `workers/auth-service/vitest.config.ts` and `src/__tests__/setup.ts` pattern; add cloudflare-workers mock if needed.

- [ ] **Step 5: Commit**

```bash
git add workers/lpg-service/src
git commit -m "chore(lpg-service): add shared core, middleware, and commerce authz"
```

---

## Task 4: Port `products` module + gateway proxy (Phase 1)

**Files:**
- Create: `workers/lpg-service/src/modules/products/**`
- Modify: `workers/lpg-service/src/app.ts`
- Modify: `workers/api/wrangler.jsonc` (add `LPG_SERVICE`)
- Modify: `workers/api/src/modules/routes.ts`
- Move tests: `workers/api/src/__tests__/modules/products/**` → `workers/lpg-service/src/__tests__/modules/products/**`

- [ ] **Step 1: Port products module**

Copy from `workers/api/src/modules/products/`:

```text
index.ts
products.service.ts
```

Update imports to `lpg-service` paths (`../../core/...`, `../../middleware/...`). No logic changes.

- [ ] **Step 2: Mount products in lpg-service app**

In `workers/lpg-service/src/app.ts`:

```ts
import { injectServices } from "./middleware/services";
import { installProductsService, productsApp } from "./modules/products";

app.use("*", injectServices([installProductsService]));
app.route("/api/v1/products", productsApp);
```

- [ ] **Step 3: Port products tests**

Move and fix import paths:

```text
products.routes.test.ts
products.service.test.ts
```

Run:

```bash
cd workers/lpg-service
bun run test
```

Expected: products tests pass.

- [ ] **Step 4: Add gateway `LPG_SERVICE` binding**

In `workers/api/wrangler.jsonc`, each env block (`local`, `staging`, `production`), add alongside `AUTH_SERVICE`:

```jsonc
{ "binding": "LPG_SERVICE", "service": "talash-lpg-service" }
```

Run `bun run api:cf-typegen` from repo root.

- [ ] **Step 5: Proxy products routes in gateway**

In `workers/api/src/modules/routes.ts`, add before `apiRoutes.route("/v1/products", ...)`:

```ts
apiRoutes.all("/v1/products/*", (c) => c.env.LPG_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/products", (c) => c.env.LPG_SERVICE.fetch(c.req.raw));
```

Then **remove**:

```ts
import { installProductsService, productsApp } from "./products";
// from serviceInstallers: installProductsService
apiRoutes.route("/v1/products", productsApp);
```

Delete `workers/api/src/modules/products/` and api products tests.

- [ ] **Step 6: Manual smoke test (three terminals)**

```bash
bun run --filter @repo/auth-service dev
bun run --filter @repo/lpg-service dev
bun run api:dev
```

```bash
curl -s "http://localhost:8787/api/v1/products?branchId=<id>" | head
```

Expected: same JSON shape as before (raw `Product[]` for list).

- [ ] **Step 7: Commit**

```bash
git add workers/lpg-service workers/api
git commit -m "feat(lpg-service): move products module behind gateway proxy"
```

---

## Task 5: Port `orders` + `customer-addresses` (Phase 2)

**Files:**
- Create: `workers/lpg-service/src/modules/orders/**`, `customer-addresses/**`
- Modify: `workers/lpg-service/src/app.ts`, `middleware/services.ts`, `types.ts`
- Modify: `workers/api/src/modules/routes.ts`, `middleware/services.ts`
- Move tests for both modules

- [ ] **Step 1: Port modules**

Copy unchanged from api:

```text
modules/orders/index.ts
modules/orders/orders.service.ts
modules/customer-addresses/index.ts
modules/customer-addresses/customer-addresses.service.ts
```

Ensure `installOrdersService` wires `QueueProducer` from `SharedDeps.queue` (6th constructor arg — same as api).

- [ ] **Step 2: Mount routes in lpg-service**

```ts
app.use("*", injectServices([
  installProductsService,
  installOrdersService,
  installCustomerAddressesService,
]));
app.route("/api/v1/orders", ordersApp);
app.route("/api/v1/customer-addresses", customerAddressesApp);
```

- [ ] **Step 3: Port and run tests**

Move:

```text
__tests__/modules/orders/orders.service.test.ts
__tests__/modules/orders/orders.routes.test.ts
__tests__/modules/orders/orders.repository.integration.test.ts
__tests__/modules/customer-addresses/customer-addresses.service.test.ts
__tests__/modules/customer-addresses/customer-addresses.routes.test.ts
```

```bash
cd workers/lpg-service && bun run test
```

Expected: all order + address tests pass (integration test uses in-memory SQLite).

- [ ] **Step 4: Gateway proxy + remove from api**

Add to `workers/api/src/modules/routes.ts`:

```ts
apiRoutes.all("/v1/orders/*", (c) => c.env.LPG_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/orders", (c) => c.env.LPG_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/customer-addresses/*", (c) => c.env.LPG_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/customer-addresses", (c) => c.env.LPG_SERVICE.fetch(c.req.raw));
```

Remove orders + customer-addresses installers, routes, and module directories from api.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(lpg-service): move orders and customer-addresses behind gateway"
```

---

## Task 6: Port `payments` + `khata` (Phase 3)

**Files:** same pattern as Task 5

- [ ] **Step 1: Port modules**

```text
modules/payments/index.ts
modules/payments/payments.service.ts
modules/khata/index.ts
modules/khata/khata.service.ts
```

- [ ] **Step 2: Mount + port tests**

Move:

```text
__tests__/modules/payments/payments.service.test.ts
__tests__/modules/payments/payments.routes.test.ts
__tests__/modules/khata/khata.service.test.ts
__tests__/modules/khata/khata.routes.test.ts
__tests__/modules/khata/khata.repository.integration.test.ts
```

```bash
cd workers/lpg-service && bun run test
```

- [ ] **Step 3: Gateway proxy + remove from api**

```ts
apiRoutes.all("/v1/payments/*", (c) => c.env.LPG_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/payments", (c) => c.env.LPG_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/khata/*", (c) => c.env.LPG_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/khata", (c) => c.env.LPG_SERVICE.fetch(c.req.raw));
```

Remove payments + khata from api routes/installers/modules/tests.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(lpg-service): move payments and khata behind gateway"
```

---

## Task 7: Gateway proxy parity tests

**Files:**
- Create: `workers/api/src/__tests__/modules/gateway-lpg-proxy.test.ts`

- [ ] **Step 1: Write proxy test with mocked LPG_SERVICE**

```ts
import { describe, expect, it, vi } from "vitest";
import apiRoutes from "../../modules/routes";

describe("gateway LPG proxy", () => {
  it("forwards GET /api/v1/products to LPG_SERVICE unchanged", async () => {
    const body = [{ id: "p1", name: "Cylinder", branchId: "b1", price: 1200, stock: 5 }];
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const res = await apiRoutes.request("/api/v1/products?branchId=b1", {
      headers: { host: "localhost" },
    }, {
      LPG_SERVICE: { fetch: fetchMock },
      TALASH_DB: {} as D1Database,
      // ... minimal env for middleware
    } as CloudflareBindings);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(body);
  });
});
```

Adapt using `createTestApp` helpers from `workers/api/src/__tests__/helpers/` if the raw env stub is insufficient — goal is one test per commerce prefix verifying status + body pass-through.

- [ ] **Step 2: Run api tests**

```bash
bun run --filter @repo/api test
```

- [ ] **Step 3: Commit**

```bash
git commit -m "test(api): add gateway LPG proxy parity tests"
```

---

## Task 8: Trim api worker + dev tooling

**Files:**
- Modify: `workers/api/src/core/authorization.ts`
- Modify: `workers/api/src/middleware/services.ts`
- Modify: `package.json`, `scripts/dev/constants.ts`
- Modify: `docs/architecture.md`, `docs/guides/api-endpoints.md`, `AGENTS.md`, `workers/api/CLAUDE.md`
- Create: `workers/lpg-service/CLAUDE.md`

- [ ] **Step 1: Trim api `AuthorizationService`**

Remove commerce-only methods no longer called from api:

- `assertProductAccess`
- `assertOrderAccess`
- `assertCustomerOwnsOrder`
- `assertCustomerOwnsAddress`

Remove unused constructor deps (`productsRepo`, `ordersRepo`, `customerAddressesRepo`) if nothing else needs them. Run `bun run --filter @repo/api test` — fix any broken imports.

- [ ] **Step 2: Slim api `injectServices`**

Drop `productsRepo`, `ordersRepo`, `customerAddressesRepo`, `paymentsRepo`, `khataRepo` from `SharedDeps` if no remaining api module uses them.

- [ ] **Step 3: Add root dev scripts**

In root `package.json`:

```json
"lpg-service:dev": "bun run --filter @repo/lpg-service dev",
"auth-service:dev": "bun run --filter @repo/auth-service dev",
"deploy:lpg-service": "bun run --filter @repo/lpg-service deploy:staging",
"deploy:workers": "turbo run deploy --filter=@repo/api --filter=@repo/auth-service --filter=@repo/lpg-service --filter=@repo/queue --filter=@repo/scheduled"
```

In `scripts/dev/constants.ts`, add before `api`:

```ts
{
  key: "auth-service",
  label: "Auth service",
  command: ["bun", "run", "auth-service:dev"],
  prefix: "auth",
},
{
  key: "lpg-service",
  label: "LPG service",
  command: ["bun", "run", "lpg-service:dev"],
  prefix: "lpg",
},
```

- [ ] **Step 4: Update documentation**

- `docs/architecture.md` — add `lpg-service` to layout table and request-path section (mirror auth-service split notes).
- `docs/guides/api-endpoints.md` — note commerce routes served by lpg-service behind gateway.
- `workers/lpg-service/CLAUDE.md` — responsibilities, bindings, local dev (three workers), module list.
- `workers/api/CLAUDE.md` — gateway proxy list for commerce prefixes.
- `AGENTS.md` — add `workers/lpg-service` to layout table and dev commands.

Update design spec status:

```markdown
- **Status:** Implemented on `develop` (YYYY-MM-DD)
```

- [ ] **Step 5: Full verification**

```bash
bun run lint
bun run test
bun run build
```

- [ ] **Step 6: Commit**

```bash
git commit -m "chore: wire lpg-service into dev stack and update docs"
```

---

## Spec coverage checklist (self-review)

| Spec requirement | Task |
| --- | --- |
| Five commerce modules in lpg-service | Tasks 4–6 |
| Gateway proxy, unchanged client paths | Tasks 4–6 |
| Local JWT + auth-service authorise | Task 3 |
| Shared D1 | Task 2 wrangler |
| TALASH_STORAGE, TALASH_QUEUE bindings | Task 2 wrangler |
| products.list raw array parity | Task 4 smoke test |
| Phased reversible migration | Tasks 4–6 (one commit per phase) |
| Proxy parity tests | Task 7 |
| dev:all / local three-worker note | Task 8 |
| Documentation updates | Task 8 |
| Trim api AuthorizationService | Task 8 |

No TBD placeholders. All commerce test files accounted for.

---

## Local dev reference

```sh
bun run api:dev                         # gateway :8787
bun run auth-service:dev                # authorise
bun run lpg-service:dev                 # commerce modules
```

Commerce flows (product list, checkout, owner fulfilment, khata) require all three workers running.
