# F4 Completion: Repository Query Allowlists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit `queryAllowlist` definitions to `BranchesRepository`, `CouponsRepository`, and `UsersRepository` so that filter/search column access is opt-in rather than all-column by default, completing the F4 backbone hardening.

**Architecture:** Each repository gets a `private static readonly queryAllowlist: QueryAllowlist` that enumerates which columns are `filterable` (accepted via `?filter[col]=`) and `searchable` (used by `?search=`). This is passed as the fourth argument to every `BaseRepository.findAll` call in that repository. The `QueryAllowlist` type and the `undefined = all-columns` backward-compat path already exist in `BaseRepository` — this change is purely additive for the three uncovered repos.

**Tech Stack:** TypeScript, Drizzle ORM, Vitest, Hono — no new dependencies.

---

## Background

`BaseRepository.findAll` accepts an optional `QueryAllowlist`:
- `filterable?: string[]` — which column names `?filter[col]=val` may address. Undefined = all columns (backward compat).
- `searchable?: string[]` — which columns `?search=` searches by default. Undefined = all columns.

Two repositories already declare allowlists as the pattern to follow:
- `VenuesRepository` → `{ filterable: ["status", "city", "category"], searchable: ["name", "description", "city"] }`
- `BookingsRepository` → `{ filterable: ["status", "branchId", "serviceId", "userId"], searchable: [] }`

**Three repositories currently pass no allowlist**, falling through to the unsafe all-columns default:
| Repository | `findAll` calls | Sensitive / internal columns |
|---|---|---|
| `BranchesRepository` | 1 | `lat`, `lng` (internal geo) |
| `CouponsRepository` | 2 (`findAll` + `findAllByVenue`) | `usedCount`, `maxUses` (accounting fields) |
| `UsersRepository` | 1 | `googleId`, `pushToken` (PII / device token) |

**Critical:** `CouponsRepository.findAllByVenue` internally injects `venueId` into `query.filters`. `venueId` **must** be included in the allowlist or the injected filter will be silently dropped and venue scoping will break.

## File Map

| Action | File |
|---|---|
| **Modify** | `packages/core/src/database/repositories/branches.repository.ts` |
| **Modify** | `packages/core/src/database/repositories/coupons.repository.ts` |
| **Modify** | `packages/core/src/database/repositories/users.repository.ts` |
| **Create** | `workers/api/src/__tests__/lib/repository-allowlists.test.ts` |

---

## Task 1: Write failing allowlist tests for all three repositories

**Files:**
- Create: `workers/api/src/__tests__/lib/repository-allowlists.test.ts`

These tests verify that columns outside each allowlist are silently ignored and columns inside the allowlist work as filters. They must **fail** before the implementation changes are made — the existing all-columns behavior will make the "should be ignored" cases return results instead of none.

- [ ] **Step 1: Create the test file**

```typescript
// workers/api/src/__tests__/lib/repository-allowlists.test.ts
import { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import { CouponsRepository } from "@repo/core/src/database/repositories/coupons.repository";
import { UsersRepository } from "@repo/core/src/database/repositories/users.repository";
import {
  branchesSchema,
  couponsSchema,
  usersSchema,
  venuesSchema,
} from "@repo/core/src/database/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { seedChain } from "../helpers/seed";
import { createTestDb } from "../helpers/test-db";

type Db = ReturnType<typeof createTestDb>;

// ─── Branches ───────────────────────────────────────────────────────────────

describe("BranchesRepository — queryAllowlist", () => {
  let db: Db;
  let branchesRepo: BranchesRepository;
  const TS = "2026-01-01T00:00:00.000Z";

  beforeEach(async () => {
    db = createTestDb();
    branchesRepo = new BranchesRepository(db as never);

    // Two venues, two branches in different cities
    await db.insert(venuesSchema).values({
      id: "v1",
      name: "Venue 1",
      category: "Beauty",
      city: "Dhaka",
      ownerId: "owner-1",
      createdAt: TS,
    } as never);
    await db.insert(venuesSchema).values({
      id: "v2",
      name: "Venue 2",
      category: "Beauty",
      city: "Chittagong",
      ownerId: "owner-1",
      createdAt: "2026-01-02T00:00:00.000Z",
    } as never);

    await db.insert(branchesSchema).values({
      id: "b1",
      venueId: "v1",
      name: "Dhaka Branch",
      address: "1 Dhaka St",
      city: "Dhaka",
      createdAt: TS,
    } as never);
    await db.insert(branchesSchema).values({
      id: "b2",
      venueId: "v2",
      name: "Chittagong Branch",
      address: "1 CTG St",
      city: "Chittagong",
      createdAt: "2026-01-02T00:00:00.000Z",
    } as never);
  });

  it("silently ignores filter on non-allowlisted column (id)", async () => {
    // Filtering by 'id' is not in the filterable allowlist — should be ignored,
    // returning all branches rather than just one.
    const result = await branchesRepo.findAll({ filters: { id: "b1" } });
    // If allowlist is enforced: both rows returned (filter dropped)
    // If allowlist is NOT enforced: only b1 returned — this is the failing case
    expect(result.data).toHaveLength(2);
  });

  it("filters by city when in allowlist", async () => {
    const result = await branchesRepo.findAll({
      filters: { city: "Dhaka" },
    });
    expect(result.data).toHaveLength(1);
    expect((result.data[0] as { id: string }).id).toBe("b1");
  });

  it("filters by venueId when in allowlist", async () => {
    const result = await branchesRepo.findAll({
      filters: { venueId: "v1" },
    });
    expect(result.data).toHaveLength(1);
    expect((result.data[0] as { id: string }).id).toBe("b1");
  });

  it("restricts search to allowlisted columns (name, city, address)", async () => {
    // Search for 'b1' — matches the id column but id is not in searchable allowlist
    const result = await branchesRepo.findAll({ search: "b1" });
    // If allowlist enforced: 0 results (id not searched)
    // If allowlist NOT enforced: may return b1
    expect(result.data).toHaveLength(0);
  });
});

// ─── Coupons ────────────────────────────────────────────────────────────────

describe("CouponsRepository — queryAllowlist", () => {
  let db: Db;
  let couponsRepo: CouponsRepository;
  const TS = "2026-01-01T00:00:00.000Z";
  const EXPIRES = "2027-01-01T00:00:00.000Z";

  beforeEach(async () => {
    db = createTestDb();
    couponsRepo = new CouponsRepository(db as never);

    await db.insert(venuesSchema).values({
      id: "v1",
      name: "Venue 1",
      category: "Beauty",
      city: "Dhaka",
      ownerId: "owner-1",
      createdAt: TS,
    } as never);
    await db.insert(venuesSchema).values({
      id: "v2",
      name: "Venue 2",
      category: "Beauty",
      city: "Dhaka",
      ownerId: "owner-1",
      createdAt: "2026-01-02T00:00:00.000Z",
    } as never);

    // v1 has two coupons (Active + Expired); v2 has one Active
    await db.insert(couponsSchema).values({
      id: "c1",
      venueId: "v1",
      code: "SAVE10",
      type: "Percentage",
      value: 10,
      maxUses: 100,
      status: "Active",
      expiresAt: EXPIRES,
      createdAt: TS,
    } as never);
    await db.insert(couponsSchema).values({
      id: "c2",
      venueId: "v1",
      code: "FLAT50",
      type: "Fixed",
      value: 50,
      maxUses: 50,
      status: "Expired",
      expiresAt: "2025-01-01T00:00:00.000Z",
      createdAt: "2026-01-02T00:00:00.000Z",
    } as never);
    await db.insert(couponsSchema).values({
      id: "c3",
      venueId: "v2",
      code: "V2DEAL",
      type: "Fixed",
      value: 20,
      maxUses: 10,
      status: "Active",
      expiresAt: EXPIRES,
      createdAt: "2026-01-03T00:00:00.000Z",
    } as never);
  });

  it("silently ignores filter on non-allowlisted column (usedCount)", async () => {
    // usedCount is not in the filterable allowlist — filter ignored, all 3 returned
    const result = await couponsRepo.findAll({
      filters: { usedCount: "0" },
    });
    expect(result.data).toHaveLength(3);
  });

  it("filters by status when in allowlist", async () => {
    const result = await couponsRepo.findAll({ filters: { status: "Active" } });
    expect(result.data).toHaveLength(2);
  });

  it("filters by type when in allowlist", async () => {
    const result = await couponsRepo.findAll({
      filters: { type: "Percentage" },
    });
    expect(result.data).toHaveLength(1);
    expect((result.data[0] as { id: string }).id).toBe("c1");
  });

  it("findAllByVenue still scopes to the given venue (internal venueId filter honored)", async () => {
    // The internal venueId filter injected by findAllByVenue must still work
    // even with the allowlist in place — venueId must be in filterable.
    const result = await couponsRepo.findAllByVenue("v1", {});
    expect(result.data).toHaveLength(2);
    for (const row of result.data) {
      expect((row as { venueId: string }).venueId).toBe("v1");
    }
  });

  it("findAllByVenue does not leak other venue's coupons", async () => {
    const result = await couponsRepo.findAllByVenue("v2", {});
    expect(result.data).toHaveLength(1);
    expect((result.data[0] as { id: string }).id).toBe("c3");
  });
});

// ─── Users ──────────────────────────────────────────────────────────────────

describe("UsersRepository — queryAllowlist", () => {
  let db: Db;
  let usersRepo: UsersRepository;
  const TS = "2026-01-01T00:00:00.000Z";

  beforeEach(async () => {
    db = createTestDb();
    usersRepo = new UsersRepository(db as never);

    await db.insert(usersSchema).values({
      id: "u1",
      name: "Alice Owner",
      email: "alice@example.com",
      role: "owner",
      googleId: "google-alice",
      createdAt: TS,
    } as never);
    await db.insert(usersSchema).values({
      id: "u2",
      name: "Bob User",
      email: "bob@example.com",
      role: "user",
      googleId: "google-bob",
      createdAt: "2026-01-02T00:00:00.000Z",
    } as never);
  });

  it("silently ignores filter on non-allowlisted column (googleId)", async () => {
    // googleId is PII — must not be filterable. Filter silently ignored → both users returned.
    const result = await usersRepo.findAll({
      filters: { googleId: "google-alice" },
    });
    expect(result.data).toHaveLength(2);
  });

  it("silently ignores filter on non-allowlisted column (pushToken)", async () => {
    const result = await usersRepo.findAll({
      filters: { pushToken: "any-token" },
    });
    expect(result.data).toHaveLength(2);
  });

  it("filters by role when in allowlist", async () => {
    const result = await usersRepo.findAll({ filters: { role: "owner" } });
    expect(result.data).toHaveLength(1);
    expect((result.data[0] as { id: string }).id).toBe("u1");
  });

  it("restricts search to name, email, phone — not googleId", async () => {
    // Searching 'google-alice' should match nothing (googleId not searchable)
    const result = await usersRepo.findAll({ search: "google-alice" });
    expect(result.data).toHaveLength(0);
  });

  it("searches by name when in searchable allowlist", async () => {
    const result = await usersRepo.findAll({ search: "Alice" });
    expect(result.data).toHaveLength(1);
    expect((result.data[0] as { id: string }).id).toBe("u1");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail as expected**

```bash
cd /path/to/monorepo
bun run --filter @repo/api test src/__tests__/lib/repository-allowlists.test.ts
```

Expected: failures on the "silently ignores" cases (currently returns rows because no allowlist enforces the restriction).

---

## Task 2: Add queryAllowlist to BranchesRepository

**Files:**
- Modify: `packages/core/src/database/repositories/branches.repository.ts`

- [ ] **Step 1: Add the QueryAllowlist import and static field**

In `branches.repository.ts`, change the import line and add the allowlist. Replace the opening of the class:

```typescript
// At the top, change:
import { BaseRepository } from "./base.repository";
// to:
import { BaseRepository, type QueryAllowlist } from "./base.repository";
```

Then inside `BranchesRepository`, add the static field **before** the constructor:

```typescript
export class BranchesRepository {
  private static readonly queryAllowlist: QueryAllowlist = {
    filterable: ["venueId", "city"],
    searchable: ["name", "city", "address"],
  };

  constructor(private readonly db: DbClient) {}
  // ... rest unchanged
```

- [ ] **Step 2: Pass the allowlist to findAll**

Replace the `findAll` method body:

```typescript
async findAll(
  query: PaginatedQueryDto,
): Promise<PaginatedResponse<BranchSelect>> {
  return BaseRepository.findAll(
    this.db,
    branchesSchema,
    query,
    BranchesRepository.queryAllowlist,
  ) as Promise<PaginatedResponse<BranchSelect>>;
}
```

- [ ] **Step 3: Run the Branches tests to verify they pass**

```bash
bun run --filter @repo/api test src/__tests__/lib/repository-allowlists.test.ts --reporter=verbose 2>&1 | grep -A2 "BranchesRepository"
```

Expected: all 4 Branches test cases pass.

- [ ] **Step 4: Run the full API test suite to confirm no regressions**

```bash
bun run --filter @repo/api test
```

Expected: `35 passed (35)` — same count as before.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/database/repositories/branches.repository.ts \
        workers/api/src/__tests__/lib/repository-allowlists.test.ts
git commit -m "feat(query): add queryAllowlist to BranchesRepository (F4)"
```

---

## Task 3: Add queryAllowlist to CouponsRepository

**Files:**
- Modify: `packages/core/src/database/repositories/coupons.repository.ts`

**Critical:** `findAllByVenue` injects `venueId` as an internal filter. `venueId` must be in `filterable` or the venue scoping silently breaks.

- [ ] **Step 1: Add the QueryAllowlist import and static field**

Replace the import line:
```typescript
// Change:
import { BaseRepository } from "./base.repository";
// To:
import { BaseRepository, type QueryAllowlist } from "./base.repository";
```

Add the static field inside the class, before the constructor:

```typescript
export class CouponsRepository {
  private static readonly queryAllowlist: QueryAllowlist = {
    filterable: ["venueId", "status", "type"],
    searchable: ["code"],
  };

  constructor(private readonly db: DbClient) {}
  // ... rest unchanged
```

- [ ] **Step 2: Pass the allowlist to both findAll and findAllByVenue**

Replace both methods:

```typescript
async findAll(
  query: PaginatedQueryDto,
): Promise<PaginatedResponse<CouponSelect>> {
  return BaseRepository.findAll(
    this.db,
    couponsSchema,
    query,
    CouponsRepository.queryAllowlist,
  ) as Promise<PaginatedResponse<CouponSelect>>;
}

async findAllByVenue(
  venueId: string,
  query: PaginatedQueryDto,
): Promise<PaginatedResponse<CouponSelect>> {
  return BaseRepository.findAll(
    this.db,
    couponsSchema,
    {
      ...query,
      filters: { ...query.filters, venueId },
    },
    CouponsRepository.queryAllowlist,
  ) as Promise<PaginatedResponse<CouponSelect>>;
}
```

- [ ] **Step 3: Run the Coupons tests to verify they pass**

```bash
bun run --filter @repo/api test src/__tests__/lib/repository-allowlists.test.ts --reporter=verbose 2>&1 | grep -A2 "CouponsRepository"
```

Expected: all 5 Coupons test cases pass.

- [ ] **Step 4: Run the full API test suite to confirm no regressions**

```bash
bun run --filter @repo/api test
```

Expected: all 35+ test files pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/database/repositories/coupons.repository.ts
git commit -m "feat(query): add queryAllowlist to CouponsRepository (F4)"
```

---

## Task 4: Add queryAllowlist to UsersRepository

**Files:**
- Modify: `packages/core/src/database/repositories/users.repository.ts`

`googleId` and `pushToken` must be excluded — they are PII / sensitive device credentials and must not be filterable or searchable via query parameters.

- [ ] **Step 1: Add the QueryAllowlist import and static field**

Replace the import block at the top (only one import from `base.repository` to change):

```typescript
// Change:
import { BaseRepository } from "./base.repository";
// To:
import { BaseRepository, type QueryAllowlist } from "./base.repository";
```

Add the static field inside the class, before the constructor:

```typescript
export class UsersRepository {
  private static readonly queryAllowlist: QueryAllowlist = {
    filterable: ["role"],
    searchable: ["name", "email", "phone"],
  };

  constructor(private readonly db: DbClient) {}
  // ... rest unchanged
```

- [ ] **Step 2: Pass the allowlist to findAll**

Replace the `findAll` method body:

```typescript
async findAll(
  query: PaginatedQueryDto,
): Promise<FullPaginatedResponse<UserSelect>> {
  const result = await BaseRepository.findAll(
    this.db,
    usersSchema,
    query,
    UsersRepository.queryAllowlist,
  );
  return result as FullPaginatedResponse<UserSelect>;
}
```

- [ ] **Step 3: Run the Users tests to verify they pass**

```bash
bun run --filter @repo/api test src/__tests__/lib/repository-allowlists.test.ts --reporter=verbose 2>&1 | grep -A2 "UsersRepository"
```

Expected: all 5 Users test cases pass.

- [ ] **Step 4: Run the full API test suite to confirm no regressions**

```bash
bun run --filter @repo/api test
```

Expected: all test files pass, test count increases by 14 (the new allowlist tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/database/repositories/users.repository.ts
git commit -m "feat(query): add queryAllowlist to UsersRepository (F4)"
```

---

## Task 5: Update documentation and close the loop

**Files:**
- Modify: `workers/api/CLAUDE.md` — update the allowlist docs to list all five repositories that now have allowlists

- [ ] **Step 1: Update the query section in workers/api/CLAUDE.md**

Find the paragraph that reads:

> `BaseRepository.findAll` accepts an optional `QueryAllowlist` ... See `VenuesRepository` and `BookingsRepository` for examples...

Update the "See" clause to include all five repositories:

```
See `VenuesRepository`, `BookingsRepository`, `BranchesRepository`, `CouponsRepository`, and `UsersRepository` for examples; see guide section 19 for full details.
```

- [ ] **Step 2: Update docs/guides/api-query-repository-pattern.md section 19**

Find the F4 / queryAllowlist section. Add a table listing the current allowlist for each repository:

```markdown
### Repositories with allowlists

| Repository | filterable | searchable |
|---|---|---|
| `VenuesRepository` | `status`, `city`, `category` | `name`, `description`, `city` |
| `BookingsRepository` | `status`, `branchId`, `serviceId`, `userId` | _(empty — no freetext search)_ |
| `BranchesRepository` | `venueId`, `city` | `name`, `city`, `address` |
| `CouponsRepository` | `venueId`, `status`, `type` | `code` |
| `UsersRepository` | `role` | `name`, `email`, `phone` |
```

Note below the table: "`googleId` and `pushToken` are intentionally excluded from `UsersRepository.queryAllowlist` — they are PII / device credentials and must not be externally filterable."

- [ ] **Step 3: Commit the documentation**

```bash
git add workers/api/CLAUDE.md docs/guides/api-query-repository-pattern.md
git commit -m "docs: document queryAllowlist for all five repositories (F4 complete)"
```

---

## Self-Review

**Spec coverage:**
- ✅ BranchesRepository gets an allowlist — Task 2
- ✅ CouponsRepository gets an allowlist on both `findAll` calls — Task 3
- ✅ `findAllByVenue` venue scoping preserved (`venueId` in filterable) — Task 3
- ✅ UsersRepository excludes `googleId` and `pushToken` — Task 4
- ✅ Tests at the repository seam verifying enforcement — Task 1
- ✅ Documentation updated — Task 5

**Placeholder scan:** No TBDs, TODOs, or incomplete steps.

**Type consistency:**
- `QueryAllowlist` is the same type imported from `base.repository.ts` in all three tasks ✓
- `BranchesRepository.queryAllowlist`, `CouponsRepository.queryAllowlist`, `UsersRepository.queryAllowlist` — consistent naming with `VenuesRepository` and `BookingsRepository` ✓
- `findAll` and `findAllByVenue` in CouponsRepository both receive the same allowlist constant ✓
