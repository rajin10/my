# Remote DB seeding for the Talash CLI

**Date:** 2026-06-11
**Status:** Approved (pending spec review)
**Scope:** `tools/cli` — add the ability to seed remote D1 (staging + production), and make `migrate`/`seed`/`fresh` env-aware and consistent.

## Problem

`bun run cli db migrate` works against remote D1 (it shells out to `wrangler d1 migrations apply --remote`). But `seed` and `fresh` are **local-only**: every seeder writes through `createLocalDb()` → `bun:sqlite` opening a local file, and there is no Drizzle-over-HTTP path to remote D1 outside a Worker. `db seed --env production` currently just prints "planned for Phase 2" and exits; `db fresh` has no `--env` flag at all.

We need to populate **staging** (and, when asked, **production**) with realistic faker data.

## Decisions

- **Targets:** `local` (unchanged), `staging`, `production`. Production is allowed but gated.
- **Mechanism:** seed locally, export the data as SQL, push it to remote with `wrangler d1 execute --remote`. Reuses all 13 existing seeders; no per-seeder rewrite.
- **Remote semantics:** `fresh --env <remote>` = truncate domain tables then load a clean dataset (re-runnable). `seed --env <remote>` = additive insert (documented as best for an empty DB; re-running risks UNIQUE collisions on email/phone-per-role).
- **Schema is out of scope for seeding:** remote schema is created by `db migrate`. The seed pipeline pushes **data only** (`--no-schema`) and assumes the remote is already migrated.

## Why this mechanism (and what was rejected)

- **Chosen — local-seed → SQL → wrangler push:** one new orchestration path, reuses every seeder, and uses `wrangler d1 export` to produce correctly-escaped SQL (no hand-rolled serializer).
- **Rejected — refactor seeders to a remote D1 client:** there is no Drizzle support over the D1 REST API; every seeder would become hand-written SQL. Large, risky.
- **Rejected — drive the live API:** only covers data that endpoints expose (misses rewards, notifications, payments shaping), needs auth tokens, slow.

`wrangler d1 export` was verified to **not** support `--persist-to` (only `--local` against the default `.wrangler/state/v3/d1` location). So the pipeline reseeds the **default local D1** and exports from it, rather than an isolated temp DB. Consequence (intended, documented): after a remote seed, the local dev D1 holds the **same dataset** that was pushed — reproducible with `--seed`.

## Pipeline (`tools/cli/core/remote-seed.ts`, new)

`runRemoteSeed({ env, count, fakerSeed, fresh })`:

1. `wrangler d1 migrations apply TALASH_DB --env local --local` — ensure the local schema is current before seeding.
2. Open the local D1 via `createLocalDb()`. **Always** truncate the domain tables in the FK-safe `TRUNCATE_ORDER` first, then run `seedAll(db, opts)` — so the export contains *exactly* the freshly-generated dataset and never carries stale local rows into the remote push. (The `fresh` flag does **not** affect this local truncate; it only controls the *remote* `DELETE` prefix in step 5.)
3. `db.$client.exec("PRAGMA wal_checkpoint(TRUNCATE)")` and close — bun:sqlite leaves rows in `-wal`; without this, `wrangler d1 export` can read a stale file (known prior issue).
4. `wrangler d1 export TALASH_DB --env local --local --no-schema --table <each domain table> --output <tmpSql>` — data-only `INSERT`s, correctly escaped. **The `--table` allowlist (= `TRUNCATE_ORDER`) is required:** an unrestricted `--no-schema` export also dumps the `migrations` and `sqlite_sequence` bookkeeping tables, whose rows already exist on the migrated remote and would abort the push on a PK conflict. The export prepends `PRAGMA defer_foreign_keys=TRUE;`, so its (non-parent-first) insert order is FK-safe on import. A pure `stripBookkeepingInserts()` helper re-filters the dump as a belt-and-suspenders net (unit-tested).
5. Assemble the push file:
   - **Remote `fresh`:** prepend a `DELETE FROM "<table>"` block in `TRUNCATE_ORDER`, wrapped so it runs before the inserts. (No `PRAGMA foreign_keys=OFF` — D1/remote ignores it; the order is FK-safe by construction, same order `fresh.ts` already uses.)
   - **Remote `seed`:** push the export as-is.
6. `wrangler d1 execute TALASH_DB --env <staging|production> --remote --file <pushFile> --yes`.
7. `finally`: delete `<tmpSql>` / `<pushFile>`.

Temp files live under the OS temp dir (e.g. `os.tmpdir()/talash-remote-seed-<pid>.sql`); never committed, always cleaned up.

## Code changes

| File | Change |
| --- | --- |
| `tools/cli/seeders/run-all.ts` (new) | Extract the 13-step seeding sequence from `seed.ts` into `export async function seedAll(db, opts)` — a pure "given a db client + opts, populate it" function. Also export the canonical `TRUNCATE_ORDER` and `truncateAll(db)` (the FK-safe `DELETE` loop currently inlined in `fresh.ts`). Local `seed`, local `fresh`, and the remote pipeline all call these. |
| `tools/cli/core/remote-seed.ts` (new) | The pipeline above. Also exports `buildTruncateSql(order)` (pure — the remote `DELETE` block string) so it can be unit-tested. |
| `tools/cli/core/exec.ts` | `validateEnv` accepts `staging` (returns `"local" | "staging" | "production"`). Add `confirmProduction(dbName)` helper (interactive typed confirmation; non-TTY requires `--confirm <dbName>`). |
| `tools/cli/commands/db/seed.ts` | Replace inline sequence with `seedAll`. `--env staging|production` → delegate to `runRemoteSeed({ fresh: false })`. `local` unchanged. |
| `tools/cli/commands/db/fresh.ts` | Add `--env` (default `local`). Remote → `runRemoteSeed({ fresh: true })`. Local → `truncateAll` + `seedAll` (now sourced from `run-all.ts` instead of inline). |
| `tools/cli/commands/db/migrate.ts` | Extend env handling to `staging` (`--env staging --remote`). (Local/production already wired.) |

## Guardrails

- **staging:** `--env staging` is sufficient. Print a one-line "about to push N-user dataset to staging (remote)" notice before executing.
- **production:** requires **`--force`** AND an **interactive typed confirmation** of the literal DB name (`talash-db`). A loud warning states that `fresh` **deletes all production data**. In a non-TTY (CI), the prompt is unavailable, so `--confirm talash-db` must be passed explicitly or the command refuses.
- **Default `--count` for remote = 20** (small). Doc notes `wrangler d1 execute --file` has size/statement limits — keep remote datasets modest; large counts may need chunking (out of scope now).
- **Cloudflare auth** is a prerequisite for any `--remote` op (`wrangler login` or `CLOUDFLARE_API_TOKEN`); documented, not enforced in code (wrangler surfaces the auth error).

## Command surface (after this change)

```sh
# migrate
bun run cli db migrate                          # local
bun run cli db migrate --env staging            # staging remote
bun run cli db migrate --env production --force  # production remote

# seed (additive)
bun run cli db seed                             # local
bun run cli db seed --env staging               # staging remote, additive
bun run cli db seed --env production --force     # production remote, additive (typed confirm)

# fresh (truncate + reseed)
bun run cli db fresh                            # local
bun run cli db fresh --env staging              # staging remote: truncate + reseed
bun run cli db fresh --env production --force    # production remote: truncate + reseed (typed confirm)
```

## Testing

Unit tests (Bun) for the pure pieces only — the wrangler shell-outs are thin spawns and are not unit-tested:

- `validateEnv` accepts `local`/`staging`/`production`, rejects others.
- `buildTruncateSql(TRUNCATE_ORDER)` emits one `DELETE FROM "<t>"` per table in order, correctly quoted.
- `confirmProduction` refuses on a wrong/empty answer and on non-TTY without `--confirm`.

Manual verification: `db fresh --env staging` against a real staging D1 → row counts land (`db status` can be pointed at remote only if a remote status path exists; otherwise verify via an API call or `wrangler d1 execute --remote --command "SELECT count(*) ..."`).

## Docs to update (same PR)

- `tools/cli/CLAUDE.md` — command table + remote section.
- `docs/guides/cli.md` — full reference, the pipeline, guardrails, auth prerequisite, D1 size caveat.
- `AGENTS.md` — CLI command list.
- `docs/guides/environment-variables.md` — Cloudflare-auth prerequisite for remote DB ops.

## Out of scope

- Chunking very large datasets to fit `d1 execute` limits.
- A remote `db status` (row counts against remote D1).
- Per-seeder remote streaming / a Drizzle-over-REST client.
