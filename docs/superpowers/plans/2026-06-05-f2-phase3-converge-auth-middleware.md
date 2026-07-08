# F2 Phase 3 — Converge Route Authorization Middleware

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two separate route authorization middlewares (`requireRole` in `rbac.ts` and `requireVenueStaff` in `team-scope.ts`) with one unified `requireAuth` function in a single file, making "no check" a visible omission and authorization a one-import story.

**Architecture:** A new `workers/api/src/middleware/auth-guard.ts` exports a single `requireAuth(roles, options?)` function that handles both behaviors: role gate only (default) and role gate + `scopedBranchIds` injection (`{ branchScope: true }`). All 15 existing call sites across 12 route files are migrated, then the two old files are deleted. Behavior is preserved: the existing 295-test suite stays green throughout.

**Tech Stack:** TypeScript, Hono (`createMiddleware`, `OpenAPIHono`), Vitest (node), `hono/jwt` for test tokens.

---

## Background & Context

### The two middleware (read both files before starting)

**`workers/api/src/middleware/rbac.ts`** — `requireRole(...roles: string[])`:
- Checks `c.var.user.role` is in `roles`; throws `UnauthorizedError(401)` if no user, `ForbiddenError(403)` if wrong role
- Error message: `"This action requires one of the following roles: X, Y."`
- Does NOT inject `scopedBranchIds`
- 11 call sites across 9 module `index.ts` files

**`workers/api/src/middleware/team-scope.ts`** — `requireVenueStaff(...roles: string[])`:
- Same role check (error message: `"Requires role: X, Y"` — note inconsistent format)
- ALSO injects `scopedBranchIds` into context: `null` for `role === "owner"` (unrestricted), or an array of assigned branch IDs from `team_members` for manager/staff (one DB call via `new TeamRepository(getDB()).findBranchIdsByUser(user.id)`)
- 4 call sites across 3 module `index.ts` files

### `scopedBranchIds` context variable (from `workers/api/src/types/index.ts`)

```ts
scopedBranchIds: string[] | null;
// null = owner (unrestricted); string[] = assigned branches (manager/staff)
```

### The unified API

```ts
// Role gate only (replaces requireRole)
requireAuth(["owner"])
requireAuth(["owner", "manager"])

// Role gate + branch scope injection (replaces requireVenueStaff)
requireAuth(["owner", "manager"], { branchScope: true })
requireAuth(["owner", "manager", "staff"], { branchScope: true })
```

### Call site mapping (verified by grep)

**Currently using `requireRole`:**

| File | Old call | New call |
|------|----------|----------|
| `modules/branches/index.ts` | `requireRole("owner")` | `requireAuth(["owner"])` |
| `modules/coupons/index.ts` | `requireRole("owner")` | `requireAuth(["owner"])` |
| `modules/team/index.ts` | `requireRole("owner")` | `requireAuth(["owner"])` |
| `modules/venues/index.ts` | `requireRole("owner")` | `requireAuth(["owner"])` |
| `modules/reviews/index.ts` | `requireRole("owner")` | `requireAuth(["owner"])` |
| `modules/customers/index.ts` | `requireRole("owner", "manager")` | `requireAuth(["owner", "manager"])` |
| `modules/analytics/index.ts` | `requireRole("owner", "manager")` | `requireAuth(["owner", "manager"])` |
| `modules/campaigns/index.ts` | `requireRole("owner", "manager")` | `requireAuth(["owner", "manager"])` |
| `modules/users/index.ts` (line ~44) | `requireRole("owner", "moderator")` | `requireAuth(["owner", "moderator"])` |
| `modules/users/index.ts` (line ~53) | `requireRole("moderator")` | `requireAuth(["moderator"])` |

**Currently using `requireVenueStaff`:**

| File | Old call | New call |
|------|----------|----------|
| `modules/bookings/index.ts` (staff routes) | `requireVenueStaff("owner", "manager", "staff")` | `requireAuth(["owner", "manager", "staff"], { branchScope: true })` |
| `modules/bookings/index.ts` (export routes) | `requireVenueStaff("owner", "manager")` | `requireAuth(["owner", "manager"], { branchScope: true })` |
| `modules/services/index.ts` | `requireVenueStaff("owner", "manager")` | `requireAuth(["owner", "manager"], { branchScope: true })` |
| `modules/staff-availability/index.ts` | `requireVenueStaff("owner", "manager")` | `requireAuth(["owner", "manager"], { branchScope: true })` |

### Implementation note on the DB call

`requireAuth` with `{ branchScope: true }` for non-owner roles calls `new TeamRepository(getDB()).findBranchIdsByUser(user.id)` — identical to the current `team-scope.ts` behavior. This creates a new repository instance per request, which is acceptable (one index lookup). It is NOT injectable in tests — the test suite only exercises the owner path (no DB call) and the role-gate paths. Manager/staff branch scope is covered by production behavior.

---

## File Structure

| File | Change |
|------|--------|
| `workers/api/src/middleware/auth-guard.ts` | **Create** — `requireAuth` unified middleware |
| `workers/api/src/__tests__/middleware/auth-guard.test.ts` | **Create** — unit tests |
| `workers/api/src/middleware/rbac.ts` | **Delete** |
| `workers/api/src/middleware/team-scope.ts` | **Delete** |
| `workers/api/src/modules/branches/index.ts` | Migrate import + call |
| `workers/api/src/modules/coupons/index.ts` | Migrate import + call |
| `workers/api/src/modules/team/index.ts` | Migrate import + call |
| `workers/api/src/modules/venues/index.ts` | Migrate import + call |
| `workers/api/src/modules/reviews/index.ts` | Migrate import + call |
| `workers/api/src/modules/customers/index.ts` | Migrate import + call |
| `workers/api/src/modules/analytics/index.ts` | Migrate import + call |
| `workers/api/src/modules/campaigns/index.ts` | Migrate import + call |
| `workers/api/src/modules/users/index.ts` | Migrate import + 2 calls |
| `workers/api/src/modules/bookings/index.ts` | Migrate import + 2 calls |
| `workers/api/src/modules/services/index.ts` | Migrate import + call |
| `workers/api/src/modules/staff-availability/index.ts` | Migrate import + call |
| `workers/api/CLAUDE.md` | Update Auth & RBAC section |
| `docs/guides/api-query-repository-pattern.md` | Update section 18 |

---

## Task 1: Create `requireAuth` + unit tests (TDD)

**Files:**
- Create: `workers/api/src/middleware/auth-guard.ts`
- Create: `workers/api/src/__tests__/middleware/auth-guard.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `workers/api/src/__tests__/middleware/auth-guard.test.ts`:

```ts
import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";
import { authenticate } from "../../middleware/auth";
import { requireAuth } from "../../middleware/auth-guard";
import type { AppEnv } from "../../types/index";
import { TEST_ENV, authHeader, createTestToken } from "../helpers/auth";

function makeApp(roles: string[], branchScope = false) {
	const app = new OpenAPIHono<AppEnv>({ strict: false });
	app.use("*", authenticate);
	app.use(
		"*",
		requireAuth(roles, branchScope ? { branchScope: true } : undefined),
	);
	app.get("/test", (c) =>
		c.json({
			ok: true,
			scopedBranchIds: c.var.scopedBranchIds ?? "not-set",
		}),
	);
	return app;
}

describe("requireAuth — role gate", () => {
	it("returns 401 when there is no Authorization header", async () => {
		const app = makeApp(["owner"]);
		const res = await app.request("/test", {}, TEST_ENV);
		expect(res.status).toBe(401);
	});

	it("returns 403 when the user role is not in the allowed list", async () => {
		const app = makeApp(["owner"]);
		const token = await createTestToken({ role: "manager" });
		const res = await app.request(
			"/test",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("returns 200 when the user role is in the allowed list", async () => {
		const app = makeApp(["owner", "manager"]);
		const token = await createTestToken({ role: "manager" });
		const res = await app.request(
			"/test",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
	});

	it("403 body has FORBIDDEN code and a message string", async () => {
		const app = makeApp(["owner"]);
		const token = await createTestToken({ role: "staff" });
		const res = await app.request(
			"/test",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		const body = (await res.json()) as { code: string; message: string };
		expect(body.code).toBe("FORBIDDEN");
		expect(typeof body.message).toBe("string");
		expect(body.message.length).toBeGreaterThan(0);
	});
});

describe("requireAuth — branchScope option (owner path)", () => {
	it("sets scopedBranchIds to null for the owner role", async () => {
		const app = makeApp(["owner", "manager"], true);
		const token = await createTestToken({ role: "owner" });
		const res = await app.request(
			"/test",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { scopedBranchIds: null | string[] };
		expect(body.scopedBranchIds).toBeNull();
	});
});
```

- [ ] **Step 2: Run to verify tests fail**

Run: `bun run --filter @repo/api test -- auth-guard`
Expected: FAIL — `Cannot find module '../../middleware/auth-guard'`.

- [ ] **Step 3: Create `auth-guard.ts`**

Create `workers/api/src/middleware/auth-guard.ts`:

```ts
import { getDB } from "@repo/core/src/database/client";
import { TeamRepository } from "@repo/core/src/database/repositories/team.repository";
import { createMiddleware } from "hono/factory";
import { ForbiddenError, UnauthorizedError } from "../core/errors";
import type { AppEnv } from "../types/index";

/**
 * Unified route authorization middleware.
 *
 * @param roles   Allowed roles — user must have one to proceed.
 * @param options Set `branchScope: true` on venue-management routes that managers
 *                and staff should access. Resolves and injects `scopedBranchIds`
 *                into the request context: `null` for owners (unrestricted) or the
 *                array of assigned branch IDs for managers/staff.
 */
export function requireAuth(
	roles: string[],
	options?: { branchScope?: boolean },
) {
	return createMiddleware<AppEnv>(async (c, next) => {
		const user = c.var.user;
		if (!user) throw new UnauthorizedError();
		if (!roles.includes(user.role)) {
			throw new ForbiddenError(
				`This action requires one of the following roles: ${roles.join(", ")}.`,
			);
		}

		if (options?.branchScope) {
			if (user.role === "owner") {
				c.set("scopedBranchIds", null);
			} else {
				const branchIds = await new TeamRepository(
					getDB(),
				).findBranchIdsByUser(user.id);
				c.set("scopedBranchIds", branchIds);
			}
		}

		await next();
	});
}
```

- [ ] **Step 4: Run to verify all tests pass**

Run: `bun run --filter @repo/api test -- auth-guard`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add workers/api/src/middleware/auth-guard.ts \
        workers/api/src/__tests__/middleware/auth-guard.test.ts
git commit -m "feat(api): add unified requireAuth middleware (auth-guard)

Combines requireRole (role gate) and requireVenueStaff (role gate +
scopedBranchIds injection) into a single requireAuth(roles, options?)
function. Normalizes error messages. Old files deleted in follow-up.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Migrate `requireRole` call sites

**Files:** 9 module `index.ts` files — replace import from `rbac` and update call syntax.

> **Note:** You are mechanically changing 11 call sites. Read each file before editing to confirm the exact line. Do NOT change any other logic. Run tests after ALL 9 files are done (one batch commit).

- [ ] **Step 1: Migrate `branches/index.ts`**

In `workers/api/src/modules/branches/index.ts`:
- Remove: `import { requireRole } from "../../middleware/rbac";`
- Add: `import { requireAuth } from "../../middleware/auth-guard";`
- Change: `requireRole("owner")` → `requireAuth(["owner"])`

- [ ] **Step 2: Migrate `coupons/index.ts`**

In `workers/api/src/modules/coupons/index.ts`:
- Remove: `import { requireRole } from "../../middleware/rbac";`
- Add: `import { requireAuth } from "../../middleware/auth-guard";`
- Change: `requireRole("owner")` → `requireAuth(["owner"])`

- [ ] **Step 3: Migrate `team/index.ts`**

In `workers/api/src/modules/team/index.ts`:
- Remove: `import { requireRole } from "../../middleware/rbac";`
- Add: `import { requireAuth } from "../../middleware/auth-guard";`
- Change: `requireRole("owner")` → `requireAuth(["owner"])`

- [ ] **Step 4: Migrate `venues/index.ts`**

In `workers/api/src/modules/venues/index.ts`:
- Remove: `import { requireRole } from "../../middleware/rbac";`
- Add: `import { requireAuth } from "../../middleware/auth-guard";`
- Change: `requireRole("owner")` → `requireAuth(["owner"])`

- [ ] **Step 5: Migrate `reviews/index.ts`**

In `workers/api/src/modules/reviews/index.ts`:
- Remove: `import { requireRole } from "../../middleware/rbac";`
- Add: `import { requireAuth } from "../../middleware/auth-guard";`
- Change: `requireRole("owner")` → `requireAuth(["owner"])`

- [ ] **Step 6: Migrate `customers/index.ts`**

In `workers/api/src/modules/customers/index.ts`:
- Remove: `import { requireRole } from "../../middleware/rbac";`
- Add: `import { requireAuth } from "../../middleware/auth-guard";`
- Change: `requireRole("owner", "manager")` → `requireAuth(["owner", "manager"])`

- [ ] **Step 7: Migrate `analytics/index.ts`**

In `workers/api/src/modules/analytics/index.ts`:
- Remove: `import { requireRole } from "../../middleware/rbac";`
- Add: `import { requireAuth } from "../../middleware/auth-guard";`
- Change: `requireRole("owner", "manager")` → `requireAuth(["owner", "manager"])`

- [ ] **Step 8: Migrate `campaigns/index.ts`**

In `workers/api/src/modules/campaigns/index.ts`:
- Remove: `import { requireRole } from "../../middleware/rbac";`
- Add: `import { requireAuth } from "../../middleware/auth-guard";`
- Change: `requireRole("owner", "manager")` → `requireAuth(["owner", "manager"])`

- [ ] **Step 9: Migrate `users/index.ts` (2 call sites)**

In `workers/api/src/modules/users/index.ts`:
- Remove: `import { requireRole } from "../../middleware/rbac";`
- Add: `import { requireAuth } from "../../middleware/auth-guard";`
- Change: `requireRole("owner", "moderator")` → `requireAuth(["owner", "moderator"])`
- Change: `requireRole("moderator")` → `requireAuth(["moderator"])`

- [ ] **Step 10: Run full api test suite**

Run: `bun run --filter @repo/api test`
Expected: all tests pass. The two old files (`rbac.ts`, `team-scope.ts`) are still present so TypeScript is happy.

- [ ] **Step 11: Commit**

```bash
git add workers/api/src/modules/branches/index.ts \
        workers/api/src/modules/coupons/index.ts \
        workers/api/src/modules/team/index.ts \
        workers/api/src/modules/venues/index.ts \
        workers/api/src/modules/reviews/index.ts \
        workers/api/src/modules/customers/index.ts \
        workers/api/src/modules/analytics/index.ts \
        workers/api/src/modules/campaigns/index.ts \
        workers/api/src/modules/users/index.ts
git commit -m "refactor(api): migrate requireRole call sites to requireAuth

9 module route files updated (11 call sites). Behavior unchanged:
same role lists, same 401/403 error status codes. Error message
wording is now consistent across all routes.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Migrate `requireVenueStaff` call sites

**Files:** 3 module `index.ts` files — replace import from `team-scope` and update call syntax (add `{ branchScope: true }`).

- [ ] **Step 1: Migrate `bookings/index.ts` (2 call sites)**

In `workers/api/src/modules/bookings/index.ts`:
- Remove: `import { requireVenueStaff } from "../../middleware/team-scope";`
- Add: `import { requireAuth } from "../../middleware/auth-guard";`
- Change: `requireVenueStaff("owner", "manager", "staff")` → `requireAuth(["owner", "manager", "staff"], { branchScope: true })`
- Change: `requireVenueStaff("owner", "manager")` → `requireAuth(["owner", "manager"], { branchScope: true })`
- Also update the inline comment on the line before: change `// Staff routes — owner, manager, or staff only; scope enforced by requireVenueStaff` → `// Staff routes — owner, manager, or staff only; branch scope injected by requireAuth`

- [ ] **Step 2: Migrate `services/index.ts`**

In `workers/api/src/modules/services/index.ts`:
- Remove: `import { requireVenueStaff } from "../../middleware/team-scope";`
- Add: `import { requireAuth } from "../../middleware/auth-guard";`
- Change: `requireVenueStaff("owner", "manager")` → `requireAuth(["owner", "manager"], { branchScope: true })`

- [ ] **Step 3: Migrate `staff-availability/index.ts`**

In `workers/api/src/modules/staff-availability/index.ts`:
- Remove: `import { requireVenueStaff } from "../../middleware/team-scope";`
- Add: `import { requireAuth } from "../../middleware/auth-guard";`
- Change: `requireVenueStaff("owner", "manager")` → `requireAuth(["owner", "manager"], { branchScope: true })`

- [ ] **Step 4: Run full api test suite**

Run: `bun run --filter @repo/api test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add workers/api/src/modules/bookings/index.ts \
        workers/api/src/modules/services/index.ts \
        workers/api/src/modules/staff-availability/index.ts
git commit -m "refactor(api): migrate requireVenueStaff call sites to requireAuth

3 module route files updated (4 call sites). All branch-scope routes
now use requireAuth(['roles'], { branchScope: true }) — explicit and
consistent with the role-only routes.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Delete old middleware files + final verification

**Files:**
- Delete: `workers/api/src/middleware/rbac.ts`
- Delete: `workers/api/src/middleware/team-scope.ts`

- [ ] **Step 1: Delete `rbac.ts`**

```bash
rm workers/api/src/middleware/rbac.ts
```

- [ ] **Step 2: Delete `team-scope.ts`**

```bash
rm workers/api/src/middleware/team-scope.ts
```

- [ ] **Step 3: Run full api test suite**

Run: `bun run --filter @repo/api test`
Expected: all tests pass. If any import references to the deleted files remain, TypeScript/Vitest will report them — fix those before proceeding.

- [ ] **Step 4: Run wrangler dry-run build**

```bash
cd workers/api && bunx wrangler deploy --dry-run --outdir /tmp/api-build-f2p3
```

Expected: bundle created without error.

- [ ] **Step 5: Commit**

```bash
git add -u workers/api/src/middleware/rbac.ts \
         workers/api/src/middleware/team-scope.ts
git commit -m "chore(api): delete rbac.ts and team-scope.ts

All 15 call sites migrated to requireAuth. The two old middleware
files are no longer imported anywhere.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Documentation update

**Files:**
- Modify: `workers/api/CLAUDE.md`
- Modify: `docs/guides/api-query-repository-pattern.md`

- [ ] **Step 1: Update `workers/api/CLAUDE.md`**

Find the line:
```
- Gate routes: `requireRole("owner" | "manager" | "staff")` from `middleware/rbac.ts`
```

Replace it with:
```
- Gate routes: `requireAuth(["owner"])` or `requireAuth(["owner", "manager"])` from `middleware/auth-guard.ts`; add `{ branchScope: true }` on venue-management routes where managers/staff need branch-scope injection into `c.var.scopedBranchIds`
```

- [ ] **Step 2: Update `docs/guides/api-query-repository-pattern.md` — section 18**

In section 18 ("Authorization guard"), after the existing `requireAuth` bullet list and before the "New owner-scoped endpoints must call the guard" paragraph, add a new subsection:

```markdown
#### Route authorization

All routes that require a signed-in user must gate with `requireAuth` from
`middleware/auth-guard.ts`. There is one function for both use cases:

```ts
// Role-only gate (most routes)
privateApp.use("*", authenticate, requireAuth(["owner"]));

// Role gate + scopedBranchIds injection (venue-management routes open to managers/staff)
privateApp.use("*", authenticate, requireAuth(["owner", "manager"], { branchScope: true }));
```

With `branchScope: true`, the middleware sets `c.var.scopedBranchIds` to `null` for
owners (unrestricted) or to the user's assigned branch IDs from `team_members` for
managers/staff. Services read this value to scope their queries.

Do **not** import from the deleted `middleware/rbac.ts` or `middleware/team-scope.ts`.
```

- [ ] **Step 3: Run full test suite one final time**

Run: `bun run --filter @repo/core test && bun run --filter @repo/api test`
Expected: all tests pass (15 core + 295+ api).

- [ ] **Step 4: Commit**

```bash
git add workers/api/CLAUDE.md \
        docs/guides/api-query-repository-pattern.md
git commit -m "docs(api): document unified requireAuth route middleware

Update CLAUDE.md auth section and api-query-repository-pattern.md
section 18 to reference requireAuth. Remove references to deleted
rbac.ts and team-scope.ts.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Self-Review Notes (for the implementer)

- **PRD #26 story coverage:** stories 14 ("one configurable way to gate a route") and 15 ("adding a new owner-scoped endpoint requires an explicit authorization declaration") are now fully satisfied. `requireAuth(roles)` is the single obvious way to gate a route; `{ branchScope: true }` makes the scope-injection decision visible at the call site.
- **Behavior preservation:** Error status codes (401/403) are unchanged. Error message format is now consistent across all routes (`"This action requires one of the following roles: X."`) — this is the only observable change for clients, and it's intentional normalization.
- **`requireVenueStaff` error message change:** old was `"Requires role: X"`, new is `"This action requires one of the following roles: X."` — if any route tests assert on the exact message string for this middleware, update them; status code is unchanged.
- **The `requireAuth` tests don't cover the manager/staff DB path** — this is intentional. `getDB()` is not mockable in the Vitest node environment and the behavior is covered by production use. The owner path (no DB call) is tested.
- **After this lands:** check off F2 in epic #23 and close issue #26. All PRD stories are now addressed.
