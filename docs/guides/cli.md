# CLI Reference

Database management CLI for the Talash monorepo. Entry point: `tools/cli/index.ts`.

## Commands

Run all commands from the monorepo root:

```sh
bun run cli db seed                # seed with faker data (default 20 users)
bun run cli db seed --count 1000   # scale up for load testing
bun run cli db seed --seed 42      # reproducible dataset (same data every time)
bun run cli db fresh               # truncate all domain tables, then reseed
bun run cli db status              # print row counts per table
```

Root `package.json` aliases:

```sh
bun run db:seed:dev   # seed 100 users
bun run db:fresh      # truncate + reseed
bun run version:bump  # patch bump on all web sites (default group)
```

## Version (sites, workers, apps)

Bump semver versions across deployable packages. Sites read `package.json` in their footers (`src/lib/version.ts`). Expo apps also update `app.json` `expo.version` and increment `expo.android.versionCode`.

```sh
bun run cli version show                              # list current versions
bun run cli version bump                              # patch bump, sites only (default)
bun run version:bump                                  # same as above
bun run cli version bump --groups sites,workers       # patch bump sites + workers
bun run cli version bump --groups apps                # patch bump both Expo apps
bun run cli version bump --groups all                 # patch bump everything
bun run cli version bump --groups sites,apps --part minor
bun run cli version bump --only api,mobile-app        # specific targets
```

**Groups** (`--groups`, comma-separated, default `sites`):

| Group | Targets |
| --- | --- |
| `sites` | `marketing-site`, `business-dashboard` |
| `workers` | `api`, `queue`, `scheduled` |
| `apps` | `mobile-app`, `owner-app` |
| `all` | every group above |

**Targets** (`--only`, comma-separated — overrides `--groups`): `marketing-site`, `business-dashboard`, `api`, `queue`, `scheduled`, `mobile-app`, `owner-app`.

When multiple targets are selected, the bump uses the **highest** current version among them as the base, then applies `--part` (`patch` | `minor` | `major`, default `patch`) so mixed-version selections stay aligned.

Legacy `--site` still works for site-only bumps (`marketing-site`, `business-dashboard`, or `all`).

## Remote seeding (staging / production)

`migrate`, `seed`, and `fresh` all accept `--env local | staging | production` (default `local`).

```sh
# migrate
bun run cli db migrate                            # local
bun run cli db migrate --env staging              # staging (remote)
bun run cli db migrate --env production --force    # production (remote)

# seed (additive — best on an empty DB)
bun run cli db seed --env staging --count 20       # staging (remote)
bun run cli db seed --env production --force        # production (remote, typed confirm)

# fresh (truncate + reseed — re-runnable)
bun run cli db fresh --env staging --count 20      # staging (remote)
bun run cli db fresh --env production --force        # production (remote, typed confirm)
```

**How remote seeding works.** There is no Drizzle-over-HTTP path to remote D1, so `seed`/`fresh --env staging|production` run a local-build → export → push pipeline:

1. ensure the local schema is current (`d1 migrations apply --env local --local`);
2. truncate + reseed the **local** D1 (so it ends up holding the exact dataset you push — reproducible with `--seed`);
3. `wrangler d1 export … --no-schema` to data-only SQL;
4. reorder `INSERT` statements parent-first (wrangler ignores `--table` flag order);
5. for `fresh`, prepend `DELETE FROM` for all domain tables with `PRAGMA foreign_keys = OFF`;
6. `wrangler d1 execute --env <env> --remote --file …`.

The remote **schema** is created by `db migrate`, not by seeding — migrate the target first.

> ⚠️ **`staging` and `production` point at the same remote D1** (same `database_id` in `workers/api/wrangler.jsonc`). Seeding `--env staging` writes the production database.

**Guardrails.**

- `--env production` requires `--force` **and** a typed confirmation of the database name (`talash-db`). In a non-TTY (CI), pass `--confirm talash-db` instead of typing it.
- `fresh --env production` **deletes all existing rows** before reseeding.
- Keep `--count` modest for remote — `wrangler d1 execute --file` has size/statement limits; very large datasets are not yet chunked.

**Prerequisite.** Any `--remote` operation needs Cloudflare auth: `wrangler login` or a `CLOUDFLARE_API_TOKEN` env var.

## Layout

```
tools/cli/
├── index.ts            # entry point (yargs root)
├── commands/           # CLI command definitions (yargs handlers)
├── core/
│   ├── db.ts           # bun:sqlite client (never switch to better-sqlite3)
│   ├── exec.ts         # shell helpers
│   ├── logger.ts       # console output formatting
│   └── paths.ts        # resolve monorepo-relative paths
├── factories/          # builder utilities (createUser, etc.) using @faker-js/faker
└── seeders/
    ├── seeder.types.ts             # SeedOptions, SeedResult interfaces
    ├── users.seeder.ts             # seeds users table (12% managers, ~5% staff, rest customers)
    ├── businesses.seeder.ts        # businesses (~25% commerce vertical)
    ├── branches.seeder.ts          # branches per business
    ├── services.seeder.ts          # services for booking-vertical branches
    ├── products.seeder.ts          # products for commerce-vertical branches (stock 20–200)
    ├── bookings.seeder.ts          # bookings for booking-vertical branches
    ├── reviews.seeder.ts           # reviews for completed bookings
    ├── coupons.seeder.ts           # coupons per business
    ├── team.seeder.ts              # team members per business
    ├── rewards.seeder.ts           # reward points per user
    ├── customer-addresses.seeder.ts # 1–2 addresses per customer, exactly one isDefault
    └── orders.seeder.ts            # orders + order_items for commerce businesses; realistic status mix; in-memory stock ledger prevents CHECK violation
```

### Commerce seeders

`db seed` / `db fresh` populate the commerce vertical too:

- **products** — for branches of commerce-vertical businesses only (~25% of seeded businesses are commerce). Each product starts with generous stock (20–200).
- **orders + order_items** — a handful of orders per commerce business with a realistic status mix (mostly `Delivered`, plus `Pending`/`Confirmed`/`OutForDelivery`/`Cancelled`). `total` is computed from the items, `deliveredAt` is set only for `Delivered`. The orders seeder keeps an in-memory stock ledger, only creates a line if the product has stock, decrements it, and writes the decremented stock back — so the `products_stock_nonneg` CHECK is never violated.
- **customer_addresses** — 1–2 per customer, with exactly one `isDefault`.

## Adding a seeder for a new table

1. Create `tools/cli/seeders/<name>.seeder.ts` — export `async function seed<Name>(db, opts): Promise<SeedResult>`.
2. Use `@faker-js/faker` for data generation. Keep data realistic but never real.
3. Register the seeder in `tools/cli/seeders/index.ts` (call it after its dependencies).
4. If the table has foreign keys, ensure parent rows exist before inserting children.

## Rules

- Uses `bun:sqlite` directly — do **not** switch to `better-sqlite3`.
- Seeders must be deterministic when `opts.seed` is set (use `faker.seed(opts.seed)`).
- Each seeder should insert in chunks of ~500 rows to avoid SQLite max-variable limits.
