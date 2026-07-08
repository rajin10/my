# Talash — agent guide

Monorepo: Booking platform for the Bangladeshi wellness/beauty market. Hono API on Cloudflare Workers, two Expo mobile apps, two Next.js web apps.

**Documentation hub:** [docs/README.md](docs/README.md) · **Onboarding:** [docs/getting-started.md](docs/getting-started.md) · **Contributing:** [docs/guides/contributing.md](docs/guides/contributing.md)

**Session context (Cursor):** [CONTEXT-MAP.md](CONTEXT-MAP.md) indexes per-package [CONTEXT.md](packages/core/CONTEXT.md) briefs — attach the map to pick scope, then the package `CONTEXT.md` for the task at hand. Stable rules stay in this file and package `AGENTS.md` / `CLAUDE.md`.

Key references:

- [docs/architecture.md](docs/architecture.md) — system overview, data flow, deployment
- [docs/guides/api-endpoints.md](docs/guides/api-endpoints.md) — `/api/v1` route index
- [docs/guides/ui-backend-sync.md](docs/guides/ui-backend-sync.md) — frontend ↔ API wiring, hooks, cache rules
- [docs/guides/api-query-repository-pattern.md](docs/guides/api-query-repository-pattern.md) — query parsing, DTOs, BaseRepository, adding modules
- [packages/core/CLAUDE.md](packages/core/CLAUDE.md) — shared library guide
- [workers/api/CLAUDE.md](workers/api/CLAUDE.md) — HTTP gateway worker guide
- [workers/auth-service/CLAUDE.md](workers/auth-service/CLAUDE.md) — identity + authz worker guide
- [workers/queue/CLAUDE.md](workers/queue/CLAUDE.md) — queue worker guide
- [workers/scheduled/CLAUDE.md](workers/scheduled/CLAUDE.md) — cron worker guide

## Documentation update policy

- Any feature implementation, refactor, behavior change, API change, schema change, command change, or workflow change must include documentation updates in the same task/PR.
- Update existing docs first (for example [docs/README.md](docs/README.md), guides under [docs/guides/](docs/guides/), and relevant package/app/worker AGENTS or CLAUDE files).
- If no existing doc covers the change, add a new doc entry and link it from [docs/README.md](docs/README.md).
- Any feature implementation or refactor must run lint, tests, and build before completion (`bun run lint`, `bun run test`, and `bun run build`, or equivalent scoped commands).
- Do not mark work complete until code and docs are both updated and consistent.

## Layout

| Path                       | Package                    | Notes                                                    |
| -------------------------- | -------------------------- | -------------------------------------------------------- |
| `packages/core`            | `@repo/core`               | Shared: schema, repositories, queue types, notifications |
| `packages/ui-native`       | `@repo/ui-native`          | Shared mobile component library (Expo apps) + `cn` util  |
| `workers/api`              | `@repo/api`                | Hono HTTP gateway — domain routes; proxies auth/users     |
| `workers/auth-service`     | `@repo/auth-service`       | Identity + authz — `/api/v1/auth/*`, `/api/v1/users/*` |
| `workers/lpg-service`      | `@repo/lpg-service`        | Commerce API — `/api/v1/products`, `/orders`, `/payments`, `/khata`, etc. |
| `workers/queue`            | `@repo/queue`              | Cloudflare Queue consumer worker                         |
| `workers/scheduled`        | `@repo/scheduled`          | Cloudflare cron trigger worker                           |
| `apps/mobile-app`          | `@repo/mobile-app`         | Expo 56, expo-router — customers                         |
| `apps/owner-app`           | `owner-app`                | Expo 56, expo-router — business owners                      |
| `sites/marketing-site`     | `@repo/marketing-site`     | Next.js + OpenNext/Cloudflare                            |
| `sites/business-dashboard` | `@repo/business-dashboard` | Next.js + OpenNext/Cloudflare                            |
| `tools/cli`                | —                          | DB seed/migrate CLI (bun:sqlite)                         |

## Dev commands

```sh
bun install
bun run dev:setup               # first-run wizard (env, secrets, DB seed)
bun run dev:all                 # full local stack (7 services)
bun run api:dev                 # http://localhost:8787 (gateway)
bun run --filter @repo/auth-service dev   # auth-service (required for /auth and /users locally)
bun run --filter @repo/lpg-service dev    # lpg-service (required for commerce routes locally)
bun run queue:dev               # queue consumer worker
bun run scheduled:dev           # scheduled/cron worker
bun run api:cf-typegen          # regenerate api worker-configuration.d.ts
bun run queue:cf-typegen        # regenerate queue worker-configuration.d.ts
bun run scheduled:cf-typegen    # regenerate scheduled worker-configuration.d.ts
bun run mobile-app:dev          # Expo
bun run marketing-site:dev      # Next.js
bun run business-dashboard:dev  # Next.js
```

## CLI (`tools/cli/`)

Project CLI for database management. Entry: `bun run cli <command>`.

```sh
bun run cli db seed               # seed faker data (default 20 users)
bun run cli db seed --count 1000  # scale up for dev / load testing
bun run cli db seed --seed 42     # reproducible dataset (same data every run)
bun run cli db fresh              # truncate all domain tables then reseed
bun run cli db status             # row counts per table

# Remote: migrate/seed/fresh accept --env local|staging|production (default local).
bun run cli db migrate --env staging              # remote migrate
bun run cli db fresh   --env staging --count 20   # remote truncate + reseed
bun run cli db seed    --env production --force     # remote, typed confirm
```

Convenience aliases (root `package.json`): `bun run db:seed:dev` (100 users), `bun run db:fresh`, `bun run version:bump` (patch bump on web sites — use `--groups` for workers/apps too).

Remote `seed`/`fresh` seed locally → `wrangler d1 export` → `wrangler d1 execute --remote`. Production needs `--force` + a typed DB-name confirm; **staging and production share one remote D1**; remote ops need Cloudflare auth (`wrangler login` / `CLOUDFLARE_API_TOKEN`).

See [docs/guides/cli.md](docs/guides/cli.md) for full reference, seeder architecture, and how to add a seeder for a new table.

<!-- intent-skills:start -->

## Skill Loading

Before substantial work:

- Skill check: run `bunx @tanstack/intent@latest list`, or use skills already listed in context.
- Skill guidance: if one local skill clearly matches the task, run `bunx @tanstack/intent@latest load <package>#<skill>` and follow the returned `SKILL.md`.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

## Git Worktree Rule

- Always create a new worktree from the `develop` branch.
- Recommended command pattern: `git worktree add <path> -b <new-branch> develop`.

## Database migrations (Drizzle)

- **Schema-first only:** edit `packages/core/src/database/schema/*.ts`, then `bun run db:generate` from `workers/api` in an **interactive terminal** (rename prompts).
- **Never** hand-write `.sql` or append `meta/_journal.json` without the matching `meta/NNNN_snapshot.json` — drizzle-kit diffs snapshots, not the journal.
- Each migration needs **SQL + snapshot**; verify with `bunx drizzle-kit check` and a second `db:generate` (`No schema changes, nothing to migrate`).
- Cursor rule: [.cursor/rules/drizzle-migrations.mdc](.cursor/rules/drizzle-migrations.mdc). Rename/check-constraint edge cases: [docs/plan/multi-vertical-schema-design.md](docs/plan/multi-vertical-schema-design.md).

## Learned User Preferences

- Verify claimed task or phase completion against the codebase before reporting work as done.
- On code-review requests, report findings ordered by severity and do not change code unless explicitly asked.
- The user is not a native English speaker; when helpful, first correct grammar and improve prompt wording before executing.
- Keep the improved prompt concise and clear.
- For large superpowers implementation plans, prefer subagent-driven execution: one subagent per plan task with review between tasks (over inline single-session execution).

## Learned Workspace Facts

- UI ↔ backend sync: layering order `@repo/api-client` endpoint → hook → screen → page/route; living guide `docs/guides/ui-backend-sync.md`.
- Both Expo apps centralise state in monolithic `AppProvider` (`context.tsx`); add API wiring in `src/hooks/`, map types in `src/lib/adapters.ts` — keep `context.tsx` for orchestration only; TanStack Query cache persisted via `@repo/mobile-query` (MMKV, read-only offline, clear on sign-out) — guide `docs/guides/mobile-offline.md`.
- FormData photo uploads use field name `file` (not `photo`) — matches API `parseBody()` handlers.
- Mobile auth supports Google OAuth and email/password — see [docs/guides/email-password-auth.md](docs/guides/email-password-auth.md).
- Owner onboarding (web and mobile) follows create sequence: `businesses.create` → `branches.create` → `services.create`; `branches.create` and `services.create` pass parent IDs as query params (`businessId`, `branchId`).
- Next.js sites must `@source "../../../../packages/ui/src/**/*.{ts,tsx}"` in `globals.css` so Tailwind emits `@repo/ui` component utilities; `packages/ui` needs `tsconfig.json` with `"jsx": "react-jsx"`.
- Expo EAS/Android: Firebase `google-services.json` belongs in `app.json` `android.googleServicesFile` (EAS CLI 20.x rejects `eas.json` `base.android.googleServicesFile`); `google-services.json` (build) and `google-play-service-account.json` (Play submit) must not be swapped; gitignored Firebase files need `.easignore` `!google-services.json` for EAS prebuild; turbo/CI `build` = `expo export --platform android`; Play Store = `build:prod`/EAS; owner-app web export fails reanimated-color-picker/FlatList SSR — use android for CI; guide `docs/guides/eas-deployment.md`.
- Remote CLI seed/fresh export uses `EXPORT_ORDER` (parents before children); remote D1 `execute --file` does not reliably honour deferred FK checks.
- API worker requires `JWT_SECRET` and `GOOGLE_CLIENT_SECRET` as wrangler secrets per environment — missing `JWT_SECRET` can surface as hono/jwt `includes` TypeError on Google callback; staging and production use separate `TALASH_KV` namespaces (D1 still shared); verify with `wrangler secret list --env <env>`.
- Walk-in QR: `@repo/walk-in-sync` + `/api/v1/walk-in`; optional customer auth; owner uploads queued submissions via `walkIn.sync`; guest walk-ins need `guestName`+`guestPhone` when no `userId`; spec `docs/superpowers/specs/2026-06-12-walk-in-qr-lan-sync-design.md`.
- `@repo/api-client` must not trigger refresh/`onUnauthorized` on 401 from public auth routes (`/api/v1/auth/google/*`) or step-up verification failures (e.g. wrong password on account delete) — proof failures, not expired sessions.
- API auth/layering: business-level analytics, campaigns, customers, khata, and payments are owner-only (`requireAuth(["owner"])`); routes delegate to services using `AuthorizationService` (`authz.assertBusinessOwner` / `assertTeamMemberAccess`), never inline `ownerId` checks — guide `docs/guides/api-query-repository-pattern.md` §Route authorization. Worker splits (gateway proxy pattern, shared D1, local JWT + `POST /internal/authorise`): auth — `workers/auth-service` owns `/api/v1/auth/*`, `/api/v1/users/*` via `AUTH_SERVICE` binding (on `develop`); LPG — `workers/lpg-service` owns commerce routes (`/products`, `/orders`, `/customer-addresses`, `/payments`, `/khata`) via `LPG_SERVICE` — spec `docs/superpowers/specs/2026-06-16-lpg-service-split-design.md`; booking — `workers/booking-service` owns booking-vertical routes (`/services`, `/bookings`, `/team`, `/coupons`, `/reviews`, `/rewards`, `/analytics`, `/campaigns`, `/customers`) via `BOOKING_SERVICE`; gateway keeps shared shell (`businesses`, `branches`, `notifications`, `favourites`, `demo-requests`); `search` and `walk-in` dispatch by vertical at gateway (KV `branch:<id>:vertical`, sync fan-out, receipts fan-in) — spec `docs/superpowers/specs/2026-06-16-booking-service-split-design.md`. Frontends keep same `@repo/api-client` paths on the gateway.

## Imported Claude Cowork project instructions
