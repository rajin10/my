# Contributing

How to make changes in the Talash monorepo — workflow, verification, and documentation expectations.

**First-time setup:** [getting-started.md](../getting-started.md)

**Session context:** [CONTEXT-MAP.md](../../CONTEXT-MAP.md) — one `CONTEXT.md` per package; update the package file for your current task, not the map.

---

## Workflow

1. Branch from `develop` or `main` (team convention: feature branches → PR into `main`).
2. Make focused changes — one feature or fix per PR when possible.
3. Update docs in the **same PR** as code (see checklist below).
4. Run verification locally before opening the PR.
5. Open a PR targeting `main`. CI runs type-check, test, and build on every PR.

Deploy to production happens automatically on push to `main` after CI passes (path-scoped via Turbo). See [ci-cd.md](ci-cd.md).

---

## Pre-PR checklist

### Code

- [ ] Change is scoped — no unrelated refactors or drive-by edits
- [ ] Matches existing patterns in the package you're touching (read surrounding code first)
- [ ] British spelling in user-facing copy; sentence case; no emoji in product UI

### Verification

Run from the monorepo root:

```sh
bun run lint          # Biome — required locally; not run in CI until lint step is re-enabled
bun run check-types   # TypeScript via Turbo
bun run test          # Vitest via Turbo
bun run build         # Full monorepo build
```

Scoped alternatives when iterating on one package:

```sh
bun run api:dev                              # API worker
bun run --filter @repo/api test              # API tests only
bun run --filter @repo/mobile-app test       # Mobile tests
cd sites/business-dashboard && bun run test  # Dashboard tests
```

### Documentation

- [ ] Behaviour, API, schema, or workflow changed → docs updated
- [ ] New env var → [environment-variables.md](environment-variables.md) + relevant `.env.example` / `.dev.vars.example`
- [ ] New API route → [api-endpoints.md](api-endpoints.md) + route tests
- [ ] New frontend integration → [feature-map.md](../feature-map.md) + app `AGENTS.md` if conventions change
- [ ] New guide or major doc → linked from [docs/README.md](../README.md)

**Do not mark work complete until code and docs are consistent.**

---

## What to update (by change type)

| Change                | Update first                                                                                                                                                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New API module        | `workers/api` module, `@repo/api-client` endpoint, [api-query-repository-pattern.md](api-query-repository-pattern.md), [api-endpoints.md](api-endpoints.md), route tests                                                                              |
| API behaviour fix     | Relevant worker `CLAUDE.md`, [api-endpoints.md](api-endpoints.md) if contract changed                                                                                                                                                                 |
| DB schema / migration | `packages/core` schema → `bun run db:generate` from `workers/api` (interactive; SQL **and** `meta/*_snapshot.json`). [.cursor/rules/drizzle-migrations.mdc](../../.cursor/rules/drizzle-migrations.mdc). Seeder: [cli.md](cli.md) if seed data needed |
| Web UI feature        | Page/screen + hook per [ui-backend-sync.md](ui-backend-sync.md), site `AGENTS.md`, [feature-map.md](../feature-map.md)                                                                                                                                |
| Mobile UI feature     | Hook/context + `adapters.ts`, app `AGENTS.md`, [feature-map.md](../feature-map.md)                                                                                                                                                                    |
| Queue / cron job      | `packages/core/src/queue/jobs.ts`, queue/scheduled `CLAUDE.md`                                                                                                                                                                                        |
| CI / deploy           | [ci-cd.md](ci-cd.md)                                                                                                                                                                                                                                  |
| Auth / OAuth          | [google-auth.md](google-auth.md), [environment-variables.md](environment-variables.md)                                                                                                                                                                |

---

## Layering rules (frontend)

When adding or changing a feature that talks to the API:

1. `@repo/api-client` endpoint method
2. Hook (`useQuery` / `useMutation`) in `src/hooks/` or `useOwnerData.ts`
3. Screen / component (props in, events out)
4. Page / route wires hooks to screen

After mutations: `invalidateQueries` — not `refetch()`.

File uploads: multipart field name **`file`**.

Full reference: [ui-backend-sync.md](ui-backend-sync.md).

---

## Layering rules (backend)

Route → Service → Repository → DB. No business logic in route handlers.

Full reference: [api-query-repository-pattern.md](api-query-repository-pattern.md).

---

## Code style

- **Formatter / linter:** Biome (`bun run lint`, `bun run lint:fix`)
- **Types:** strict TypeScript; avoid `any`
- **Imports:** match the package you're in (relative vs `@repo/...`)
- **Comments:** only for non-obvious business logic
- **Tests:** meaningful behaviour tests only — not trivial assertions

---

## Brand (UI work)

- Colours: emerald `#0E7C66`, paper `#FBFAF6`, ink `#14201C`; gold `#C9A063` sparingly
- Type: Newsreader (headlines), Geist (UI)
- Icons: Lucide 1.75px — no emoji in product UI
- Voice: you/your, British spelling, no hype

---

## Secrets

Never commit:

- `.dev.vars` (workers)
- `.env.local` (Next.js apps)
- `google-services.json`, `google-play-service-account.json` (mobile and owner apps — gitignored)
- API tokens, JWT secrets, OAuth client secrets

See [environment-variables.md](environment-variables.md) for where each value belongs.

---

## Related docs

- [getting-started.md](../getting-started.md) — local setup
- [architecture.md](../architecture.md) — system overview
- [testing.md](testing.md) — how to add API tests
- [AGENTS.md](../../AGENTS.md) — monorepo layout and commands
