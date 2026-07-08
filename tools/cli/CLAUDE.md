# CLI — agent guide

Database management CLI for the Talash monorepo.

**Guide:** [docs/guides/cli.md](../../docs/guides/cli.md)

## Documentation update policy

- Any feature implementation, refactor, behavior change, command/flag change, or workflow change must include documentation updates in the same task/PR.
- Update existing docs first (this file, [../../docs/guides/cli.md](../../docs/guides/cli.md), and [../../AGENTS.md](../../AGENTS.md) when scope broadens).
- Any feature implementation or refactor must run lint, tests, and build before completion (`bun run lint`, `bun run test --filter @repo/cli`, and `bun run build`, or equivalent scoped commands).
- Do not mark work complete until code and documentation are both updated and consistent.

## Commands

```sh
bun run cli db seed               # seed faker data (default 20 users)
bun run cli db seed --count 1000  # scale up
bun run cli db seed --seed 42     # reproducible dataset
bun run cli db fresh              # truncate all domain tables then reseed
bun run cli db status             # row counts per table
bun run cli version show          # list versions for sites, workers, apps
bun run cli version bump          # bump patch on sites (default group)
bun run cli version bump --groups sites,workers,apps
bun run version:bump              # root alias for site patch bump
```

### Remote (staging / production)

`migrate`, `seed`, and `fresh` accept `--env local | staging | production` (default `local`).

```sh
bun run cli db migrate --env staging             # remote migrate
bun run cli db fresh   --env staging --count 20  # remote truncate + reseed
bun run cli db seed    --env production --force    # remote additive (typed confirm)
```

Remote `seed`/`fresh` seed a local D1, `wrangler d1 export` it to SQL, then `wrangler d1 execute --remote --file` it — `core/remote-seed.ts`. Production requires `--force` + a typed DB-name confirmation (`--confirm talash-db` in CI). Note **staging and production share one remote D1**. Remote ops need Cloudflare auth. Full reference: [docs/guides/cli.md](../../docs/guides/cli.md#remote-seeding-staging--production).

## Layout

```
commands/   # CLI command definitions (yargs)
core/       # shared helpers
factories/  # builder utilities
seeders/    # per-table seeder modules
index.ts    # entry point
```

## Rules

- Entry: `bun run cli <command>` from the repo root.
- Seeders use `@faker-js/faker` — keep data realistic but never real.
- Each seeder exports a `seed(db, count)` function; register in `seeders/index.ts`.
- Uses bun:sqlite directly (not better-sqlite3) — do not switch drivers.

## Docs

- [docs/guides/cli.md](../../docs/guides/cli.md)
- [../../AGENTS.md](../../AGENTS.md)
