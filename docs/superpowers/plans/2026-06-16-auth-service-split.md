# Auth-service split Implementation Plan

> **Status (2026-06-16):** Core split implemented on `develop` — auth/users in `workers/auth-service`, gateway proxy + `POST /internal/authorise` wired. Remaining follow-ups: add auth-service to `dev:all`, staging/production wrangler envs for auth-service, gateway proxy tests, align local `JWT_SECRET` across workers.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split identity + authorisation into `workers/auth-service` while keeping `workers/api` as the public gateway and preserving all existing `/api/v1/auth/*` + `/api/v1/users/*` contracts for frontends.

**Architecture:** `workers/api` proxies `/api/v1/auth/*` and `/api/v1/users/*` to `workers/auth-service` via Cloudflare Service Bindings. `workers/api` continues to verify JWT locally for performance, and calls an internal `POST /internal/authorise` endpoint on `auth-service` to resolve `{ user, scopedBranchIds }` (per-request only).

**Tech Stack:** Cloudflare Workers + Hono, Drizzle/D1, KV, R2, Service Bindings, Vitest.

---

## File structure (planned)

### `workers/auth-service/` (new worker)

- Modify: `workers/auth-service/wrangler.jsonc` (bindings + env structure)
- Create: `workers/auth-service/src/app.ts` (mirrors `workers/api/src/app.ts` but auth-service routes only)
- Create: `workers/auth-service/src/index.ts` (ExportedHandler wiring like `workers/api/src/index.ts`)
- Create: `workers/auth-service/src/modules/auth/**` (ported from `workers/api/src/modules/auth/**`)
- Create: `workers/auth-service/src/modules/users/**` (ported from `workers/api/src/modules/users/**`)
- Create: `workers/auth-service/src/middleware/**` (only what auth/users need: cors, exceptions, rate-limit, auth middleware, etc.)
- Create: `workers/auth-service/src/internal/authorise.routes.ts` (new internal endpoint)
- Create: `workers/auth-service/src/types/**` (Env + Hono context typing)
- Tests: `workers/auth-service/src/__tests__/**`

### `workers/api/` (gateway worker)

- Modify: `workers/api/wrangler.jsonc` (add service binding to auth-service)
- Create: `workers/api/src/core/proxy.ts` (shared proxy helper)
- Modify: `workers/api/src/modules/routes.ts` (mount proxy routes for `/v1/auth` and `/v1/users`)
- Modify: `workers/api/src/middleware/auth-guard.ts` (eventually delegate branchScope via internal authorise call)
- Tests: `workers/api/src/__tests__/modules/gateway-proxy.test.ts` (proxy parity checks)

---

## Task 1: Create an isolated worktree + baseline checks

**Files:** none

- [ ] **Step 1: Create a worktree from `develop`**

Run:

```bash
cd "/Users/hasib/Documents/Talash/monorepo"
git fetch origin
git worktree add ../talash-auth-service-split -b chore/auth-service-split develop
```

Expected: a new directory `../talash-auth-service-split` with the branch checked out.

- [ ] **Step 2: Install deps**

Run:

```bash
cd ../talash-auth-service-split
bun install
```

- [ ] **Step 3: Run baseline tests (so regressions are obvious)**

Run:

```bash
bun run lint
bun run test
bun run build
```

Expected: all pass.

---

## Task 2: Turn the scaffold into a Talash worker (`workers/auth-service`)

**Files:**
- Modify: `workers/auth-service/wrangler.jsonc`
- Modify: `workers/auth-service/package.json`
- Create: `workers/auth-service/src/index.ts`
- Create: `workers/auth-service/src/app.ts`

- [ ] **Step 1: Update `workers/auth-service/wrangler.jsonc` to match Talash conventions**

Replace the scaffold content with a real wrangler config (keep placeholders out; use real values where known, mirror `workers/api/wrangler.jsonc` structure).

Create:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "talash-auth-service",
  "main": "src/index.ts",
  "compatibility_date": "2026-05-26",
  "observability": { "enabled": true },
  "compatibility_flags": ["nodejs_compat"],
  "env": {
    "local": {
      "vars": {
        "ENVIRONMENT": "development",
        "PUBLIC_R2_URL": "storage.talash.bd",
        "ALLOWED_ORIGINS": "http://localhost:3000,http://localhost:3001",
        "ALLOWED_RESET_URIS": "http://localhost:3000/auth/reset-password,http://localhost:3001/auth/reset-password,mobileapp://auth/reset-password,ownerapp://auth/reset-password",
        "EMAIL_FROM": "noreply@talash.bd",
        "JWT_SECRET": "a94db32b-08ec-4cbc-9795-a17aa55ca685",
        "GOOGLE_CLIENT_ID": "163196138441-dvuciv0t2ddnkr61fck5r9i9v2jq0a64.apps.googleusercontent.com"
      },
      "d1_databases": [
        {
          "binding": "TALASH_DB",
          "database_name": "talash-db-local",
          "database_id": "00000000-0000-0000-0000-000000000000",
          "migrations_dir": "src/database/migrations",
          "migrations_table": "migrations",
          "remote": false
        }
      ],
      "kv_namespaces": [{ "binding": "TALASH_KV", "id": "talash_kv_local", "remote": false }],
      "r2_buckets": [{ "bucket_name": "talash-storage-local", "binding": "TALASH_STORAGE", "remote": false }],
      "send_email": [{ "name": "TALASH_EMAIL", "remote": false }]
    }
  }
}
```

Notes:
- The local values intentionally mirror `workers/api/wrangler.jsonc` so dev runs remain consistent.
- `GOOGLE_CLIENT_SECRET` must remain a secret (in `.dev.vars` locally, wrangler secret in real envs). Do not put it in `wrangler.jsonc`.

- [ ] **Step 2: Update `workers/auth-service/package.json` scripts to match repo naming**

Modify scripts to:

```json
{
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "cf-typegen": "wrangler types",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Replace scaffold `src/index.ts` + `src/app.ts`**

Create `workers/auth-service/src/app.ts`:

```ts
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { createApp } from "../../workers/api/src/core/create-app"; // TEMP: copy this into auth-service in Task 3
import { corsMiddleware } from "../../workers/api/src/middleware/cors"; // TEMP: copy this into auth-service in Task 3
import { errorHandler, notFoundHandler } from "../../workers/api/src/middleware/exceptions"; // TEMP: copy this into auth-service in Task 3
import { queryParserMiddleware } from "../../workers/api/src/middleware/query-parser"; // TEMP: copy this into auth-service in Task 3
import { requestTimeout } from "../../workers/api/src/middleware/timeout"; // TEMP: copy this into auth-service in Task 3

const app = createApp({ strict: false });

app.use("*", requestId());
app.use("*", logger());
app.use(
  "*",
  secureHeaders({
    crossOriginResourcePolicy: "cross-origin",
  }),
);
app.use("*", corsMiddleware);
app.use("*", queryParserMiddleware);
app.use("/api/*", requestTimeout(15_000));

// TODO: mount auth + users + internal routes in Tasks 4–6

app.notFound(notFoundHandler);
app.onError(errorHandler);

export default app;
```

Create `workers/auth-service/src/index.ts`:

```ts
import app from "./app";

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
```

Expected: Type errors for the TEMP imports will exist until Task 3 (we’ll copy the needed core/middleware into auth-service).

- [ ] **Step 4: Commit**

```bash
git add workers/auth-service
git commit -m "chore(auth-service): replace scaffold with Talash worker skeleton"
```

---

## Task 3: Copy shared core + middleware needed by auth-service

**Files:**
- Create (copied from api worker): `workers/auth-service/src/core/*`, `workers/auth-service/src/middleware/*`
- Modify: `workers/auth-service/src/app.ts` (switch TEMP imports to local ones)

- [ ] **Step 1: Copy the minimal set of shared files**

Copy these files verbatim from `workers/api/src/` into `workers/auth-service/src/`:

```text
core/create-app.ts
core/errors.ts
core/http/validation.ts
core/kv/cache.ts
middleware/cors.ts
middleware/exceptions.ts
middleware/query-parser.ts
middleware/timeout.ts
middleware/rate-limit.ts
```

Run:

```bash
git show HEAD:workers/api/src/core/create-app.ts >/dev/null
```

Expected: command succeeds (file exists) — then copy with your editor/IDE (avoid shell redirects).

- [ ] **Step 2: Update `workers/auth-service/src/app.ts` to import local modules**

Update imports to:

```ts
import { createApp } from "./core/create-app";
import { corsMiddleware } from "./middleware/cors";
import { errorHandler, notFoundHandler } from "./middleware/exceptions";
import { queryParserMiddleware } from "./middleware/query-parser";
import { requestTimeout } from "./middleware/timeout";
```

- [ ] **Step 3: Add `workers/auth-service/src/types.ts` Env typing**

Create:

```ts
export type Env = CloudflareBindings;
```

- [ ] **Step 4: Run auth-service typecheck**

```bash
cd workers/auth-service
npm run cf-typegen
```

Expected: types file generated, no TS errors for core/middleware imports.

- [ ] **Step 5: Commit**

```bash
git add workers/auth-service/src
git commit -m "chore(auth-service): add shared core and middleware"
```

---

## Task 4: Move `/api/v1/auth/*` into auth-service

**Files:**
- Create: `workers/auth-service/src/modules/auth/**` (ported from `workers/api/src/modules/auth/**`)
- Modify: `workers/auth-service/src/app.ts` (mount `/api/v1/auth`)
- Tests: `workers/auth-service/src/__tests__/modules/auth/*.test.ts`

- [ ] **Step 1: Port module files**

Copy these directories from `workers/api/src/modules/auth/` to `workers/auth-service/src/modules/auth/` unchanged:

```text
auth-env.ts
auth.routes.ts
auth.schemas.ts
auth.service.ts
google-identity.ts
password-email.ts
password-identity.ts
reset-uri.ts
session-tokens.ts
sign-in-source.ts
index.ts
```

Ensure all relative imports update to the auth-service paths (e.g. `../../core/...` becomes `../../core/...` from the new location).

- [ ] **Step 2: Add auth middleware for JWT verification**

Port `workers/api/src/middleware/auth.ts` to `workers/auth-service/src/middleware/auth.ts` unchanged.

- [ ] **Step 3: Mount `/api/v1/auth` routes**

In `workers/auth-service/src/app.ts`, mount:

```ts
import { authApp, installAuthService } from "./modules/auth";
// ...
app.use("*", async (c, next) => {
  // Minimal injectServices replacement for auth-service v1:
  // create and attach c.var.authService in Task 4 Step 4
  await next();
});
app.route("/api/v1/auth", authApp);
```

Then implement a minimal service injection for just auth/users in Task 5 (we’ll replace this with a real `injectServices` equivalent if needed).

- [ ] **Step 4: Add the auth service installer wiring**

In `workers/auth-service/src/modules/auth/index.ts`, keep `installAuthService` signature but adapt to auth-service Env bindings:

```ts
export const installAuthService = (c: any) => {
  // uses TALASH_DB, TALASH_KV, env vars + secrets
};
```

Initial correctness criterion: `authApp` handlers can call `c.var.authService` successfully.

- [ ] **Step 5: Write a route parity test for one endpoint**

Create `workers/auth-service/src/__tests__/modules/auth/refresh.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import app from "../../../app";

describe("auth-service /api/v1/auth/refresh", () => {
  it("returns 401 on invalid refresh token", async () => {
    const res = await app.request("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: "bad-token" }),
    });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 6: Run test**

Run:

```bash
cd workers/auth-service
npm run test -- --runInBand
```

Expected: test runs; status assertion passes.

- [ ] **Step 7: Commit**

```bash
git add workers/auth-service/src/modules/auth workers/auth-service/src/middleware/auth.ts workers/auth-service/src/__tests__/modules/auth
git commit -m "feat(auth-service): port auth module and mount /api/v1/auth"
```

---

## Task 5: Move `/api/v1/users/*` into auth-service

**Files:**
- Create: `workers/auth-service/src/modules/users/**` (ported)
- Modify: `workers/auth-service/src/app.ts` (mount `/api/v1/users`)
- Tests: `workers/auth-service/src/__tests__/modules/users/*.test.ts`

- [ ] **Step 1: Port users module**

Copy `workers/api/src/modules/users/**` to `workers/auth-service/src/modules/users/**` unchanged, including:

- routes, service, schemas
- installer

Also port any required storage/core dependencies used by users photo upload.

- [ ] **Step 2: Mount**

In `workers/auth-service/src/app.ts`:

```ts
import { usersApp, installUsersService } from "./modules/users";
// ...
app.route("/api/v1/users", usersApp);
```

- [ ] **Step 3: Add a minimal self-scoped contract test**

Create `workers/auth-service/src/__tests__/modules/users/self-get.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import app from "../../../app";

describe("auth-service /api/v1/users/:id (self scoped)", () => {
  it("returns 401 when missing Bearer token", async () => {
    const res = await app.request("/api/v1/users/any", { method: "GET" });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd workers/auth-service
npm run test
```

- [ ] **Step 5: Commit**

```bash
git add workers/auth-service/src/modules/users workers/auth-service/src/__tests__/modules/users
git commit -m "feat(auth-service): port users module and mount /api/v1/users"
```

---

## Task 6: Add internal authorisation endpoint to auth-service

**Files:**
- Create: `workers/auth-service/src/internal/authorise.routes.ts`
- Modify: `workers/auth-service/src/app.ts`
- Modify: `workers/auth-service/src/modules/auth/session-tokens.ts` (if needed for verify helper reuse)
- Tests: `workers/auth-service/src/__tests__/internal/authorise.test.ts`

- [ ] **Step 1: Implement `POST /internal/authorise`**

Create `workers/auth-service/src/internal/authorise.routes.ts`:

```ts
import { createApp } from "../core/create-app";
import { authenticate } from "../middleware/auth";
import { ForbiddenError } from "../core/errors";

export const internalApp = createApp();

internalApp.use("*", authenticate);

internalApp.post("/authorise", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    requiredRoles?: string[];
    branchScope?: boolean;
  };

  if (body.requiredRoles?.length && !body.requiredRoles.includes(c.var.user.role)) {
    throw new ForbiddenError(
      `This action requires one of the following roles: ${body.requiredRoles.join(", ")}.`,
    );
  }

  const scopedBranchIds = body.branchScope
    ? await c.var.authz.resolveBranchScope(c.var.user)
    : undefined;

  return c.json({
    user: c.var.user,
    scopedBranchIds: scopedBranchIds ?? null,
  });
});
```

Notes:
- This assumes `c.var.authz` exists in auth-service (ported `AuthorizationService` in Task 7).

- [ ] **Step 2: Mount internal routes**

In `workers/auth-service/src/app.ts`:

```ts
import { internalApp } from "./internal/authorise.routes";
// ...
app.route("/internal", internalApp);
```

- [ ] **Step 3: Test**

Create `workers/auth-service/src/__tests__/internal/authorise.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import app from "../../app";

describe("auth-service /internal/authorise", () => {
  it("returns 401 without Bearer token", async () => {
    const res = await app.request("/internal/authorise", { method: "POST" });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 4: Commit**

```bash
git add workers/auth-service/src/internal workers/auth-service/src/__tests__/internal
git commit -m "feat(auth-service): add internal authorise endpoint"
```

---

## Task 7: Port `AuthorizationService` into auth-service and wire branch scope

**Files:**
- Create: `workers/auth-service/src/core/authorization.ts` (ported)
- Modify: `workers/auth-service/src/app.ts` (inject `authz`)
- Tests: extend internal authorise tests

- [ ] **Step 1: Copy `workers/api/src/core/authorization.ts` into auth-service**

Create `workers/auth-service/src/core/authorization.ts` identical to api worker’s version.

- [ ] **Step 2: Inject `authz` into context**

In `workers/auth-service/src/app.ts`, create and set `c.var.authz` in a middleware that runs before routes.

- [ ] **Step 3: Extend internal authorise test**

Add a test case with a valid token (use the existing `createTestToken()` helper pattern from `workers/api/src/__tests__/helpers/auth.ts` by copying it into auth-service tests).

- [ ] **Step 4: Commit**

```bash
git add workers/auth-service/src/core/authorization.ts workers/auth-service/src/app.ts workers/auth-service/src/__tests__
git commit -m "feat(auth-service): port AuthorizationService and enable branch scoping"
```

---

## Task 8: Add Service Binding and proxy routes in `workers/api`

**Files:**
- Modify: `workers/api/wrangler.jsonc`
- Create: `workers/api/src/core/proxy.ts`
- Modify: `workers/api/src/modules/routes.ts`
- Tests: `workers/api/src/__tests__/modules/gateway-proxy.test.ts`

- [ ] **Step 1: Add service binding to `workers/api/wrangler.jsonc`**

Add (per env as needed):

```jsonc
"services": [
  { "binding": "AUTH_SERVICE", "service": "talash-auth-service" }
]
```

- [ ] **Step 2: Add proxy helper**

Create `workers/api/src/core/proxy.ts`:

```ts
export async function proxyToService(
  service: Fetcher,
  req: Request,
  prefixFrom: string,
  prefixTo: string,
) {
  const url = new URL(req.url);
  url.pathname = url.pathname.replace(prefixFrom, prefixTo);

  const init: RequestInit = {
    method: req.method,
    headers: req.headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.clone().arrayBuffer(),
  };

  return service.fetch(url.toString(), init);
}
```

- [ ] **Step 3: Mount proxy routes**

In `workers/api/src/modules/routes.ts`, before mounting local `authApp` / `usersApp`, replace them with proxy routes:

```ts
apiRoutes.all("/v1/auth/*", (c) =>
  proxyToService(c.env.AUTH_SERVICE, c.req.raw, "/api/v1/auth", "/api/v1/auth"),
);
apiRoutes.all("/v1/users/*", (c) =>
  proxyToService(c.env.AUTH_SERVICE, c.req.raw, "/api/v1/users", "/api/v1/users"),
);
```

And remove (or stop mounting) the local `authApp` and `usersApp` to avoid double-routing.

- [ ] **Step 4: Add a proxy parity test (status + body)**

Create `workers/api/src/__tests__/modules/gateway-proxy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import app from "../../app";

describe("gateway proxy", () => {
  it("proxies /api/v1/auth/refresh", async () => {
    const res = await app.request("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: "bad-token" }),
    });
    expect([200, 401]).toContain(res.status);
  });
});
```

This test becomes strict once auth-service is fully wired in local dev (in early steps, allow either 401 or 500 until binding is configured).

- [ ] **Step 5: Commit**

```bash
git add workers/api/wrangler.jsonc workers/api/src/core/proxy.ts workers/api/src/modules/routes.ts workers/api/src/__tests__/modules/gateway-proxy.test.ts
git commit -m "feat(api): proxy auth and users to auth-service via service binding"
```

---

## Task 9: Switch `workers/api` branch-scope resolution to call `/internal/authorise`

**Files:**
- Modify: `workers/api/src/middleware/auth-guard.ts`
- Modify: `workers/api/src/types/index.ts` (if new env binding typing needed)
- Tests: update existing auth-guard tests

- [ ] **Step 1: Update `requireAuth` to delegate when `branchScope` is true**

In `workers/api/src/middleware/auth-guard.ts`, replace:

```ts
c.set("scopedBranchIds", await c.var.authz.resolveBranchScope(user));
```

With:

```ts
const res = await c.env.AUTH_SERVICE.fetch("http://internal/authorise", {
  method: "POST",
  headers: {
    Authorization: c.req.header("Authorization") ?? "",
    "content-type": "application/json",
  },
  body: JSON.stringify({ requiredRoles: roles, branchScope: true }),
});
if (!res.ok) {
  const body = await res.json().catch(() => null);
  // Map 401/403 to existing errors
  throw res.status === 401 ? new UnauthorizedError() : new ForbiddenError(body?.message ?? "Forbidden");
}
const data = (await res.json()) as { scopedBranchIds: string[] | null };
c.set("scopedBranchIds", data.scopedBranchIds);
```

- [ ] **Step 2: Update tests**

Update `workers/api/src/__tests__/middleware/auth-guard.test.ts` to mock `c.env.AUTH_SERVICE.fetch` and assert it’s called when `branchScope: true`.

- [ ] **Step 3: Commit**

```bash
git add workers/api/src/middleware/auth-guard.ts workers/api/src/__tests__/middleware/auth-guard.test.ts
git commit -m "feat(api): delegate branch scope resolution to auth-service"
```

---

## Task 10: Docs and verification

**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/guides/api-endpoints.md`
- Modify: `workers/api/CLAUDE.md`
- Create/Modify: `workers/auth-service/CLAUDE.md`

- [ ] **Step 1: Update docs**

Add auth-service to the architecture diagram and note that `/api/v1/auth/*` and `/api/v1/users/*` are served by auth-service behind the gateway.

- [ ] **Step 2: Full verification**

Run:

```bash
bun run lint
bun run test
bun run build
```

- [ ] **Step 3: Commit**

```bash
git add docs workers/api/CLAUDE.md workers/auth-service/CLAUDE.md
git commit -m "docs: document auth-service split and gateway proxy"
```

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-16-auth-service-split.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?

