# Getting started

Local setup for the Talash monorepo. For architecture and conventions, see [AGENTS.md](../AGENTS.md).

For Cursor session briefs, see [CONTEXT-MAP.md](../CONTEXT-MAP.md) (per-package `CONTEXT.md` files).

---

## Prerequisites

- [Bun](https://bun.sh) 1.3+ (matches CI)
- Node 20+ (some tooling expects it)
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) for Cloudflare Workers local dev
- Xcode / Android Studio if running Expo simulators

---

## Install

```sh
git clone <repo-url>
cd monorepo
bun install
```

---

## Quick start (recommended)

First time — interactive wizard (secrets, env files, DB seed, health check):

```sh
bun run dev:setup   # first time
```

Every day — full stack (API, workers, both web apps, both Expo apps):

```sh
bun run dev:all     # every day
```

See [guides/local-dev.md](guides/local-dev.md) for secrets, `--force`, ports, and troubleshooting.

---

## Database and API

```sh
# Seed local SQLite (default 20 users; use --count for more)
bun run cli db seed

# Or dev-sized seed (100 users)
bun run db:seed:dev

# Start the API gateway worker
bun run api:dev   # http://localhost:8787

# Auth routes are proxied to auth-service — run in a second terminal for sign-in / users
bun run --filter @repo/auth-service dev
```

Reset data anytime:

```sh
bun run db:fresh   # truncate + reseed
bun run cli db status
```

See [guides/cli.md](guides/cli.md) for seeder architecture.

---

## Environment files

`bun run dev:setup` writes all five local env files automatically. For manual setup or production values, see [guides/local-dev.md](guides/local-dev.md) and [guides/environment-variables.md](guides/environment-variables.md).

## Frontends

Run from the monorepo root:

```sh
bun run marketing-site:dev      # customer web — Next.js
bun run business-dashboard:dev  # owner web — Next.js
bun run mobile-app:dev          # customer mobile — Expo
bun run owner-app:dev           # owner mobile — Expo (if scripted)
```

Copy env templates and point apps at the local API — see [guides/environment-variables.md](guides/environment-variables.md).

---

## Workers

```sh
bun run queue:dev       # queue consumer
bun run scheduled:dev   # cron triggers
```

---

## Verify before a PR

```sh
bun run lint
bun run check-types
bun run test
bun run build
```

CI runs the same suite on PRs and pushes to `main`. See [guides/ci-cd.md](guides/ci-cd.md).

---

## What to read next

| Topic | Doc |
| --- | --- |
| Monorepo layout & commands | [AGENTS.md](../AGENTS.md) |
| Architecture & data flow | [architecture.md](architecture.md) |
| API route index | [guides/api-endpoints.md](guides/api-endpoints.md) |
| API modules & repositories | [guides/api-query-repository-pattern.md](guides/api-query-repository-pattern.md) |
| Frontend ↔ API wiring | [guides/ui-backend-sync.md](guides/ui-backend-sync.md) |
| Backend ↔ frontend coverage | [feature-map.md](feature-map.md) |
| Local dev workflow | [guides/local-dev.md](guides/local-dev.md) |
| Environment variables | [guides/environment-variables.md](guides/environment-variables.md) |
| Contributing / PRs | [guides/contributing.md](guides/contributing.md) |
| Google OAuth setup | [guides/google-auth.md](guides/google-auth.md) |
| Mobile EAS builds | [guides/eas-deployment.md](guides/eas-deployment.md) |
| Customer mobile app | [apps/mobile-app/AGENTS.md](../apps/mobile-app/AGENTS.md) |
| Owner mobile app | [apps/owner-app/AGENTS.md](../apps/owner-app/AGENTS.md) |
| Marketing site | [sites/marketing-site/AGENTS.md](../sites/marketing-site/AGENTS.md) |
| Business dashboard | [sites/business-dashboard/AGENTS.md](../sites/business-dashboard/AGENTS.md) |
