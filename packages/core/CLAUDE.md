# core — agent guide

Shared backend library imported by `@repo/api`, `@repo/queue`, and `@repo/scheduled`. Not a deployable worker — bundled by each consuming worker at build time.

## Documentation update policy

- Any feature implementation, refactor, behavior change, schema/repository contract change, or workflow change must include documentation updates in the same task/PR.
- Update existing docs first (this file, [../../docs/guides/api-query-repository-pattern.md](../../docs/guides/api-query-repository-pattern.md), and related worker/app guides when impacted).
- Any feature implementation or refactor must run lint, tests, and build before completion (`bun run lint`, `bun run test --filter @repo/core`, and `bun run build`, or equivalent scoped commands).
- Do not mark work complete until code and documentation are both updated and consistent.

## What lives here

```
src/
  database/
    client.ts               # getDB() — Drizzle over TALASH_DB binding
    helpers.ts              # primaryID(), timestamps() schema helpers
    schema/                 # Drizzle table definitions (one file per domain; full list in schema/index.ts)
      branches.schema.ts    # branchesSchema + branchHoursSchema (per-day working hours)
      bookings.schema.ts    # bookingsSchema — includes nullable staffId FK to team_members
      reviews.schema.ts     # reviewsSchema — partial unique index on booking_id
      businesses.schema.ts  # businessesSchema — vertical discriminator, contact fields, nullable brandPalette (BrandPalette: custom white-label palette, ADR-0003)
      # + auth, campaigns, coupons, demo-requests, favourites, notifications,
      # + rewards, services, staff-availability, team, users
    repositories/           # one file per domain; mirrors schema/ plus analytics and customers
      base.repository.ts          # shared CRUD: create/findAll/findOne/updateOne/deleteOne/restoreOne
      branch-hours.repository.ts  # findByBranch, upsertDay, findForSlot
      <name>.repository.ts        # domain DB queries, one file per domain, delegates to BaseRepository
  modules/
    rewards/
      rewards.service.ts    # pure domain logic (no HTTP), used by queue worker
  http/
    response.ts             # BaseQueryDto, PaginatedQueryDto, ApiResponse types + Zod schemas
  queue/
    jobs.ts                 # JobPayload union — all members extend BaseJob { requestId?: string }
    producer.ts             # QueueProducer class
  env.d.ts                  # ambient Cloudflare.Env { TALASH_DB, TALASH_EMAIL } for type-checking
```

## Rules

- No Hono, no HTTP middleware, no `Response` construction here.
- `getDB()` is called by each consuming worker to obtain a `DbClient` — pass it into repository constructors rather than calling `getDB()` inside library code.
- **`BaseRepository` static methods all take `db: DbClient` as first arg.** Never call `getDB()` inside a static method — that reintroduces the ambient dependency.
- Add new schemas to `database/schema/`, re-export from `database/schema/index.ts`.
- Repositories belong here; services belong in `@repo/api` unless they contain pure domain logic needed by non-HTTP workers.
- `BaseRepository` includes `restoreOne(db, id, query?)` — clears `deletedAt` to recover soft-deleted rows.
- `BranchHoursRepository` is accessed via `BranchesRepository.findHours`, `upsertHour`, `findHoursForSlot` — do not instantiate it directly.

## Adding a new domain

1. `database/schema/<name>.schema.ts` + re-export from `schema/index.ts`
2. `database/repositories/<name>.repository.ts` — accept `db: DbClient` in constructor, pass to `BaseRepository.*`
3. From `workers/api`, run `bun run db:generate` in an **interactive terminal** — produces `NNNN_*.sql` **and** `meta/NNNN_snapshot.json`. Do not hand-write SQL without the snapshot. See [../../.cursor/rules/drizzle-migrations.mdc](../../.cursor/rules/drizzle-migrations.mdc).
