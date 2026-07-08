# Local dev workflow

One-time setup wizard and daily full-stack orchestrator for the Talash monorepo.

**Commands:** `bun run dev:setup` (first run) · `bun run dev:all` (every day)

See also: [getting-started.md](../getting-started.md) · [environment-variables.md](environment-variables.md) · [google-auth.md](google-auth.md)

---

## Quick start

```sh
bun run dev:setup   # first time — secrets, env files, DB seed, health check
bun run dev:all     # every day — API, workers, web apps, Expo apps
```

`dev:all` runs `dev:setup` automatically if `.talash/dev-setup.json` is missing or stale.

---

## What the wizard does (7 steps)

| Step | Action |
| --- | --- |
| 1 | Check Bun 1.3+, Node 20+, wrangler |
| 2 | `bun install` (skipped if `node_modules` exists) |
| 3 | Resolve secrets (see below) |
| 4 | Write five local env files |
| 5 | `bun run db:fresh` (skipped on re-run unless `--force`) |
| 6 | Verify ports 8787, 3000, 3001 are free |
| 7 | Start API briefly, poll `GET /health` until 200 |

On success, writes `.talash/dev-setup.json` (gitignored).

---

## Secrets

Resolution order:

1. **`TALASH_DEV_SECRETS`** — JSON env var for automation/CI:

   ```sh
   export TALASH_DEV_SECRETS='{"jwtSecret":"…","googleClientSecret":"GOCSPX-…"}'
   bun run dev:setup
   ```

2. **Interactive prompts** — when run in a TTY.

3. **Exit with instructions** — non-interactive without env var; see [google-auth.md](google-auth.md) for team vault values.

Public values are **not** prompted — the shared Google client ID is baked into templates.

| Secret | Used in |
| --- | --- |
| `jwtSecret` | `workers/api/.dev.vars` and `workers/auth-service/.dev.vars` (must match) |
| `googleClientSecret` | `workers/api/.dev.vars` and `workers/auth-service/.dev.vars` |

---

## Generated env files

| File | Package |
| --- | --- |
| `workers/api/.dev.vars` | API gateway worker |
| `workers/auth-service/.dev.vars` | Auth-service worker (same `JWT_SECRET` as API) |
| `sites/marketing-site/.env.local` | Marketing site |
| `sites/business-dashboard/.env.local` | Business dashboard |
| `apps/mobile-app/.env` | Customer mobile |
| `apps/owner-app/.env` | Owner mobile |

All point at `http://localhost:8787` for the API. Mobile apps use `EXPO_PUBLIC_AUTH_PROVIDER=redirect` for Expo Go OAuth.

Setup is **idempotent**: existing localhost env files are skipped unless you pass `--force`.

```sh
bun run dev:setup --force   # regenerate all env files and re-seed DB
```

---

## What `dev:all` starts

| Order | Service | URL |
| --- | --- | --- |
| 1 | API (gateway) | http://localhost:8787 |
| 2 | Queue worker | — |
| 3 | Scheduled worker | — |
| 4 | Marketing site | http://localhost:3000 |
| 5 | Business dashboard | http://localhost:3001 |
| 6 | Mobile app | Expo DevTools |
| 7 | Owner app | Expo DevTools |

> **Auth-service:** not started by `dev:all`. Run `bun run --filter @repo/auth-service dev` in a second terminal when testing sign-in, `/me`, or user profile routes — the gateway proxies `/api/v1/auth/*` and `/api/v1/users/*` via Service Binding.

API, queue, and scheduled start first. Frontends wait until `GET /health` returns 200 (30 s timeout). Logs are prefixed by service name. **Ctrl+C** stops all child processes.

---

## Ports

| Port | Service |
| --- | --- |
| 8787 | API worker |
| 3000 | Marketing site |
| 3001 | Business dashboard |

If setup reports a port conflict:

```sh
lsof -i :8787   # find the process
kill <pid>      # stop it
```

---

## Troubleshooting

### Missing secrets (non-interactive)

Set `TALASH_DEV_SECRETS` or run `bun run dev:setup` in a terminal with a TTY.

### Frontends hit production API

Re-run setup with `--force` if env files contain `https://api.talash.bd` or similar production URLs.

### Health check timeout

Ensure port 8787 is free and `workers/api/.dev.vars` has valid secrets. Try `bun run api:dev` alone and open http://localhost:8787/health.

### Auth routes return 500 or fail to proxy

Start auth-service in a second terminal: `bun run --filter @repo/auth-service dev`. Confirm `JWT_SECRET` matches in both `workers/api/wrangler.jsonc` and `workers/auth-service/wrangler.jsonc` under `env.local`.

### Manual env setup (fallback)

If you prefer copying templates manually, see [environment-variables.md](environment-variables.md). The wizard templates in `scripts/dev/templates.ts` are the source of truth for local values — do not rely on gitignored `.env.example` files which may default to production URLs.

---

## Auth smoke test

After `bun run dev:all`:

1. http://localhost:3000 — Google sign-in
2. http://localhost:3001 — Google sign-in
3. Expo Go — both apps via redirect OAuth flow

See [google-auth.md](google-auth.md) for OAuth redirect URI configuration.
