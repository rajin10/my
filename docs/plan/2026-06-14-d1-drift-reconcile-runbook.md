# Remote D1 drift reconciliation runbook (issue #113)

Reconcile the shared remote D1 (`talash-db`, `database_id 85eeeb53-0cff-4586-ae93-02ea7b81ca31`)
whose schema is behind the migration set and whose tracker is desynced.

- **Issue:** [#113](https://github.com/hasib-devs/Talash/issues/113)
- **Status:** ✅ **EXECUTED via Path A on 2026-06-14.** Step 0 confirmed the clean `0000 + 0003 − 0001 − 0002` state; backed up → dropped all tables incl. tracker → `migrations apply` replayed `0000`→`0003` on the empty DB → `cli db fresh --env staging --count 20 --seed 42`. Verified: tracker `0000`–`0003`, `auth_credentials` present, `bookings`/`orders`/`branches` 0002 columns present, `notifications.dedupe_key` present, 20 users / 3 businesses / 35 bookings / 5 orders. Backup retained at `.remember/tmp/talash-db-backup-2026-06-14.sql`. (The "plan only" steps below are kept as the executed record + reusable runbook for any future drift.)
- **Authoring date:** 2026-06-14

---

## ⚠️ Read this first — the shared-DB footgun

`staging` and `production` point at the **same** `database_id` (`85eeeb53…`) — see
[wrangler.jsonc](../../workers/api/wrangler.jsonc) env blocks `staging` and `production`.

Consequence: **`bun run cli db fresh --env staging` wipes the production DB** — and it does so
**without the production typed-confirm gate** (`runRemoteSeed` only gates `--env production`; see
[remote-seed.ts:104](../../tools/cli/core/remote-seed.ts:104)). The word "staging" reads as safe; it
is not. Treat every destructive step here as production-affecting.

**Gate before any destructive step:** confirm with the team that the seeded demo data on this DB
(≈101 users / 180 bookings / 11 orders / 0 notifications) is disposable and that no environment or
person depends on it. This data is faker-seeded, not real customer data, but it is shared.

Note: `--force` is **not** required for `--env staging` (only `--env production` is gated). The
handoff/issue write `--force` reflexively; on staging it is a no-op.

---

## What's actually wrong (and two corrections to issue #113)

The tracker `migrations` table records only `0000_initial_migration.sql` as applied, while:

| Migration | Brings | Remote state (per #113 read-only check) |
| --- | --- | --- |
| `0000_initial_migration` | base schema **including** `orders`, `order_items`, `payments`, `notifications.order_id`/`go` | ✅ present, tracked |
| `0001_nice_phalanx` | `auth_credentials` table (+2 indexes) | ❌ missing |
| `0002_busy_longshot` | `bookings`/`orders` guest+walk-in cols (table rebuild), `branches.walk_in_qr_version` | ❌ missing |
| `0003_ambiguous_beyonder` | `notifications.dedupe_key` + unique index | ⚠️ **hand-applied out-of-band, NOT recorded in tracker** |

**Correction 1 — `wrangler d1 migrations apply` is the *right* tool, not the wrong one.**
Issue #113 says "there is no `d1_migrations` table, so `wrangler d1 migrations apply` is the wrong
tool." But wrangler is configured with `migrations_table: "migrations"` in **every** env block
([wrangler.jsonc:52](../../workers/api/wrangler.jsonc:52), `:98`, `:150`, `:202`). So wrangler reads
and writes the `migrations` table — it is the correct tracker. The real blocker is **Correction 2.**

**Correction 2 — a blind `migrations apply` fails on the already-applied 0003.**
Because 0003 was applied by hand but never recorded, a blind apply replays it:
`ALTER TABLE notifications ADD dedupe_key` → **"duplicate column name"** → aborts (after possibly
half-applying 0001/0002). This — not "wrong tool" — is why you cannot just run apply on the current
DB.

**Correction 3 — `db fresh` cannot fix schema drift; it is data-only.**
Issue #113's "option 1 = `db fresh`" does **not** work against a behind-schema remote.
[remote-seed.ts:165](../../tools/cli/core/remote-seed.ts:165) exports with `--no-schema`, prepends a
`DELETE FROM` truncate block, and pushes data. It never pushes schema. The exported insert
`INSERT INTO "bookings" (…, guest_name, guest_phone, walk_in_local_id, source, …) VALUES …` (local
`bookings` has those 0002 columns) will hit a remote `bookings` that lacks them →
**"table bookings has no column named guest_name"** → push aborts. Same risk for `orders` and
`branches.walk_in_qr_version`. So `db fresh` is the right **data** step *after* schema is correct —
never the schema step.

---

## Step 0 — verify the live state (READ-ONLY — run this first when authorized)

Issue #113 frames the remote as a non-linear "Frankenstein matching no snapshot." That premise is
**probably wrong**: `payments`, `order_items`, and `notifications.order_id`/`go` all ship in the
squashed `0000` (per [workers/api/CLAUDE.md](../../workers/api/CLAUDE.md) — Payments/Orders sections),
and `orders` predates 0002 (0002 *rebuilds* it). So commerce is not "later work"; it is all in 0000.
The most likely true state is **clean: 0000 (tracked) + 0003 (hand-applied) − 0001 − 0002.**
Confirm before choosing a path:

```sh
# tables present on remote (expect: NO auth_credentials)
bunx wrangler d1 execute TALASH_DB --env staging --remote \
  --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"

# tracker rows (expect: only 0000_initial_migration.sql) and its exact schema
bunx wrangler d1 execute TALASH_DB --env staging --remote \
  --command "SELECT * FROM migrations ORDER BY id;"
bunx wrangler d1 execute TALASH_DB --env staging --remote \
  --command "SELECT sql FROM sqlite_master WHERE type='table' AND name='migrations';"

# does bookings already have the 0002 columns? (expect: NO guest_name/guest_phone/walk_in_local_id/source)
bunx wrangler d1 execute TALASH_DB --env staging --remote \
  --command "PRAGMA table_info(bookings);"

# was 0003 really applied? (expect: a dedupe_key column on notifications)
bunx wrangler d1 execute TALASH_DB --env staging --remote \
  --command "PRAGMA table_info(notifications);"

# row counts to confirm data is the disposable demo set
bunx wrangler d1 execute TALASH_DB --env staging --remote \
  --command "SELECT (SELECT count(*) FROM users) users, (SELECT count(*) FROM bookings) bookings, (SELECT count(*) FROM orders) orders;"
```

Branch on the result: if the state matches the hypothesis (only 0001+0002 missing, 0003 present),
**Path A** is clean. If anything unexpected appears (e.g. orders already has guest cols, or
auth_credentials exists), re-read before proceeding.

---

## Path A — full rebuild (RECOMMENDED, data is disposable)

Make remote schema byte-identical to local's fully-migrated schema by replaying all migrations on an
**empty** DB, then load fresh data. The key safety property: **0002's destructive
`DROP TABLE bookings` / `DROP TABLE orders` rebuild runs against an empty DB**, so there are no rows
to preserve and no deferred-FK hazard (remote D1 does not reliably honor deferred FK checks — see the
"remote D1 `execute --file` does not reliably honour deferred FK checks" note in
[AGENTS.md](../../AGENTS.md)).

### A1. Back up first (READ-ONLY, cheap insurance)
```sh
bunx wrangler d1 export TALASH_DB --env staging --remote \
  --output ./.remember/tmp/talash-db-backup-2026-06-14.sql
```

### A2. Drop every table, **including the `migrations` tracker** (DESTRUCTIVE)
Dropping `migrations` makes wrangler believe nothing is applied, so A3 replays 0000→0003 cleanly.
Generate the drop list from Step 0's `sqlite_master` output (exclude internal `sqlite_*` / `_cf_*` /
`d1_*` — wrangler manages those). Build a file `drop-all.sql`:
```sql
PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS "reward_transactions";
DROP TABLE IF EXISTS "reward_points";
DROP TABLE IF EXISTS "reviews";
DROP TABLE IF EXISTS "payments";
DROP TABLE IF EXISTS "order_items";
DROP TABLE IF EXISTS "orders";
DROP TABLE IF EXISTS "customer_addresses";
DROP TABLE IF EXISTS "bookings";
DROP TABLE IF EXISTS "coupons";
DROP TABLE IF EXISTS "staff_availability";
DROP TABLE IF EXISTS "team_members";
DROP TABLE IF EXISTS "products";
DROP TABLE IF EXISTS "services";
DROP TABLE IF EXISTS "branch_hours";
DROP TABLE IF EXISTS "business_photos";
DROP TABLE IF EXISTS "favourites";
DROP TABLE IF EXISTS "campaigns";
DROP TABLE IF EXISTS "branches";
DROP TABLE IF EXISTS "businesses";
DROP TABLE IF EXISTS "notifications";
DROP TABLE IF EXISTS "auth_refresh_tokens";
DROP TABLE IF EXISTS "auth_credentials";   -- harmless IF NOT EXISTS / IF EXISTS
DROP TABLE IF EXISTS "demo_requests";
DROP TABLE IF EXISTS "users";
DROP TABLE IF EXISTS "migrations";          -- reset wrangler's tracker
PRAGMA foreign_keys = ON;
```
(The domain list mirrors `TRUNCATE_ORDER` in [tables.ts](../../tools/cli/seeders/tables.ts);
reconcile against Step 0's actual `sqlite_master` list so nothing is missed.)
```sh
bunx wrangler d1 execute TALASH_DB --env staging --remote --file ./drop-all.sql --yes
```

### A3. Replay all migrations on the now-empty DB (creates correct schema **and** tracker)
```sh
bunx wrangler d1 migrations apply TALASH_DB --env staging --remote
```
This applies 0000→0003 in order and records all four rows in `migrations`. (Equivalent CLI wrapper:
`bun run cli db migrate --env staging`, which calls the same command —
[migrate.ts:37](../../tools/cli/commands/db/migrate.ts:37).)

### A4. Verify schema + tracker (READ-ONLY)
```sh
bunx wrangler d1 execute TALASH_DB --env staging --remote --command "SELECT name FROM migrations ORDER BY id;"   # expect 0000..0003
bunx wrangler d1 execute TALASH_DB --env staging --remote --command "PRAGMA table_info(bookings);"               # expect guest_name etc.
bunx wrangler d1 execute TALASH_DB --env staging --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name='auth_credentials';"
```

### A5. Load fresh demo data (data step — now schema matches, so the insert push succeeds)
```sh
bun run cli db fresh --env staging --count 20 --seed 42
```
`--seed 42` makes the dataset reproducible (and re-creates the purple-palette demo business used for
the #97 smoke). No `--force` needed for staging.

**Outcome:** schema == local, tracker == 0000–0003, fresh reproducible data. Fully consistent.

---

## Path B — surgical forward-fix (preserves the existing rows; fiddlier)

Use only if the demo data must be preserved. Apply the missing migrations by hand, then backfill the
tracker. **Do not** run `wrangler d1 migrations apply` (it would replay 0003 → duplicate-column error).

### B1. Back up (as A1).

### B2. Apply 0001 (`auth_credentials`) — safe, additive
Run the contents of
[0001_nice_phalanx.sql](../../workers/api/src/database/migrations/0001_nice_phalanx.sql) via
`--file`. It only `CREATE TABLE auth_credentials` + 2 indexes; no data touched.

### B3. Apply 0002 (guest/walk-in columns) — **this is the hard part**
0002 is a full table rebuild (`DROP TABLE bookings` / `__new_bookings` + `SELECT` copy; same for
`orders`) because it adds a `bookings_customer_required` **CHECK constraint**, and **SQLite cannot add
a CHECK constraint via `ALTER TABLE ADD COLUMN`.** Two sub-options:

- **B3a (faithful):** run [0002_busy_longshot.sql](../../workers/api/src/database/migrations/0002_busy_longshot.sql)
  as-is via `--file`. Its `INSERT INTO __new_bookings … SELECT … FROM bookings` preserves the 180
  rows (and 11 orders). **Risk:** remote D1 does not reliably honor the `PRAGMA foreign_keys=OFF`
  inside a batched file, and the rebuild touches FK-referenced tables — verify FK integrity after, or
  prefer Path A. This is exactly the data-preservation/FK hazard Path A avoids by rebuilding empty.
- **B3b (lossy-but-simple):** `ALTER TABLE bookings ADD COLUMN guest_name text;` (+ `guest_phone`,
  `walk_in_local_id`, `source text DEFAULT 'app' NOT NULL`), same for `orders`,
  `ALTER TABLE branches ADD walk_in_qr_version integer DEFAULT 0 NOT NULL;`, then
  `CREATE UNIQUE INDEX bookings_walk_in_local_id_unique …` etc. **Accepts a schema that diverges from
  a clean migrate** — the `bookings_customer_required` / `orders_customer_required` / 
  `orders_delivery_line_required` CHECK constraints are omitted. Acceptable only for a staging DB you
  do not intend to migrate-diff against later.

### B4. Skip 0003 (already applied) — confirmed in Step 0.

### B5. Backfill the tracker
So future `db migrate` is consistent. Use the exact column shape from Step 0's
`SELECT sql FROM sqlite_master … name='migrations'`; for the standard wrangler shape
(`id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, applied_at … DEFAULT CURRENT_TIMESTAMP`):
```sql
INSERT INTO migrations (name) VALUES
  ('0001_nice_phalanx.sql'),
  ('0002_busy_longshot.sql'),
  ('0003_ambiguous_beyonder.sql');
```
(The `.sql` suffix matches the stored `0000_initial_migration.sql` row.)

### B6. Verify (as A4).

**Trade-off:** Path B preserves data but is multi-step, FK-risky (B3a) or schema-divergent (B3b), and
leaves the schema potentially not byte-identical to a clean migrate. Given the data is disposable,
**Path A is recommended.**

---

## After reconciliation

- Re-run the Step-0 read-only checks to confirm end state.
- Note in [issue #113](https://github.com/hasib-devs/Talash/issues/113) which path was taken and close it.
- Update the handoff / `.remember` so the "remote D1 schema drift" warning is cleared.
- Going forward: apply remote migrations via `bun run cli db migrate --env staging` (never hand-apply
  a single migration out-of-band again — that untracked 0003 is what created this mess).

## Why this won't recur if migrations go through the CLI

The drift originated from (a) a `db fresh`-style import that loaded an older/filtered schema without
syncing the tracker, and (b) a hand-applied 0003. As long as every remote schema change goes through
`db migrate --env …` (which uses the configured `migrations` tracker), wrangler keeps the tracker and
schema in lockstep.
