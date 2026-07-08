---
name: add-module
description: Add a new Hono API module end-to-end following the Talash query/repository pattern
---

# Add a new API module

Follow every step in order. Each step names the exact file to create or edit.

---

## Step 1 — Drizzle schema (`packages/core/src/database/schema/<name>.schema.ts`)

```ts
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { primaryID, timestamps } from "../helpers";

export const <name>Schema = sqliteTable("<table_name>", {
  ...primaryID(),           // id: text ULID primary key
  // your columns here
  ...timestamps(),          // createdAt, updatedAt, deletedAt
});

export type <Name>Select = typeof <name>Schema.$inferSelect;
export type <Name>Insert = Omit<
  typeof <name>Schema.$inferInsert,
  "id" | "createdAt" | "updatedAt" | "deletedAt"
>;
```

Then re-export from `packages/core/src/database/schema/index.ts`:
```ts
export type { <Name>Insert, <Name>Select } from "./<name>.schema";
export { <name>Schema } from "./<name>.schema";
```

After editing the schema, generate + apply the migration:
```sh
bun run db:generate   # generates migration SQL
bun run db:migrate    # applies to local D1
```

---

## Step 2 — Repository (`packages/core/src/database/repositories/<name>.repository.ts`)

Use `BaseRepository` static methods for standard CRUD. Add custom queries below them.

```ts
import type { DbClient } from "../client";
import { BaseRepository } from "./base.repository";
import type { <Name>Insert, <Name>Select } from "../schema";
import { <name>Schema } from "../schema";
import type { PaginatedQueryDto } from "../../http/response";

export class <Name>Repository {
  constructor(private readonly db: DbClient) {}

  async findAll(query: PaginatedQueryDto) {
    return BaseRepository.findAll(this.db, <name>Schema, query);
  }

  async findOne(id: string): Promise<<Name>Select | null> {
    return BaseRepository.findOne(this.db, <name>Schema, { id });
  }

  async create(data: <Name>Insert): Promise<<Name>Select> {
    return BaseRepository.create(this.db, <name>Schema, data);
  }

  async updateOne(id: string, data: Partial<<Name>Insert>): Promise<<Name>Select | null> {
    return BaseRepository.updateOne(this.db, <name>Schema, { id }, data);
  }

  async deleteOne(id: string): Promise<<Name>Select | null> {
    return BaseRepository.deleteOne(this.db, <name>Schema, { id });
  }
}
```

---

## Step 3 — Service (`workers/api/src/modules/<name>/<name>.service.ts`)

HTTP-layer business logic. Ownership checks live here, not in middleware.

```ts
import { NotFoundError } from "../../core/errors";
import type { <Name>Repository } from "@repo/core/src/database/repositories/<name>.repository";

export class <Name>Service {
  constructor(private readonly repo: <Name>Repository) {}

  async list(query: unknown) {
    return this.repo.findAll(query as any);
  }

  async get(id: string) {
    const item = await this.repo.findOne(id);
    if (!item) throw new NotFoundError("<Name> not found");
    return item;
  }

  // Add create / update / delete with ownership checks as needed:
  // async create(ownerId: string, data: ...) { ... }
  // async update(id: string, ownerId: string, data: ...) {
  //   const item = await this.repo.findOne(id);
  //   if (!item || item.ownerId !== ownerId) throw new NotFoundError(...);
  //   return this.repo.updateOne(id, data);
  // }
}
```

---

## Step 4 — Routes (`workers/api/src/modules/<name>/index.ts`)

Use `@hono/zod-openapi`. Apply auth middleware at the app level or per-route.

```ts
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
// or: import { requireVenueStaff } from "../../middleware/team-scope";
import type { AppEnv } from "../../types";

// --- Schemas ---
const <Name>Schema = z.object({
  id: z.string(),
  // ...fields
  createdAt: z.string(),
});

// --- Routes ---
const listRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["<Name>"],
  summary: "List <name>",
  // Add security: [{ bearerAuth: [] }] if authenticated
  responses: {
    200: {
      content: { "application/json": { schema: z.array(<Name>Schema) } },
      description: "OK",
    },
  },
});

// --- App ---
export const <name>App = new OpenAPIHono<AppEnv>();

// Apply auth to all routes (or selectively per route):
// <name>App.use("*", authenticate);                         // any logged-in user
// <name>App.use("*", requireRole("owner"));                 // owner only
// <name>App.use("*", requireVenueStaff("owner","manager")); // owner/manager with branch scope

<name>App.openapi(listRoute, async (c) => {
  const query = c.get("parsedQuery");
  const items = await c.var.<name>Service.list(query);
  return c.json(items, 200);
});
```

---

## Step 5 — Register the service type (`workers/api/src/types/index.ts`)

Add the import and the `Variables` entry:

```ts
import type { <Name>Service } from "../modules/<name>/<name>.service";

// Inside Variables:
<name>Service: <Name>Service;
```

---

## Step 6 — Inject the service (`workers/api/src/middleware/services.ts`)

```ts
import { <Name>Repository } from "@repo/core/src/database/repositories/<name>.repository";
import { <Name>Service } from "../modules/<name>/<name>.service";

// Inside injectServices, after the db/queue/storage lines:
c.set("<name>Service", new <Name>Service(new <Name>Repository(db)));
```

If the service needs cross-domain repositories (ownership checks across businesses/branches), pass the shared `businessesRepo` / `branchesRepo` instances that are already constructed above in that middleware.

---

## Step 7 — Register the route (`workers/api/src/modules/routes.ts`)

```ts
import { <name>App } from "./<name>";

apiRoutes.route("/v1/<name>", <name>App);
```

---

## Step 8 — Update the API endpoint index (`docs/guides/api-endpoints.md`)

Add a new section following the existing table format:

```markdown
## <Name> (`/api/v1/<name>`)

| Method | Path | Auth | Client method |
| --- | --- | --- | --- |
| GET | `/` | Public | `<name>.list` |
| GET | `/:id` | Public | `<name>.get` |
| POST | `/` | Owner | `<name>.create` |
```

---

## Step 9 — Write a route test

Create `workers/api/src/__tests__/modules/<name>.test.ts`. Reference existing tests in `workers/api/src/__tests__/modules/` for the test harness pattern (`createApp`, mock services via `vi.mock`).

At minimum cover:
- 200 response for list and get
- 404 for get with unknown id
- Auth rejection (401) for protected endpoints

---

## Step 10 — Verify

```sh
bun run lint          # Biome check
bun run check-types   # TypeScript
bun run test          # Vitest
bun run build         # Wrangler bundle check
```

Fix any errors before marking done.
