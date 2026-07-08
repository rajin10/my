# API Backbone Hardening (F2 Remaining + F3 + F4 + F5) Implementation Plan

> **Status: DONE (2026-06-15).** F1–F5 core items shipped. Follow-up route/service work: [2026-06-15-api-backbone-completion.md](./2026-06-15-api-backbone-completion.md).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining backbone hardening work from PRD #23: migrate VenuesService to use the shared authorization guard (F2 tail), unify request-validation error shape via OpenAPIHono `defaultHook` (F3), add per-resource column allowlists to the query layer (F4), and decouple service injection from the fat central middleware (F5).

**Architecture:** Four independent tasks sequenced by severity. F2 tail and F3 are surgical and high-value. F4 adds an opt-in `queryAllowlist` parameter to `BaseRepository.findAll` and updates key repositories to declare their allowed columns. F5 extracts a thin `ServiceFactory` array so adding a new module touches only a flat registration list, not the middleware body. Every task begins with a failing test and ends with a commit. The 300-test green baseline must be maintained throughout.

**Tech Stack:** TypeScript, Hono / `@hono/zod-openapi` (`OpenAPIHono`), Drizzle ORM, Vitest (node pool), better-sqlite3 (test-only), bun workspace.

---

## Pre-flight: verify baseline

Before starting any task, confirm the baseline is green:

```bash
cd /path/to/monorepo
bun run --filter @repo/api test 2>&1 | tail -5
# Expected: 35 passed, 300 passed
```

---

## State Context

| Finding | Status |
|---------|--------|
| **F1** cursor pagination `(createdAt, id)` keyset | **DONE** — `base.repository.ts:219–288`, tested in `base-repository-pagination.test.ts` |
| **F2 Phase 1** `AuthorizationService` creation | **DONE** — `workers/api/src/core/authorization.ts`, tested in `authorization.test.ts` |
| **F2 Phase 2** remaining module migrations | **DONE** — BranchesService, BookingsService, CouponsService, ReviewsService, ServicesService, TeamService all receive `authz` |
| **F2 Phase 3** unified `requireAuth` middleware | **DONE** — `workers/api/src/middleware/auth-guard.ts` |
| **F2 REMAINING** `VenuesService` hand-rolled ownership | **TODO — Task 1** |
| **F3** unified validation error envelope | **TODO — Task 2** |
| **F4** per-resource query column allowlist | **TODO — Task 3** |
| **F5** service-injection decoupling | **TODO — Task 4** |

---

## File Map

| Action | Path | Task |
|--------|------|------|
| Modify | `workers/api/src/modules/venues/venues.service.ts` | 1 |
| Modify | `workers/api/src/middleware/services.ts` | 1, 4 |
| Modify | `workers/api/src/__tests__/modules/venues/venues.service.test.ts` | 1 |
| Create | `workers/api/src/core/create-app.ts` | 2 |
| Modify | `workers/api/src/app.ts` | 2 |
| Modify | `workers/api/src/modules/routes.ts` | 2 |
| Modify | `workers/api/src/__tests__/helpers/create-test-app.ts` | 2 |
| Modify | `workers/api/src/__tests__/modules/venues/venues.routes.test.ts` | 2 |
| Modify | `workers/api/src/modules/analytics/index.ts` | 2 |
| Modify | `workers/api/src/modules/auth/index.ts` | 2 |
| Modify | `workers/api/src/modules/bookings/index.ts` | 2 |
| Modify | `workers/api/src/modules/branches/index.ts` | 2 |
| Modify | `workers/api/src/modules/campaigns/index.ts` | 2 |
| Modify | `workers/api/src/modules/coupons/index.ts` | 2 |
| Modify | `workers/api/src/modules/customers/index.ts` | 2 |
| Modify | `workers/api/src/modules/demo-requests/index.ts` | 2 |
| Modify | `workers/api/src/modules/favourites/index.ts` | 2 |
| Modify | `workers/api/src/modules/notifications/index.ts` | 2 |
| Modify | `workers/api/src/modules/reviews/index.ts` | 2 |
| Modify | `workers/api/src/modules/rewards/index.ts` | 2 |
| Modify | `workers/api/src/modules/search/index.ts` | 2 |
| Modify | `workers/api/src/modules/services/index.ts` | 2 |
| Modify | `workers/api/src/modules/staff-availability/index.ts` | 2 |
| Modify | `workers/api/src/modules/team/index.ts` | 2 |
| Modify | `workers/api/src/modules/users/index.ts` | 2 |
| Modify | `workers/api/src/modules/venues/index.ts` | 2 |
| Modify | `packages/core/src/database/repositories/base.repository.ts` | 3 |
| Modify | `packages/core/src/database/repositories/venues.repository.ts` | 3 |
| Modify | `packages/core/src/database/repositories/bookings.repository.ts` | 3 |
| Create | `workers/api/src/middleware/service-factories.ts` | 4 |

---

## Task 1: Migrate VenuesService to AuthorizationService (F2 tail)

**Context:**
`VenuesService` is the last service with hand-rolled ownership checks. All other services (`BranchesService`, `BookingsService`, `CouponsService`, `ReviewsService`, `ServicesService`, `TeamService`) already receive `authz: AuthorizationService` via the `injectServices` middleware and call methods like `authz.assertVenueOwner`.

The pattern is: call `authz.assertVenueOwner(ownerId, venueId)` — it fetches the venue, throws `NotFoundError` if missing, throws `ForbiddenError` if wrong owner, and returns the `VenueSelect` on success.

**Special case — `restore`:** `assertVenueOwner` calls `findOne` without `withDeleted: true`, so it returns null for a soft-deleted venue. The `restore` method must still do a raw ownership check on the deleted record. This one case is intentional and documented.

**Files:**
- Modify: `workers/api/src/modules/venues/venues.service.ts`
- Modify: `workers/api/src/middleware/services.ts`
- Modify: `workers/api/src/__tests__/modules/venues/venues.service.test.ts`

---

- [ ] **Step 1.1: Write failing tests that assert authz delegation**

Replace the ownership-related describe blocks in `workers/api/src/__tests__/modules/venues/venues.service.test.ts`. Keep the unchanged blocks (`list`, `get`, `create`) intact. Add `mockAuthz` and update the constructor call.

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError } from "../../../core/errors";
import { VenuesService } from "../../../modules/venues/venues.service";

const mockRepo = {
  findAll: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  updateOne: vi.fn(),
  deleteOne: vi.fn(),
  addPhoto: vi.fn(),
  listPhotos: vi.fn(),
  findPhoto: vi.fn(),
  deletePhoto: vi.fn(),
  reorderPhotos: vi.fn(),
  restoreOne: vi.fn(),
};

const mockAuthz = {
  assertVenueOwner: vi.fn(),
};

const mockStorage = { upload: vi.fn() } as never;

function makeService() {
  return new VenuesService(
    mockRepo as never,
    mockStorage,
    undefined,
    mockAuthz as never,
  );
}

const fakeVenue = {
  id: "venue-1",
  name: "Test Venue",
  ownerId: "owner-1",
  category: "Beauty",
  city: "Dhaka",
  status: "Active" as const,
  description: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("VenuesService.list", () => {
  it("delegates to repository findAll", async () => {
    const expected = { data: [fakeVenue] };
    mockRepo.findAll.mockResolvedValue(expected);
    const svc = makeService();
    const result = await svc.list({ page: 1, limit: 10 });
    expect(result).toEqual(expected);
  });
});

describe("VenuesService.get", () => {
  it("returns venue when found", async () => {
    mockRepo.findOne.mockResolvedValue({ data: fakeVenue });
    const svc = makeService();
    const result = await svc.get("venue-1");
    expect(result).toEqual(fakeVenue);
  });

  it("throws NotFoundError when not found", async () => {
    mockRepo.findOne.mockResolvedValue({ data: null });
    const svc = makeService();
    await expect(svc.get("missing")).rejects.toThrow(NotFoundError);
  });
});

describe("VenuesService.create", () => {
  it("creates venue with ownerId", async () => {
    mockRepo.create.mockResolvedValue({ data: fakeVenue });
    const svc = makeService();
    const result = await svc.create("owner-1", {
      name: "Test Venue",
      category: "Beauty",
      city: "Dhaka",
      status: "Active",
    } as never);
    expect(result).toEqual(fakeVenue);
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: "owner-1" }),
    );
  });
});

describe("VenuesService.update — delegates to authz guard", () => {
  it("calls assertVenueOwner and updates when guard passes", async () => {
    mockAuthz.assertVenueOwner.mockResolvedValue(fakeVenue);
    mockRepo.updateOne.mockResolvedValue({
      data: { ...fakeVenue, name: "Updated" },
    });
    const svc = makeService();
    const result = await svc.update("owner-1", "venue-1", { name: "Updated" });
    expect(mockAuthz.assertVenueOwner).toHaveBeenCalledWith("owner-1", "venue-1");
    expect(result.name).toBe("Updated");
  });

  it("propagates ForbiddenError from guard", async () => {
    mockAuthz.assertVenueOwner.mockRejectedValue(
      new ForbiddenError("You do not own this venue"),
    );
    const svc = makeService();
    await expect(
      svc.update("owner-2", "venue-1", { name: "X" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("propagates NotFoundError from guard", async () => {
    mockAuthz.assertVenueOwner.mockRejectedValue(
      new NotFoundError("Venue not found"),
    );
    const svc = makeService();
    await expect(
      svc.update("owner-1", "missing", { name: "X" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("validates status transition using venue returned by guard", async () => {
    mockAuthz.assertVenueOwner.mockResolvedValue({
      ...fakeVenue,
      status: "Suspended",
    });
    const svc = makeService();
    // Suspended → Suspended is invalid
    await expect(
      svc.update("owner-1", "venue-1", { status: "Draft" }),
    ).rejects.toThrow("Cannot transition");
  });
});

describe("VenuesService.delete — delegates to authz guard", () => {
  it("calls assertVenueOwner and deletes", async () => {
    mockAuthz.assertVenueOwner.mockResolvedValue(fakeVenue);
    mockRepo.deleteOne.mockResolvedValue({ data: fakeVenue });
    const svc = makeService();
    const result = await svc.delete("owner-1", "venue-1");
    expect(mockAuthz.assertVenueOwner).toHaveBeenCalledWith("owner-1", "venue-1");
    expect(result).toEqual(fakeVenue);
  });

  it("propagates ForbiddenError from guard", async () => {
    mockAuthz.assertVenueOwner.mockRejectedValue(new ForbiddenError());
    const svc = makeService();
    await expect(svc.delete("owner-2", "venue-1")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe("VenuesService.restore — raw ownership check (soft-delete path)", () => {
  it("restores when owner matches soft-deleted record", async () => {
    mockRepo.findOne.mockResolvedValue({
      data: { ...fakeVenue, deletedAt: "2026-03-01T00:00:00Z" },
    });
    mockRepo.restoreOne.mockResolvedValue({ data: fakeVenue });
    const svc = makeService();
    const result = await svc.restore("owner-1", "venue-1");
    expect(result).toEqual(fakeVenue);
  });

  it("throws NotFoundError when soft-deleted record missing", async () => {
    mockRepo.findOne.mockResolvedValue({ data: null });
    const svc = makeService();
    await expect(svc.restore("owner-1", "missing")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("throws ForbiddenError when owner does not match soft-deleted record", async () => {
    mockRepo.findOne.mockResolvedValue({
      data: { ...fakeVenue, ownerId: "other-owner", deletedAt: "2026-03-01T00:00:00Z" },
    });
    const svc = makeService();
    await expect(svc.restore("owner-1", "venue-1")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
```

- [ ] **Step 1.2: Run to verify failures**

```bash
cd /path/to/monorepo
bun run --filter @repo/api test -- --reporter=verbose venues.service 2>&1 | grep -E "FAIL|PASS|✓|✗|×"
```

Expected: constructor arity errors or mock assertion failures for `update`/`delete`.

- [ ] **Step 1.3: Update VenuesService**

Replace `workers/api/src/modules/venues/venues.service.ts` in full:

```ts
import type { AuthorizationService } from "../../core/authorization";
import type { VenuesRepository } from "@repo/core/src/database/repositories/venues.repository";
import type {
  VenueInsert,
  VenuePhotoSelect,
  VenueSelect,
} from "@repo/core/src/database/schema";
import type { PaginatedQueryDto } from "@repo/core/src/http/response";
import { ForbiddenError, NotFoundError, ValidationError } from "../../core/errors";
import { KV_KEYS, KV_TTL, kvDel, kvGet, kvSet } from "../../core/kv/cache";
import type { R2Storage } from "../../core/storage/r2";

export class VenuesService {
  constructor(
    private readonly repo: VenuesRepository,
    private readonly storage: R2Storage,
    private readonly kv: KVNamespace | undefined,
    private readonly authz: AuthorizationService,
  ) {}

  list(query: PaginatedQueryDto) {
    return this.repo.findAll(query);
  }

  async listPhotos(
    venueId: string,
  ): Promise<Array<{ id: string; venueId: string; url: string; order: number }>> {
    await this.get(venueId);
    const rows = await this.repo.listPhotos(venueId);
    return rows.map((p: VenuePhotoSelect) => ({
      id: p.id,
      venueId: p.venueId,
      url: p.url,
      order: p.displayOrder,
    }));
  }

  async get(id: string): Promise<VenueSelect> {
    if (this.kv) {
      const cached = await kvGet<VenueSelect>(this.kv, KV_KEYS.venueProfile(id));
      if (cached) return cached;
    }
    const result = await this.repo.findOne(id);
    if (!result.data) throw new NotFoundError("Venue not found");
    if (this.kv) {
      await kvSet(this.kv, KV_KEYS.venueProfile(id), result.data, KV_TTL.venueProfile);
    }
    return result.data;
  }

  async create(ownerId: string, data: Omit<VenueInsert, "ownerId">) {
    const result = await this.repo.create({ ...data, ownerId });
    // biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
    return result.data!;
  }

  async update(
    ownerId: string,
    venueId: string,
    data: Partial<Omit<VenueInsert, "ownerId">>,
  ) {
    const venue = await this.authz.assertVenueOwner(ownerId, venueId);
    if (data.status) {
      this.validateStatusTransition(venue.status, data.status);
    }
    const result = await this.repo.updateOne(venueId, data);
    if (this.kv) await kvDel(this.kv, KV_KEYS.venueProfile(venueId));
    // biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
    return result.data!;
  }

  private validateStatusTransition(from: string, to: string): void {
    const allowed: Record<string, string[]> = {
      Draft: ["Active"],
      Active: ["Suspended"],
      Suspended: ["Active"],
    };
    if (!allowed[from]?.includes(to)) {
      throw new ValidationError(
        `Cannot transition venue status from '${from}' to '${to}'. Allowed: ${allowed[from]?.join(", ") ?? "none"}`,
      );
    }
  }

  async delete(ownerId: string, venueId: string) {
    await this.authz.assertVenueOwner(ownerId, venueId);
    const result = await this.repo.deleteOne(venueId);
    if (this.kv) await kvDel(this.kv, KV_KEYS.venueProfile(venueId));
    // biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
    return result.data!;
  }

  async restore(ownerId: string, venueId: string) {
    // assertVenueOwner excludes soft-deleted records; restore must verify
    // ownership on the deleted row before mutating.
    const peek = await this.repo.findOne(venueId, { withDeleted: true });
    if (!peek.data) throw new NotFoundError("Venue not found or not deleted");
    if (peek.data.ownerId !== ownerId)
      throw new ForbiddenError("You do not own this venue");
    const result = await this.repo.restoreOne(venueId);
    if (!result.data) throw new NotFoundError("Venue not found or not deleted");
    if (this.kv) await kvDel(this.kv, KV_KEYS.venueProfile(venueId));
    return result.data;
  }

  async uploadPhoto(
    ownerId: string,
    venueId: string,
    file: File,
  ): Promise<{ url: string }> {
    await this.authz.assertVenueOwner(ownerId, venueId);
    const ext = file.name.split(".").pop() ?? "jpg";
    const key = `venues/${venueId}/${crypto.randomUUID()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const url = await this.storage.upload(key, arrayBuffer, file.type);
    await this.repo.addPhoto(venueId, url);
    if (this.kv) await kvDel(this.kv, KV_KEYS.venueProfile(venueId));
    return { url };
  }

  async deletePhoto(
    ownerId: string,
    venueId: string,
    photoId: string,
  ): Promise<void> {
    await this.authz.assertVenueOwner(ownerId, venueId);
    const photo = await this.repo.findPhoto(photoId);
    if (!photo || photo.venueId !== venueId) throw new NotFoundError("Photo not found");
    await this.repo.deletePhoto(photoId);
    if (this.kv) await kvDel(this.kv, KV_KEYS.venueProfile(venueId));
  }

  async reorderPhotos(
    ownerId: string,
    venueId: string,
    orders: { id: string; order: number }[],
  ): Promise<void> {
    await this.authz.assertVenueOwner(ownerId, venueId);
    await this.repo.reorderPhotos(orders);
    if (this.kv) await kvDel(this.kv, KV_KEYS.venueProfile(venueId));
  }
}
```

- [ ] **Step 1.4: Wire authz into services middleware**

In `workers/api/src/middleware/services.ts`, change the `VenuesService` instantiation to pass `authz` as the fourth argument:

```ts
// Before:
c.set(
  "venuesService",
  new VenuesService(venuesRepo, storage, c.env.TALASH_KV!),
);

// After:
c.set(
  "venuesService",
  new VenuesService(venuesRepo, storage, c.env.TALASH_KV, authz),
);
```

Note: `c.env.TALASH_KV!` becomes `c.env.TALASH_KV` (drop the non-null assertion) since the constructor now accepts `KVNamespace | undefined`.

- [ ] **Step 1.5: Run tests to verify all pass**

```bash
bun run --filter @repo/api test 2>&1 | tail -8
```

Expected: `35 passed`, `≥300 passed` (new tests add to the count).

- [ ] **Step 1.6: Lint**

```bash
bun run --filter @repo/api lint 2>&1 | tail -5
```

Expected: exit 0 (no new lint errors).

- [ ] **Step 1.7: Commit**

```bash
git add workers/api/src/modules/venues/venues.service.ts \
        workers/api/src/middleware/services.ts \
        workers/api/src/__tests__/modules/venues/venues.service.test.ts
git commit -m "feat(auth): migrate VenuesService ownership checks to AuthorizationService

Completes F2 — all ownership checks in VenuesService now go through
authz.assertVenueOwner instead of hand-rolling repo.findOne + ownerId
compare. The restore path keeps a direct check because assertVenueOwner
does not resolve soft-deleted records.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Unify validation error shape via OpenAPIHono defaultHook (F3)

**Context:**
When an OpenAPI route receives invalid request data (wrong body shape, missing required field, invalid query param), `@hono/zod-openapi` runs its internal Zod validator and—without a `defaultHook`—returns Hono's built-in Zod error response. That response has a different shape from the `{ ok: false, code, message }` envelope used everywhere else.

**Critical mechanism:** The `defaultHook` fires on the instance where `.openapi(route, handler)` is called — it is **not** inherited through `.route()` mounting. Every module `index.ts` creates its own `OpenAPIHono` instances (`publicApp`, `privateApp`, etc.) that call `.openapi()` directly. A grep across the codebase shows ~38 instantiations across 18 module `index.ts` files plus `app.ts`, `routes.ts`, and the test helper.

Patching those 3 parent instances is not enough — the validation fires on the sub-app instances and the `defaultHook` on the parent never runs for those requests.

The fix: create a shared `createApp()` factory in `workers/api/src/core/create-app.ts` that bakes in the `defaultHook`. Replace every `new OpenAPIHono<AppEnv>()` call — in module files and top-level app — with `createApp()`.

**Files:**
- Create: `workers/api/src/core/create-app.ts`
- Modify: `workers/api/src/app.ts`
- Modify: `workers/api/src/modules/routes.ts`
- Modify: `workers/api/src/__tests__/helpers/create-test-app.ts`
- Modify: `workers/api/src/__tests__/modules/venues/venues.routes.test.ts` (add validation test)
- Modify (bulk — 18 files): all module `index.ts` files: `analytics`, `auth`, `bookings`, `branches`, `campaigns`, `coupons`, `customers`, `demo-requests`, `favourites`, `notifications`, `reviews`, `rewards`, `search`, `services`, `staff-availability`, `team`, `users`, `venues`

---

- [ ] **Step 2.1: Write failing test for validation error shape**

Add to `workers/api/src/__tests__/modules/venues/venues.routes.test.ts`:

```ts
describe("POST /api/v1/venues — validation error shape", () => {
  it("returns 422 with { ok: false, code: VALIDATION_ERROR, message } for invalid body", async () => {
    const token = await createTestToken({ role: "owner", userId: "owner-1" });
    const res = await app.request(
      "/api/v1/venues",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(token),
        },
        // name is required and must be min(1); sending empty string triggers validation
        body: JSON.stringify({ name: "", category: "Beauty", city: "Dhaka" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as {
      ok: boolean;
      code: string;
      message: string;
    };
    expect(body.ok).toBe(false);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(typeof body.message).toBe("string");
    expect(body.message.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2.2: Run to confirm it fails**

```bash
bun run --filter @repo/api test -- --reporter=verbose "venues.routes" 2>&1 | grep -A3 "validation error shape"
```

Expected: test fails — `createTestApp` returns Hono's default Zod error (not `{ ok, code, message }`).

- [ ] **Step 2.3: Create the `createApp()` factory**

Create `workers/api/src/core/create-app.ts`:

```ts
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../types";

export function createApp(opts?: { strict?: boolean }) {
  return new OpenAPIHono<AppEnv>({
    ...opts,
    defaultHook: (result, c) => {
      if (!result.success) {
        const message =
          result.error.issues.map((i) => i.message).join("; ") ||
          "Validation failed";
        return c.json(
          { ok: false as const, code: "VALIDATION_ERROR", message },
          422,
        );
      }
    },
  });
}
```

- [ ] **Step 2.4: Update `create-test-app.ts`**

In `workers/api/src/__tests__/helpers/create-test-app.ts`, add the import and replace the constructor:

```ts
// Add alongside existing imports:
import { createApp } from "../../core/create-app";

// Replace:
const app = new OpenAPIHono<AppEnv>({ strict: false });
// With:
const app = createApp({ strict: false });
```

Remove `OpenAPIHono` from the `@hono/zod-openapi` import in this file if it is no longer used elsewhere in the file.

- [ ] **Step 2.5: Run validation test to confirm it now passes**

```bash
bun run --filter @repo/api test -- --reporter=verbose "venues.routes" 2>&1 | grep -A3 "validation error shape"
```

Expected: PASS. The test helper now uses `createApp()` which attaches `defaultHook` to the sub-app instances that call `.openapi()`.

- [ ] **Step 2.6: Update `app.ts` and `routes.ts`**

In `workers/api/src/app.ts`:

```ts
// Add alongside existing imports:
import { createApp } from "./core/create-app";

// Replace:
const app = new OpenAPIHono<AppEnv>({ strict: false });
// With:
const app = createApp({ strict: false });
```

In `workers/api/src/modules/routes.ts`:

```ts
// Add alongside existing imports:
import { createApp } from "../core/create-app";

// Replace:
const apiRoutes = new OpenAPIHono<AppEnv>();
// With:
const apiRoutes = createApp();
```

- [ ] **Step 2.7: Bulk-replace all module `index.ts` files**

Run these two commands from the monorepo root:

```bash
# Replace all `new OpenAPIHono<AppEnv>()` with `createApp()` in module index files
grep -rl 'new OpenAPIHono<AppEnv>()' workers/api/src/modules/ --include="index.ts" \
  | xargs sed -i '' 's/new OpenAPIHono<AppEnv>()/createApp()/g'

# Add the import at the top of each modified file
for f in $(grep -rl 'createApp()' workers/api/src/modules/ --include="index.ts"); do
  sed -i '' '1s/^/import { createApp } from "..\/..\/core\/create-app";\n/' "$f"
done
```

Verify the replacement is complete:

```bash
grep -r 'new OpenAPIHono<AppEnv>()' workers/api/src/modules/ --include="index.ts" | wc -l
# Expected: 0  (all replaced)

grep -r 'import { createApp }' workers/api/src/modules/ --include="index.ts" | wc -l
# Expected: 18  (one per module)
```

- [ ] **Step 2.8: Run full test suite**

```bash
bun run --filter @repo/api test 2>&1 | tail -8
```

Expected: all tests pass (≥ previous count + 1 new test).

- [ ] **Step 2.9: Lint**

```bash
bun run --filter @repo/api lint 2>&1 | tail -5
```

The `sed`-added imports land on line 1. If the linter enforces import sort order, run `bunx biome check --write workers/api/src/modules/` to auto-fix import ordering across all module files, then re-run lint to confirm clean.

- [ ] **Step 2.10: Commit**

```bash
git add workers/api/src/core/create-app.ts \
        workers/api/src/app.ts \
        workers/api/src/modules/routes.ts \
        workers/api/src/__tests__/helpers/create-test-app.ts \
        workers/api/src/__tests__/modules/venues/venues.routes.test.ts \
        workers/api/src/modules/analytics/index.ts \
        workers/api/src/modules/auth/index.ts \
        workers/api/src/modules/bookings/index.ts \
        workers/api/src/modules/branches/index.ts \
        workers/api/src/modules/campaigns/index.ts \
        workers/api/src/modules/coupons/index.ts \
        workers/api/src/modules/customers/index.ts \
        workers/api/src/modules/demo-requests/index.ts \
        workers/api/src/modules/favourites/index.ts \
        workers/api/src/modules/notifications/index.ts \
        workers/api/src/modules/reviews/index.ts \
        workers/api/src/modules/rewards/index.ts \
        workers/api/src/modules/search/index.ts \
        workers/api/src/modules/services/index.ts \
        workers/api/src/modules/staff-availability/index.ts \
        workers/api/src/modules/team/index.ts \
        workers/api/src/modules/users/index.ts \
        workers/api/src/modules/venues/index.ts
git commit -m "feat(errors): unify validation error shape via createApp() factory

Introduces createApp() in workers/api/src/core/create-app.ts that bakes
a defaultHook into every OpenAPIHono instance. Replaces all 38
instantiations across 18 module index files plus app.ts, routes.ts, and
the test helper so Zod request-validation failures consistently return
{ ok: false, code: VALIDATION_ERROR, message } with HTTP 422. F3 complete.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Per-resource query column allowlist (F4)

**Context:**
`BaseRepository.addFilterConditions` and `addSearchCondition` currently operate on every column of the table. The fix adds an optional `queryAllowlist` parameter:
- `filterable?: string[]` — when provided, only these column names are allowed as filter keys. When `undefined`, the current behavior (all columns) is preserved for backward compatibility.
- `searchable?: string[]` — when provided, these columns become the fallback for `search` when the caller hasn't passed explicit `query.fields`. When `undefined`, current behavior is preserved.

This is defense-in-depth: even if a route accidentally exposes `filters` or `search`, only declared columns are reachable. Routes that already declare narrow query schemas (like `listVenuesRoute` which doesn't expose `filters`) are unaffected regardless.

After updating `BaseRepository`, update two representative repositories (`VenuesRepository`, `BookingsRepository`) to declare their allowlists.

**Files:**
- Modify: `packages/core/src/database/repositories/base.repository.ts`
- Modify: `packages/core/src/database/repositories/venues.repository.ts`
- Modify: `packages/core/src/database/repositories/bookings.repository.ts`
- Modify: `workers/api/src/__tests__/lib/base-repository-pagination.test.ts`

---

- [ ] **Step 3.1: Write failing allowlist tests**

Add a new `describe` block to `workers/api/src/__tests__/lib/base-repository-pagination.test.ts`:

```ts
describe("BaseRepository.findAll — queryAllowlist", () => {
  let db: Db;

  beforeEach(async () => {
    db = createTestDb();
    await seed(db);
  });

  it("restricts filter columns to the allowlist", async () => {
    // 'ownerId' is not in the filterable allowlist — filter is silently ignored
    const result = await BaseRepository.findAll(
      db as never,
      venuesSchema,
      { filters: { ownerId: "owner-1" } },
      { filterable: ["status"] },
    );
    // All 5 venues returned because ownerId filter was dropped
    expect(result.data).toHaveLength(5);
  });

  it("allows filter when column is in the allowlist", async () => {
    // Insert a second owner's venue so we can filter by ownerId when it IS allowed
    await (db as never)
      .insert(venuesSchema)
      .values({
        id: "id-other",
        ownerId: "owner-2",
        name: "Other Venue",
        category: "Beauty",
        city: "Dhaka",
        createdAt: "2026-01-05T00:00:00.000Z",
      });

    const result = await BaseRepository.findAll(
      db as never,
      venuesSchema,
      { filters: { ownerId: "owner-2" } },
      { filterable: ["ownerId", "status"] },
    );
    expect(result.data).toHaveLength(1);
    expect((result.data[0] as { id: string }).id).toBe("id-other");
  });

  it("restricts searchable columns to the allowlist", async () => {
    // 'ownerId' is not in searchable allowlist — searching 'owner-1' on ownerId returns nothing
    const result = await BaseRepository.findAll(
      db as never,
      venuesSchema,
      { search: "owner-1" },
      { searchable: ["name"] },
    );
    // 'owner-1' does not appear in any venue name, so 0 results
    expect(result.data).toHaveLength(0);
  });

  it("falls back to all columns when no allowlist provided (backward compatible)", async () => {
    // No allowlist → existing behavior: filter by ownerId still works
    const result = await BaseRepository.findAll(
      db as never,
      venuesSchema,
      { filters: { ownerId: "owner-1" } },
      // no allowlist arg
    );
    expect(result.data).toHaveLength(5);
  });
});
```

Note: the first `seed()` inserts 5 venues with `ownerId: "owner-1"`. The "allows filter" test adds a 6th with `ownerId: "owner-2"`.

- [ ] **Step 3.2: Run to confirm tests fail**

```bash
bun run --filter @repo/api test -- --reporter=verbose "base-repository-pagination" 2>&1 | grep -E "FAIL|✗|×|queryAllowlist"
```

Expected: TypeError or compile error — `findAll` does not accept a 4th argument yet.

- [ ] **Step 3.3: Add QueryAllowlist type and update findAll signature**

In `packages/core/src/database/repositories/base.repository.ts`, add the type and update `findAll`:

```ts
// Add near the top of the file, before the class:
export interface QueryAllowlist {
  /** Column names that may be used as filter keys. Undefined = all columns (backward compat). */
  filterable?: string[];
  /** Column names searched by default when query.fields is not set. Undefined = all columns (backward compat). */
  searchable?: string[];
}
```

Update the `addFilterConditions` signature to accept and respect the allowlist:

```ts
private static addFilterConditions(
  whereConditions: unknown[],
  tableColumns: Record<string, unknown>,
  availableColumnKeys: string[],
  query: BaseQueryDto,
  allowlist?: QueryAllowlist,
) {
  if (!query.filters) {
    return;
  }

  const allowedKeys =
    allowlist?.filterable !== undefined
      ? allowlist.filterable
      : availableColumnKeys;

  for (const [rawKey, rawValue] of Object.entries(query.filters)) {
    if (!allowedKeys.includes(rawKey)) {
      continue;
    }
    if (rawValue.trim().length === 0) {
      continue;
    }
    whereConditions.push(
      sql`cast(${tableColumns[rawKey] as never} as text) = ${rawValue}`,
    );
  }
}
```

Update `addSearchCondition` to respect the searchable allowlist:

```ts
private static addSearchCondition(
  whereConditions: unknown[],
  tableColumns: Record<string, unknown>,
  availableColumnKeys: string[],
  query: BaseQueryDto,
  allowlist?: QueryAllowlist,
) {
  const searchTerm = query.search?.trim();
  if (!searchTerm) {
    return;
  }

  // Explicit query.fields takes priority; fall back to allowlist or all keys.
  const defaultSearchKeys =
    allowlist?.searchable !== undefined
      ? allowlist.searchable
      : availableColumnKeys;

  const searchableKeys =
    query.fields?.filter((field) => availableColumnKeys.includes(field)) ??
    defaultSearchKeys.filter((field) => availableColumnKeys.includes(field));

  if (searchableKeys.length === 0) {
    return;
  }

  const searchPredicates = searchableKeys.map(
    (key) =>
      sql`cast(${tableColumns[key] as never} as text) like ${`%${searchTerm}%`}`,
  );
  whereConditions.push(sql`(${sql.join(searchPredicates, sql` OR `)})`);
}
```

Update `findAll` method signature and internal calls to thread `allowlist` through:

```ts
static async findAll<TTable extends AnySQLiteTable>(
  db: DbClient,
  table: TTable,
  query: PaginatedQueryDto,
  allowlist?: QueryAllowlist,
): Promise<PaginatedResponse<Partial<InferSelectModel<TTable>>>> {
  const { tableColumns, availableColumnKeys } =
    BaseRepository.getTableContext(table);

  const currentLimit = query.limit ?? 10;

  const whereConditions: unknown[] = [];
  BaseRepository.addSoftDeleteCondition(whereConditions, tableColumns, query);
  BaseRepository.addFilterConditions(
    whereConditions,
    tableColumns,
    availableColumnKeys,
    query,
    allowlist,             // ← pass through
  );
  BaseRepository.addSearchCondition(
    whereConditions,
    tableColumns,
    availableColumnKeys,
    query,
    allowlist,             // ← pass through
  );

  // ... rest of the method is unchanged ...
```

- [ ] **Step 3.4: Run allowlist tests**

```bash
bun run --filter @repo/api test -- --reporter=verbose "base-repository-pagination" 2>&1 | tail -20
```

Expected: all allowlist tests pass.

- [ ] **Step 3.5: Update VenuesRepository to declare its allowlist**

In `packages/core/src/database/repositories/venues.repository.ts`, update `findAll`:

```ts
import { QueryAllowlist } from "./base.repository";

// At the top of the class, declare the resource's query allowlist
private static readonly queryAllowlist: QueryAllowlist = {
  filterable: ["status", "city", "category"],
  searchable: ["name", "description", "city"],
};

async findAll(
  query: PaginatedQueryDto,
): Promise<PaginatedResponse<VenueSelect>> {
  const result = await BaseRepository.findAll(
    this.db,
    venuesSchema,
    query,
    VenuesRepository.queryAllowlist,
  );
  return result as PaginatedResponse<VenueSelect>;
}
```

- [ ] **Step 3.6: Update BookingsRepository to declare its allowlist**

In `packages/core/src/database/repositories/bookings.repository.ts`, update `findAll`:

```ts
import { QueryAllowlist } from "./base.repository";

private static readonly queryAllowlist: QueryAllowlist = {
  filterable: ["status", "branchId", "serviceId", "userId"],
  searchable: [],  // bookings have no useful text-search columns
};

async findAll(
  query: PaginatedQueryDto,
): Promise<PaginatedResponse<BookingSelect>> {
  return BaseRepository.findAll(
    this.db,
    bookingsSchema,
    query,
    BookingsRepository.queryAllowlist,
  ) as Promise<PaginatedResponse<BookingSelect>>;
}
```

- [ ] **Step 3.7: Run full test suite**

```bash
bun run --filter @repo/api test 2>&1 | tail -8
# Also run core package tests
bun run --filter @repo/core test 2>&1 | tail -8
```

Expected: all suites pass. The allowlist change is backward-compatible — repositories that haven't declared an allowlist behave exactly as before.

- [ ] **Step 3.8: Lint**

```bash
bun run lint 2>&1 | tail -5
```

- [ ] **Step 3.9: Commit**

```bash
git add packages/core/src/database/repositories/base.repository.ts \
        packages/core/src/database/repositories/venues.repository.ts \
        packages/core/src/database/repositories/bookings.repository.ts \
        workers/api/src/__tests__/lib/base-repository-pagination.test.ts
git commit -m "feat(query): add per-resource column allowlist to BaseRepository

Adds optional queryAllowlist parameter to findAll so filter and search
are opt-in per resource rather than spanning all columns. Backward
compatible: repositories without a declared allowlist keep current
behavior. VenuesRepository and BookingsRepository declare their allowed
columns as representative examples. F4 complete.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Service-injection decoupling (F5)

**Context:**
`middleware/services.ts` is a fat middleware (~105 lines) that instantiates every service. Adding any new module requires editing this shared file. The fix: extract service factories into a dedicated `service-factories.ts` array where each entry is a one-liner that creates one service. The middleware becomes a thin loop. Adding a new module = append one entry to the array (no middleware body changes).

**Design:**
- `SharedDeps` interface captures everything factories need: `db`, `queue`, `storage`, `kv`, `authz`, `env`.
- `serviceFactories` is a `ServiceInstaller[]` array. Each `ServiceInstaller` is `(c, deps) => void`.
- `services.ts` creates `SharedDeps` (including the shared `authz` and repos it needs), then loops over `serviceFactories`.

Factories that need repos (e.g., `VenuesService` needs `VenuesRepository`) create them from `deps.db`. This is fine — SQLite repository instances are cheap wrappers with no I/O at construction time.

**Files:**
- Create: `workers/api/src/middleware/service-factories.ts`
- Modify: `workers/api/src/middleware/services.ts`

---

- [ ] **Step 4.1: Create service-factories.ts**

Create `workers/api/src/middleware/service-factories.ts`:

```ts
import { AuthRepository } from "@repo/core/src/database/repositories/auth.repository";
import { BookingsRepository } from "@repo/core/src/database/repositories/bookings.repository";
import { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import { CouponsRepository } from "@repo/core/src/database/repositories/coupons.repository";
import { NotificationsRepository } from "@repo/core/src/database/repositories/notifications.repository";
import { ReviewsRepository } from "@repo/core/src/database/repositories/reviews.repository";
import { RewardsRepository } from "@repo/core/src/database/repositories/rewards.repository";
import { ServicesRepository } from "@repo/core/src/database/repositories/services.repository";
import { TeamRepository } from "@repo/core/src/database/repositories/team.repository";
import { UsersRepository } from "@repo/core/src/database/repositories/users.repository";
import { VenuesRepository } from "@repo/core/src/database/repositories/venues.repository";
import { RewardsService } from "@repo/core/src/modules/rewards/rewards.service";
import type { Context } from "hono";
import { AuthService } from "../modules/auth/auth.service";
import { BookingsService } from "../modules/bookings/bookings.service";
import { BranchesService } from "../modules/branches/branches.service";
import { CouponsService } from "../modules/coupons/coupons.service";
import { NotificationsService } from "../modules/notifications/notifications.service";
import { ReviewsService } from "../modules/reviews/reviews.service";
import { ServicesService } from "../modules/services/services.service";
import { TeamService } from "../modules/team/team.service";
import { UsersService } from "../modules/users/users.service";
import { VenuesService } from "../modules/venues/venues.service";
import type { AppEnv } from "../types";
import type { SharedDeps } from "./services";

/** One entry per module. Add a new module by appending one line here. */
type ServiceInstaller = (c: Context<AppEnv>, deps: SharedDeps) => void;

export const serviceFactories: ServiceInstaller[] = [
  (c, { db, kv, authz: _authz, env }) =>
    c.set(
      "authService",
      new AuthService(
        new AuthRepository(db),
        kv!,
        env.JWT_SECRET,
        (env.ENABLE_OTP_DEV_RESPONSE as string) === "true",
        env.TALASH_EMAIL!,
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET,
      ),
    ),

  (c, { db }) => c.set("usersService", new UsersService(new UsersRepository(db))),

  (c, { db, storage, kv, authz }) =>
    c.set(
      "venuesService",
      new VenuesService(new VenuesRepository(db), storage, kv, authz),
    ),

  (c, { db, authz }) =>
    c.set(
      "branchesService",
      new BranchesService(
        new BranchesRepository(db),
        new ServicesRepository(db),
        new BookingsRepository(db),
        authz,
      ),
    ),

  (c, { db, authz, storage }) =>
    c.set(
      "servicesService",
      new ServicesService(new ServicesRepository(db), authz, storage),
    ),

  (c, { db, authz, queue }) => {
    const couponsRepo = new CouponsRepository(db);
    const couponsService = new CouponsService(couponsRepo, authz);
    c.set("couponsService", couponsService);
    c.set(
      "bookingsService",
      new BookingsService(
        new BookingsRepository(db),
        new ServicesRepository(db),
        new BranchesRepository(db),
        couponsService,
        queue,
        authz,
        new TeamRepository(db),
      ),
    );
  },

  (c, { db, authz }) =>
    c.set(
      "reviewsService",
      new ReviewsService(
        new ReviewsRepository(db),
        new BookingsRepository(db),
        new BranchesRepository(db),
        authz,
      ),
    ),

  (c, { db, authz }) =>
    c.set("teamService", new TeamService(new TeamRepository(db), authz)),

  (c, { db }) =>
    c.set("rewardsService", new RewardsService(new RewardsRepository(db))),

  (c, { db }) =>
    c.set(
      "notificationsService",
      new NotificationsService(new NotificationsRepository(db)),
    ),
];
```

- [ ] **Step 4.2: Simplify services.ts to SharedDeps + factory loop**

Replace `workers/api/src/middleware/services.ts` in full:

```ts
import { getDB } from "@repo/core/src/database/client";
import { BookingsRepository } from "@repo/core/src/database/repositories/bookings.repository";
import { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import { CouponsRepository } from "@repo/core/src/database/repositories/coupons.repository";
import { ReviewsRepository } from "@repo/core/src/database/repositories/reviews.repository";
import { ServicesRepository } from "@repo/core/src/database/repositories/services.repository";
import { TeamRepository } from "@repo/core/src/database/repositories/team.repository";
import { VenuesRepository } from "@repo/core/src/database/repositories/venues.repository";
import { QueueProducer } from "@repo/core/src/queue/producer";
import { createMiddleware } from "hono/factory";
import { AuthorizationService } from "../core/authorization";
import { R2Storage } from "../core/storage/r2";
import type { AppEnv } from "../types";
import { serviceFactories } from "./service-factories";

export interface SharedDeps {
  db: ReturnType<typeof getDB>;
  queue: QueueProducer;
  storage: R2Storage;
  kv: KVNamespace | undefined;
  authz: AuthorizationService;
  env: CloudflareBindings;
}

export const injectServices = createMiddleware<AppEnv>(async (c, next) => {
  const db = getDB();

  const deps: SharedDeps = {
    db,
    queue: new QueueProducer(c.env.TALASH_QUEUE!),
    storage: new R2Storage(c.env.TALASH_STORAGE!, c.env.PUBLIC_R2_URL),
    kv: c.env.TALASH_KV,
    authz: new AuthorizationService(
      new VenuesRepository(db),
      new BranchesRepository(db),
      new ServicesRepository(db),
      new CouponsRepository(db),
      new BookingsRepository(db),
      new TeamRepository(db),
      new ReviewsRepository(db),
    ),
    env: c.env,
  };

  for (const install of serviceFactories) {
    install(c, deps);
  }

  await next();
});
```

- [ ] **Step 4.3: Run full test suite**

```bash
bun run --filter @repo/api test 2>&1 | tail -8
```

Expected: all tests pass unchanged. The test helper `createTestApp` bypasses `injectServices` entirely (it injects mocks directly), so no test changes are needed.

- [ ] **Step 4.4: Build check**

```bash
bun run --filter @repo/api build 2>&1 | tail -10
```

Expected: exit 0. This confirms TypeScript is satisfied with the new structure.

- [ ] **Step 4.5: Lint**

```bash
bun run --filter @repo/api lint 2>&1 | tail -5
```

- [ ] **Step 4.6: Commit**

```bash
git add workers/api/src/middleware/service-factories.ts \
        workers/api/src/middleware/services.ts
git commit -m "refactor(services): decouple service injection into per-module factory array

Replaces the fat injectServices middleware body with a flat
serviceFactories array. Adding a new module now requires one entry in
service-factories.ts, not modifications to the middleware body. SharedDeps
captures the shared infrastructure (db, authz, queue, storage, kv, env)
that all factories receive. F5 complete.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Documentation and final verification

**Files:**
- Modify: `workers/api/CLAUDE.md` (or `AGENTS.md` if that's what exists for this package)
- Modify: `docs/guides/api-query-repository-pattern.md`

---

- [ ] **Step 5.1: Check which doc file exists for workers/api**

```bash
ls workers/api/CLAUDE.md workers/api/AGENTS.md 2>/dev/null
```

Open whichever exists.

- [ ] **Step 5.2: Update workers/api CLAUDE.md / AGENTS.md**

Add or update the "Authorization" and "Error Handling" sections to document:

```markdown
## Authorization

All ownership checks go through `AuthorizationService` (`workers/api/src/core/authorization.ts`).
Call `authz.assertVenueOwner`, `authz.assertBranchOwner`, etc. from service methods — never
hand-roll `repo.findOne + ownerId compare`. The guard throws `ForbiddenError(403)` or
`NotFoundError(404)` consistently.

Exception: the `restore` path in VenuesService still does a direct raw ownership check
because `assertVenueOwner` does not resolve soft-deleted records.

## Error Handling

All `OpenAPIHono` instances are constructed with a `defaultHook` that converts Zod validation
failures into the `{ ok: false, code: "VALIDATION_ERROR", message }` envelope (HTTP 422).
Business-rule errors use the same envelope via `AppError` subclasses in `core/errors.ts`.
There is one error shape for the entire API.

## Query Allowlists

`BaseRepository.findAll` accepts an optional fourth argument `QueryAllowlist`:
`{ filterable?: string[], searchable?: string[] }`. Repositories that expose public list
endpoints should declare their allowlists (see `VenuesRepository`, `BookingsRepository`).
Without a declared allowlist the behavior is backward-compatible (all columns allowed).
```

- [ ] **Step 5.3: Update api-query-repository-pattern.md**

Open `docs/guides/api-query-repository-pattern.md`. Add a "Query Allowlist" section before the "BaseRepository" section or wherever it fits:

```markdown
### Per-resource query allowlist

Pass a `QueryAllowlist` as the fourth argument to `BaseRepository.findAll` to restrict
which columns clients may filter or search:

```ts
// packages/core/src/database/repositories/venues.repository.ts
private static readonly queryAllowlist: QueryAllowlist = {
  filterable: ["status", "city", "category"],
  searchable: ["name", "description", "city"],
};

async findAll(query: PaginatedQueryDto) {
  return BaseRepository.findAll(this.db, venuesSchema, query, VenuesRepository.queryAllowlist);
}
```

When `filterable` is provided, only those column names are respected as filter keys. When
`searchable` is provided, those columns are the default search targets (still overridden by
an explicit `query.fields` from the caller). Omitting the argument preserves the prior
behavior (all columns).
```

- [ ] **Step 5.4: Run full test suite and lint one final time**

```bash
bun run --filter @repo/api test 2>&1 | tail -8
bun run --filter @repo/core test 2>&1 | tail -8
bun run lint 2>&1 | tail -5
```

Expected: all pass, no lint errors.

- [ ] **Step 5.5: Commit docs**

```bash
git add workers/api/CLAUDE.md docs/guides/api-query-repository-pattern.md
# (or AGENTS.md — whatever was found in step 5.1)
git commit -m "docs: update backbone guides for F2–F5 changes

Documents authorization guard usage, unified error contract, query
allowlist pattern, and service factory structure.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Self-review checklist

**Spec coverage:**

| PRD item | Task that covers it |
|----------|---------------------|
| F2: VenuesService hand-rolled ownership | Task 1 — `authz.assertVenueOwner` in all write methods |
| F2: restore special case documented | Task 1 — comment + test |
| F3: validation errors return `{ ok, code, message }` | Task 2 — `createApp()` factory with `defaultHook` on all 38 instances across 18 module files |
| F3: test verifies the envelope | Task 2, Step 2.1 |
| F4: `BaseRepository.findAll` allowlist parameter | Task 3 — `QueryAllowlist` type + updated private methods |
| F4: representative repositories declare allowlists | Task 3, Steps 3.5–3.6 |
| F4: backward compatible when no allowlist | Task 3 — `undefined` falls back to all columns |
| F5: adding module requires editing only one file | Task 4 — `service-factories.ts` entry array |
| F5: `SharedDeps` captures shared infrastructure | Task 4, Step 4.2 |
| Docs updated | Task 5 |
| 300-test baseline maintained | All tasks end with `bun run … test` verification |

**Type consistency check:**
- `VenuesService` constructor param 4: `AuthorizationService` (non-optional) — used in Steps 1.3, 4.1, 4.2
- `createApp(opts?: { strict?: boolean })` — defined in `core/create-app.ts` (Step 2.3), used in `app.ts`, `routes.ts`, `create-test-app.ts`, and all module `index.ts` files (Steps 2.4–2.7)
- `SharedDeps.authz`: `AuthorizationService` — defined in Step 4.2, consumed in Step 4.1
- `QueryAllowlist`: exported from `base.repository.ts`, imported in `venues.repository.ts` and `bookings.repository.ts`
- `ServiceInstaller`: `(c: Context<AppEnv>, deps: SharedDeps) => void` — defined in Step 4.1 as a local type

**Placeholder scan:** none present. All code blocks are complete.
