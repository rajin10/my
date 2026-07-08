# F1 — Cursor Pagination Keyset Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `BaseRepository.findAll` cursor pagination so paginated lists return each row exactly once in the requested order, instead of silently skipping/repeating rows.

**Architecture:** Primary keys are random `text` UUIDs, so the current keyset (`WHERE id > cursor ORDER BY id ASC`) is lexicographic over random values — incorrect, and it ignores `sortBy`. Replace it with a stable composite keyset on `(createdAt, id)` that honors the `sortBy` direction, with an opaque hex-encoded cursor carrying both fields. Verify correctness against a real in-memory SQLite database (injected into `findAll`, no Cloudflare/D1 runtime needed) plus a pure unit test for the cursor codec.

**Tech Stack:** TypeScript, Drizzle ORM (SQLite dialect), Hono, Vitest (node), better-sqlite3 (test-only).

---

## Background & Context

Read these before starting:

- **The bug:** `packages/core/src/database/repositories/base.repository.ts`, method `findAll`, the `// ── Cursor mode` block. It does `whereConditions.push(gt(idCol, query.cursor))` and `.orderBy(asc(idCol))`, returning `nextCursor = String(lastRow.id)`. IDs come from `primaryID()` in `packages/core/src/database/helpers.ts` → `crypto.randomUUID()`. Ordering random UUIDs lexicographically is meaningless, so "next page" skips and repeats rows.
- **Every table has `createdAt`:** the `timestamps()` helper (`packages/core/src/database/helpers.ts`) adds `createdAt: text().notNull().$defaultFn(() => new Date().toISOString())` to every schema. So `(createdAt, id)` is a valid universal keyset.
- **`findAll` takes `db` as a parameter** (`BaseRepository.findAll(db, table, query)`), and `base.repository.ts` only *type*-imports the D1 client. This lets tests inject an in-memory `better-sqlite3` drizzle instance over the same `sqliteTable` schema objects — the query builder emits identical SQLite SQL.
- **No production code consumes `nextCursor` yet** (confirmed by grep across `apps/`, `sites/`, `workers/`). Changing the cursor format is safe.
- **Query DTO:** `packages/core/src/http/response.ts` — `paginatedQueryDto` has `cursor: z.string().optional()`, `sortBy: z.enum(["asc","desc"]).default("desc")`, `limit` (max 100, default 10).
- **Response shape:** `PaginatedResponse<T>` = `{ data: T[]; query: BaseQueryDto & Pagination }`. `Pagination` includes `mode?: "offset" | "cursor"` and `nextCursor?: string | null`.

### Design decisions (locked)

1. **Keyset = `(createdAt, id)`, direction = `sortBy`.** Cursor mode honors the sort *direction* only. An arbitrary `sort` *column* cannot be coherently keyset-paginated against `(createdAt, id)`; in cursor mode the `sort` column is ignored and ordering is always `(createdAt, id)`. This is documented as a known limitation (use offset mode to sort by another column). This satisfies PRD story 3's `sortBy` guarantee.
2. **Malformed cursor → treat as first page.** `packages/core` has no error infrastructure and repositories never throw (they return `{ data: null }` / empty). Throwing here would surface as a 500. A malformed/tampered opaque cursor therefore degrades to "restart from the first page" (no keyset condition).
3. **Cursor-mode entry/reachability is unchanged and OUT OF SCOPE.** Cursor mode is still entered only when `query.cursor !== undefined`. How a client first obtains a cursor (the opt-in handshake) is a separate follow-up; F1 only guarantees that *when a cursor is supplied, pagination is correct*.

---

## File Structure

| File | Responsibility | Change |
| --- | --- | --- |
| `packages/core/src/http/cursor.ts` | Pure opaque-cursor codec: `encodeCursor`/`decodeCursor` over `(createdAt, id)` | Create |
| `packages/core/src/__tests__/cursor.test.ts` | Unit tests for the codec (round-trip, malformed, edge) | Create |
| `packages/core/src/database/repositories/base.repository.ts` | Replace the cursor-mode keyset block in `findAll` | Modify |
| `workers/api/src/__tests__/helpers/test-db.ts` | In-memory SQLite drizzle factory (runs migrations) for repository tests | Create |
| `workers/api/src/__tests__/lib/base-repository-pagination.test.ts` | Real-DB integration test proving keyset correctness | Create |
| `workers/api/src/__tests__/modules/venues/venues.routes.test.ts` | Add a case: cursor param round-trips to service, `nextCursor` surfaces in response | Modify |
| `workers/api/package.json` | Add `better-sqlite3` + `@types/better-sqlite3` devDependencies | Modify |
| `docs/guides/api-query-repository-pattern.md` | Document cursor pagination semantics + sort limitation | Modify |

---

## Task 1: Cursor codec (pure, unit-tested)

**Files:**
- Create: `packages/core/src/http/cursor.ts`
- Test: `packages/core/src/__tests__/cursor.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/cursor.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "../http/cursor";

describe("cursor codec", () => {
	it("round-trips createdAt and id", () => {
		const token = encodeCursor("2026-01-02T03:04:05.000Z", "uuid-abc");
		expect(decodeCursor(token)).toEqual({
			createdAt: "2026-01-02T03:04:05.000Z",
			id: "uuid-abc",
		});
	});

	it("produces an opaque token (not the raw id)", () => {
		const token = encodeCursor("2026-01-02T03:04:05.000Z", "uuid-abc");
		expect(token).not.toContain("uuid-abc");
		expect(token).toMatch(/^[0-9a-f]+$/);
	});

	it("returns null for a malformed (non-hex) cursor", () => {
		expect(decodeCursor("not-a-cursor!!")).toBeNull();
	});

	it("returns null for a valid-hex cursor missing the delimiter", () => {
		// hex of "nodelimiter" — decodes cleanly but has no '|'
		const hex = Array.from(new TextEncoder().encode("nodelimiter"))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
		expect(decodeCursor(hex)).toBeNull();
	});

	it("returns null when createdAt or id is empty", () => {
		const hexEmptyId = Array.from(new TextEncoder().encode("2026-01-01|"))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
		expect(decodeCursor(hexEmptyId)).toBeNull();
	});

	it("preserves an id that itself contains the delimiter only in createdAt-safe way", () => {
		// ISO timestamps never contain '|'; ids are UUIDs without '|'. Round-trip a normal pair.
		const token = encodeCursor("2026-12-31T23:59:59.999Z", "0f8fad5b-d9cb-469f-a165-70867728950e");
		expect(decodeCursor(token)).toEqual({
			createdAt: "2026-12-31T23:59:59.999Z",
			id: "0f8fad5b-d9cb-469f-a165-70867728950e",
		});
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run --filter @repo/core test -- cursor`
Expected: FAIL — `Cannot find module '../http/cursor'`.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/http/cursor.ts`:

```ts
/**
 * Opaque cursor codec for keyset pagination.
 *
 * A cursor encodes the `(createdAt, id)` of the last row on a page so the next
 * page can be fetched with a stable composite keyset. The token is hex-encoded
 * so callers treat it as opaque. ISO-8601 timestamps and UUIDs never contain
 * the `|` delimiter, so a single split is unambiguous.
 */

const DELIMITER = "|";

function toHex(value: string): string {
	const bytes = new TextEncoder().encode(value);
	let out = "";
	for (const byte of bytes) {
		out += byte.toString(16).padStart(2, "0");
	}
	return out;
}

function fromHex(hex: string): string {
	if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/.test(hex)) {
		throw new Error("Invalid hex");
	}
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return new TextDecoder().decode(bytes);
}

export interface CursorParts {
	createdAt: string;
	id: string;
}

export function encodeCursor(createdAt: string, id: string): string {
	return toHex(`${createdAt}${DELIMITER}${id}`);
}

/**
 * Decodes an opaque cursor. Returns `null` for any malformed input so callers
 * can degrade gracefully (treat as first page) instead of throwing.
 */
export function decodeCursor(cursor: string): CursorParts | null {
	let decoded: string;
	try {
		decoded = fromHex(cursor);
	} catch {
		return null;
	}

	const idx = decoded.indexOf(DELIMITER);
	if (idx === -1) {
		return null;
	}

	const createdAt = decoded.slice(0, idx);
	const id = decoded.slice(idx + 1);
	if (!createdAt || !id) {
		return null;
	}

	return { createdAt, id };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run --filter @repo/core test -- cursor`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/http/cursor.ts packages/core/src/__tests__/cursor.test.ts
git commit -m "feat(core): add opaque cursor codec for keyset pagination"
```

---

## Task 2: In-memory SQLite test harness

This gives repository tests a real database (so we verify actual SQL keyset behavior, not mocks). It injects a `better-sqlite3` drizzle instance — no Cloudflare/D1 runtime.

**Files:**
- Modify: `workers/api/package.json` (devDependencies)
- Create: `workers/api/src/__tests__/helpers/test-db.ts`
- Test (smoke): `workers/api/src/__tests__/helpers/test-db.smoke.test.ts`

- [ ] **Step 1: Add the test-only dependency**

Run (from repo root):

```bash
bun add --cwd workers/api --dev better-sqlite3 @types/better-sqlite3
```

Expected: `workers/api/package.json` gains `better-sqlite3` and `@types/better-sqlite3` under `devDependencies`; install succeeds.

- [ ] **Step 2: Write the smoke test (failing)**

Create `workers/api/src/__tests__/helpers/test-db.smoke.test.ts`:

```ts
import { venuesSchema } from "@repo/core/src/database/schema";
import { describe, expect, it } from "vitest";
import { createTestDb } from "./test-db";

describe("createTestDb", () => {
	it("creates a usable in-memory db with the venues table", async () => {
		const db = createTestDb();
		await db.insert(venuesSchema).values({
			id: "v-1",
			ownerId: "o-1",
			name: "Smoke Venue",
			category: "Beauty",
			city: "Dhaka",
			createdAt: "2026-01-01T00:00:00.000Z",
		} as never);
		const rows = await db.select().from(venuesSchema);
		expect(rows).toHaveLength(1);
	});
});
```

> Note: confirm the exact export name for the venues table in `@repo/core/src/database/schema` (it is `venuesSchema` per `packages/core/src/database/schema/venues.schema.ts`). If a different table is more convenient, any table from `timestamps()` works.

- [ ] **Step 3: Run the smoke test to verify it fails**

Run: `bun run --filter @repo/api test -- test-db.smoke`
Expected: FAIL — `Cannot find module './test-db'`.

- [ ] **Step 4: Write the harness**

Create `workers/api/src/__tests__/helpers/test-db.ts`:

```ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "@repo/core/src/database/schema";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

const MIGRATIONS_DIR = fileURLToPath(
	new URL("../../database/migrations", import.meta.url),
);

/**
 * Builds a fresh in-memory SQLite database with the full schema applied by
 * replaying the drizzle migration SQL files, and returns a drizzle client.
 *
 * Foreign keys are left OFF (better-sqlite3 default) so a single table can be
 * seeded without inserting rows into its referenced tables.
 */
export function createTestDb() {
	const sqlite = new Database(":memory:");

	const files = readdirSync(MIGRATIONS_DIR)
		.filter((f) => f.endsWith(".sql"))
		.sort();

	for (const file of files) {
		// drizzle's `--> statement-breakpoint` lines start with `--` (SQL comment),
		// so the whole file can be exec'd at once.
		const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
		sqlite.exec(sql);
	}

	return drizzle(sqlite, { schema });
}
```

- [ ] **Step 5: Run the smoke test to verify it passes**

Run: `bun run --filter @repo/api test -- test-db.smoke`
Expected: PASS.

> If a migration statement throws under better-sqlite3 (e.g. a D1-specific statement), narrow the harness: replace the migration loop with an explicit `sqlite.exec()` of just the `CREATE TABLE` statements for the table(s) under test, copied verbatim from `0000_initial_migration.sql`. Prefer the full migration replay if it works.

- [ ] **Step 6: Commit**

```bash
git add workers/api/package.json workers/api/src/__tests__/helpers/test-db.ts workers/api/src/__tests__/helpers/test-db.smoke.test.ts
git commit -m "test(api): add in-memory sqlite harness for repository tests"
```

---

## Task 3: Keyset pagination fix (failing test → implementation)

**Files:**
- Create: `workers/api/src/__tests__/lib/base-repository-pagination.test.ts`
- Modify: `packages/core/src/database/repositories/base.repository.ts`

- [ ] **Step 1: Write the failing integration test**

Create `workers/api/src/__tests__/lib/base-repository-pagination.test.ts`:

```ts
import { BaseRepository } from "@repo/core/src/database/repositories/base.repository";
import { venuesSchema } from "@repo/core/src/database/schema";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../helpers/test-db";

type Db = ReturnType<typeof createTestDb>;

// Five venues. Two share a createdAt (the tie case the keyset must break on id).
const SEED = [
	{ id: "id-zzz", createdAt: "2026-01-01T00:00:00.000Z" },
	{ id: "id-aaa", createdAt: "2026-01-01T00:00:00.000Z" }, // tie with id-zzz
	{ id: "id-mmm", createdAt: "2026-01-02T00:00:00.000Z" },
	{ id: "id-bbb", createdAt: "2026-01-03T00:00:00.000Z" },
	{ id: "id-yyy", createdAt: "2026-01-04T00:00:00.000Z" },
];

async function seed(db: Db) {
	for (const row of SEED) {
		await db.insert(venuesSchema).values({
			id: row.id,
			ownerId: "owner-1",
			name: `Venue ${row.id}`,
			category: "Beauty",
			city: "Dhaka",
			createdAt: row.createdAt,
		} as never);
	}
}

function ids(rows: Array<Record<string, unknown>>) {
	return rows.map((r) => r.id as string);
}

describe("BaseRepository.findAll — cursor pagination", () => {
	let db: Db;

	beforeEach(async () => {
		db = createTestDb();
		await seed(db);
	});

	it("paginates desc by (createdAt, id) returning disjoint, complete, ordered pages", async () => {
		// Page 1 (cursor mode entered via empty cursor)
		const p1 = await BaseRepository.findAll(db as never, venuesSchema, {
			cursor: "",
			limit: 2,
			sortBy: "desc",
		});
		expect(p1.query.mode).toBe("cursor");
		expect(ids(p1.data)).toEqual(["id-yyy", "id-bbb"]);
		expect(p1.query.hasNextPage).toBe(true);
		expect(p1.query.nextCursor).toBeTruthy();

		// Page 2
		const p2 = await BaseRepository.findAll(db as never, venuesSchema, {
			cursor: p1.query.nextCursor as string,
			limit: 2,
			sortBy: "desc",
		});
		// id-mmm (02), then the tie at 01 broken by id desc => id-zzz before id-aaa
		expect(ids(p2.data)).toEqual(["id-mmm", "id-zzz"]);
		expect(p2.query.hasNextPage).toBe(true);

		// Page 3 (last)
		const p3 = await BaseRepository.findAll(db as never, venuesSchema, {
			cursor: p2.query.nextCursor as string,
			limit: 2,
			sortBy: "desc",
		});
		expect(ids(p3.data)).toEqual(["id-aaa"]);
		expect(p3.query.hasNextPage).toBe(false);
		expect(p3.query.nextCursor).toBeNull();

		const all = [...ids(p1.data), ...ids(p2.data), ...ids(p3.data)];
		expect(new Set(all).size).toBe(5); // disjoint
		expect(all).toHaveLength(5); // complete
	});

	it("honors asc direction", async () => {
		const p1 = await BaseRepository.findAll(db as never, venuesSchema, {
			cursor: "",
			limit: 2,
			sortBy: "asc",
		});
		// asc by (createdAt, id): tie at 01 => id-aaa before id-zzz
		expect(ids(p1.data)).toEqual(["id-aaa", "id-zzz"]);
	});

	it("excludes soft-deleted rows", async () => {
		await db
			.update(venuesSchema)
			.set({ deletedAt: "2026-02-01T00:00:00.000Z" } as never)
			// soft-delete the newest row so its absence is observable on page 1
			.where(eq(venuesSchema.id, "id-yyy"));

		const p1 = await BaseRepository.findAll(db as never, venuesSchema, {
			cursor: "",
			limit: 2,
			sortBy: "desc",
		});
		expect(ids(p1.data)).toEqual(["id-bbb", "id-mmm"]);
	});

	it("treats a malformed cursor as the first page", async () => {
		const p = await BaseRepository.findAll(db as never, venuesSchema, {
			cursor: "garbage!!",
			limit: 2,
			sortBy: "desc",
		});
		expect(ids(p.data)).toEqual(["id-yyy", "id-bbb"]);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run --filter @repo/api test -- base-repository-pagination`
Expected: FAIL — the current implementation orders by `id` ascending and emits a raw-id cursor, so page contents (`id-yyy, id-bbb`) and ordering assertions do not match.

- [ ] **Step 3: Update the imports in `base.repository.ts`**

In `packages/core/src/database/repositories/base.repository.ts`, extend the existing `drizzle-orm` import to add `and`, `eq`, `lt`, `or` (keep `asc`, `desc`, `getTableColumns as getColumns`, `gt`, the `Infer*` types, and `sql`):

```ts
import {
	and,
	asc,
	desc,
	eq,
	getTableColumns as getColumns,
	gt,
	type InferInsertModel,
	type InferSelectModel,
	lt,
	or,
	sql,
} from "drizzle-orm";
```

Add the codec import alongside the existing imports:

```ts
import { decodeCursor, encodeCursor } from "../../http/cursor";
```

- [ ] **Step 4: Replace the cursor-mode block in `findAll`**

In `findAll`, replace the entire `// ── Cursor mode ──` block (the `if (query.cursor !== undefined && "id" in tableColumns) { ... }` block) with:

```ts
		// ── Cursor mode ──────────────────────────────────────────────────────────
		// Keyset pagination on the stable composite key (createdAt, id). Honors the
		// requested sort *direction* (sortBy); the sort *column* is not used in
		// cursor mode. A malformed cursor degrades to the first page. `page` is
		// ignored. Requires both `createdAt` and `id` columns.
		if (
			query.cursor !== undefined &&
			"id" in tableColumns &&
			"createdAt" in tableColumns
		) {
			const idCol = tableColumns.id as never;
			const createdAtCol = tableColumns.createdAt as never;
			const isAsc = query.sortBy === "asc";

			if (query.cursor !== "") {
				const parts = decodeCursor(query.cursor);
				if (parts) {
					const keyset = isAsc
						? or(
								gt(createdAtCol, parts.createdAt),
								and(
									eq(createdAtCol, parts.createdAt),
									gt(idCol, parts.id),
								),
							)
						: or(
								lt(createdAtCol, parts.createdAt),
								and(
									eq(createdAtCol, parts.createdAt),
									lt(idCol, parts.id),
								),
							);
					whereConditions.push(keyset);
				}
				// parts === null → malformed cursor → no keyset → first page
			}

			const orderExprs = isAsc
				? [asc(createdAtCol), asc(idCol)]
				: [desc(createdAtCol), desc(idCol)];

			const whereClause = BaseRepository.buildWhereClause(whereConditions);

			const baseQuery = db
				.select()
				.from(table)
				// Fetch one extra row to detect whether another page exists
				.limit(currentLimit + 1)
				.orderBy(...orderExprs);

			const rows = (
				whereClause ? await baseQuery.where(whereClause) : await baseQuery
			) as InferSelectModel<TTable>[];

			const hasNextPage = rows.length > currentLimit;
			const results = rows.slice(0, currentLimit) as Partial<
				InferSelectModel<TTable>
			>[];
			const lastRow = results[results.length - 1] as
				| Record<string, unknown>
				| undefined;
			const nextCursor =
				hasNextPage && lastRow
					? encodeCursor(String(lastRow.createdAt), String(lastRow.id))
					: null;

			return {
				data: results,
				query: {
					...query,
					page: 1,
					limit: currentLimit,
					total: 0,
					totalPages: 0,
					hasNextPage,
					hasPrevPage: false,
					mode: "cursor",
					nextCursor,
				},
			};
		}
```

- [ ] **Step 5: Run the integration test to verify it passes**

Run: `bun run --filter @repo/api test -- base-repository-pagination`
Expected: PASS (4 tests).

- [ ] **Step 6: Run the full core + api suites to check for regressions**

Run: `bun run --filter @repo/core test && bun run --filter @repo/api test`
Expected: all green (the existing 270+ tests still pass; no test asserted the old raw-id cursor format).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/database/repositories/base.repository.ts workers/api/src/__tests__/lib/base-repository-pagination.test.ts
git commit -m "fix(core): keyset cursor pagination on (createdAt, id) honoring sortBy"
```

---

## Task 4: Route-level cursor plumbing test (HTTP seam)

Proves the cursor query param survives DTO validation and that `nextCursor` is surfaced through the HTTP response — the second seam called for by the PRD.

**Files:**
- Modify: `workers/api/src/__tests__/modules/venues/venues.routes.test.ts`

- [ ] **Step 1: Add the failing test case**

Append inside the existing `describe("GET /api/v1/venues", ...)` block in `workers/api/src/__tests__/modules/venues/venues.routes.test.ts`:

```ts
	it("passes a cursor query param through and surfaces nextCursor", async () => {
		mockVenuesService.list.mockResolvedValue({
			data: [fakeVenue],
			query: {
				page: 1,
				limit: 10,
				total: 0,
				totalPages: 0,
				hasNextPage: true,
				hasPrevPage: false,
				mode: "cursor",
				nextCursor: "abc123",
			},
		});

		const res = await app.request("/api/v1/venues?cursor=abc123&limit=10");
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			query: { mode: string; nextCursor: string };
		};
		expect(body.query.mode).toBe("cursor");
		expect(body.query.nextCursor).toBe("abc123");

		// the handler forwarded the validated cursor to the service
		expect(mockVenuesService.list).toHaveBeenCalledWith(
			expect.objectContaining({ cursor: "abc123" }),
		);
	});
```

> Verify the venues list route's query schema accepts `cursor`. `venues.routes.ts` `listVenuesRoute` currently declares only `page/limit/search/sort/sortBy` — if `cursor` is absent from that inline schema, add `cursor: z.string().optional()` to it so the param reaches the service. (This is a one-line schema addition, not a behavior change for existing callers.)

- [ ] **Step 2: Run the test**

Run: `bun run --filter @repo/api test -- venues.routes`
Expected: FAIL if `cursor` is not in the route schema (service called without `cursor`), else it guides the schema fix.

- [ ] **Step 3: Add `cursor` to the venues list query schema if missing**

In `workers/api/src/modules/venues/venues.routes.ts`, in `listVenuesRoute`'s `request.query` object, add:

```ts
			cursor: z.string().optional(),
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run --filter @repo/api test -- venues.routes`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add workers/api/src/__tests__/modules/venues/venues.routes.test.ts workers/api/src/modules/venues/venues.routes.ts
git commit -m "test(api): verify cursor param plumbing and nextCursor in venues list"
```

---

## Task 5: Documentation + final verification

**Files:**
- Modify: `docs/guides/api-query-repository-pattern.md`

- [ ] **Step 1: Document cursor pagination semantics**

In `docs/guides/api-query-repository-pattern.md`, add a "Cursor pagination" subsection under the query/pagination documentation. Content to include (prose, adapt to the doc's style):

```markdown
### Cursor pagination

List endpoints support keyset (cursor) pagination via the `cursor` query
parameter, in addition to offset pagination (`page`/`limit`).

- Supplying `cursor=` (empty) requests the first page in cursor mode; the
  response's `query.nextCursor` is an opaque token. Pass it back as `cursor`
  to fetch the next page. `nextCursor` is `null` on the last page.
- Cursor mode keysets on `(createdAt, id)` and honors the sort **direction**
  (`sortBy=asc|desc`). It does **not** support sorting by an arbitrary `sort`
  column — use offset pagination if you need to sort by another column.
- A malformed or tampered cursor degrades to the first page rather than erroring.
- Cursor mode avoids the `COUNT(*)` of offset mode and is stable under
  concurrent inserts, so it is preferred for large or fast-changing lists.
```

- [ ] **Step 2: Run lint, full test suite, and build**

Run:

```bash
bun run lint && bun run --filter @repo/core test && bun run --filter @repo/api test && bun run build
```

Expected: lint clean, all tests pass, build succeeds.

> If `bun run build` is heavy or unavailable for these packages, scope to `bun run --filter @repo/api build` and `bun run --filter @repo/core build`. Record whatever you actually ran.

- [ ] **Step 3: Commit**

```bash
git add docs/guides/api-query-repository-pattern.md
git commit -m "docs(api): document keyset cursor pagination semantics"
```

---

## Self-Review Notes (for the implementer)

- **PRD coverage:** F1 stories 1–4 (disjoint/ordered/complete pages, `sortBy` honored, correct `nextCursor`/`hasNextPage`) are covered by Task 3. Story 16/17 (both seams; suite stays green) covered by Tasks 2–4 + Task 5 Step 2.
- **Out of scope (do not implement here):** the cursor-mode opt-in handshake/reachability, arbitrary `sort`-column keyset, and the other PRD findings F2–F5.
- **Naming consistency:** `encodeCursor`/`decodeCursor`/`CursorParts` are used identically in Tasks 1 and 3. The harness export is `createTestDb`. The venues table import is `venuesSchema`.
- **Known risk:** Task 2 migration replay under better-sqlite3 — fallback documented in Task 2 Step 5.
```
