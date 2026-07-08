---
name: run-talash-api
description: Run, launch, boot, start, smoke-test, or curl the Talash API worker (@repo/api) locally. Use when asked to run the API, start the Hono worker, hit /api/v1 endpoints locally, verify the API serves requests, or reproduce an API bug on a clean machine.
---

# Run the Talash API worker

`@repo/api` is a **Hono app on Cloudflare Workers** (Drizzle + D1). It is driven
**headlessly** — there is no GUI. You launch it with `wrangler dev --local`
(fully simulated D1/KV/R2/queue bindings, no Cloudflare auth needed) and drive it
with **curl**. The committed driver is
[`.claude/skills/run-talash-api/smoke.sh`](smoke.sh) — it boots the worker, seeds
data, and asserts the health, public, and authenticated paths.

> **All paths below are relative to `workers/api/` (the unit root).**

## The one-liner (agent path)

```sh
cd workers/api
.claude/skills/run-talash-api/smoke.sh          # migrate + seed + boot + assert + teardown
```

Expected tail:

```
  ✓ /health D1 probe ok
  ✓ /api/health (no DB)
  ✓ /api/v1/businesses envelope
  ✓ /api/v1/search aiRanked
  ✓ auth required (401)
  ✓ authed /api/v1/bookings 200

✅ smoke passed
```

Flags: `--no-seed` (skip reseeding), `--keep` (leave the worker running on
`http://localhost:8787` so you can curl it yourself).

## Prerequisites

Bun + the repo install. No `apt-get` / system packages needed (macOS or Linux);
`wrangler dev --local` runs the worker in workerd with simulated bindings.

```sh
bun install              # from repo root
```

`.dev.vars` must exist in `workers/api/` (it does in this repo; otherwise copy
`.dev.vars.example` and fill `JWT_SECRET`). `GOOGLE_CLIENT_SECRET` is only needed
for the live Google OAuth callback, not for the smoke.

## The `local` env (how local dev is wired)

Local dev runs against the **`local` env** in `wrangler.jsonc` — a self-contained
block of **simulated** bindings (no `remote: true`, dummy IDs) for
`TALASH_DB` / `TALASH_KV` / `TALASH_STORAGE` / `TALASH_QUEUE` (+ `TALASH_AI`).
It is **local-only and never used for deploys** — `test`/`staging`/`production`
stay the source of truth. The package scripts (`bun run dev`,
`bun run db:migrate:local`) and the root `bun run db:migrate` CLI all target
`--env local --local`, so migrate, seed, and the running worker all hit the same
local D1 file. There is no separate `wrangler.dev.jsonc` anymore.

## Manual run (what the driver does, step by step)

```sh
cd workers/api

# 1. migrate the local D1 (idempotent)
bunx wrangler d1 migrations apply TALASH_DB --env local --local

# 2. seed — MUST be done while the worker is stopped (see Gotchas). Use `fresh`
#    (truncate+reseed); plain `db seed` throws UNIQUE on a second run.
(cd ../.. && bun run cli db fresh --count 20 --seed 42)

# 3. boot
bunx wrangler dev --env local --local --port 8787

# 4. drive it (another shell)
curl -s localhost:8787/health                      # {"status":"ok","db":"ok"}
curl -s 'localhost:8787/api/v1/businesses?limit=2'     # {"data":[{...}],"query":{...}}
curl -s 'localhost:8787/api/v1/search?limit=3'     # {"data":[...],"aiRanked":false}
```

### Authenticated calls

Auth is HS256 with the `.dev.vars` `JWT_SECRET`. Mint a token for a real seeded
user (grab a `ownerId` from `/api/v1/businesses`) — no Google flow required:

```sh
# NB: don't name the var UID — it's readonly in bash/zsh.
SECRET=$(grep JWT_SECRET .dev.vars | cut -d'"' -f2)
OWNER=$(curl -s 'localhost:8787/api/v1/businesses?limit=1' | bun -e "console.log(JSON.parse(await Bun.stdin.text()).data[0].ownerId)")
TOKEN=$(bun -e "import {sign} from 'hono/jwt'; console.log(await sign({sub:process.argv[1],email:'dev@talash.bd',name:'Dev',role:'owner',exp:Math.floor(Date.now()/1000)+3600}, process.argv[2], 'HS256'))" "$OWNER" "$SECRET")
curl -s -H "Authorization: Bearer $TOKEN" 'localhost:8787/api/v1/bookings?limit=2'   # {"data":[...]}
```

Routes: `/health` and `/api/health` are unguarded; the API index is under
`/api/v1/*` (auth, users, businesses, branches, services, bookings, reviews, coupons,
team, rewards, search, analytics, customers, campaigns, notifications,
favourites, demo-requests). Scalar API reference: `localhost:8787/api/docs`.

## Test

```sh
cd workers/api && bun run test     # vitest, 276 tests, runs in Node (no worker runtime)
```

## Gotchas (the ones that cost time)

- **Seed while the server is stopped.** The seeder (`tools/cli`) opens the local
  D1 sqlite file directly via `bun:sqlite`. While `wrangler dev` is running it
  holds a WAL lock, and the seeder silently resolves to a *different* stale
  sqlite file under `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/` — you seed
  one DB and query another, so endpoints return `[]`. The driver seeds first,
  then boots.
- **Use `db fresh`, not `db seed`, to re-seed.** `db seed` is not idempotent —
  a second run throws `UNIQUE constraint failed: users.phone`. `db fresh`
  truncates first.
- **Multiple `*.sqlite` files** accumulate in the D1 state dir from past runs
  with different binding names. The seeder picks the one with the latest applied
  migration; always migrating and booting with `--env local` keeps that pointer
  on the right file. If data ever looks wrong, `rm -rf
  .wrangler/state/v3/d1/miniflare-D1DatabaseObject` and re-migrate for a clean
  single-file state.
- **`/health` vs `/api/health`** are different routes: `/health` runs a real D1
  `SELECT 1` (503 if the binding is missing); `/api/health` is a static
  `{"ok":true}` and passes even with no DB. Probe `/health` to confirm bindings.
- **Always pass `--env local`** — bindings live in the `local` env block of
  `wrangler.jsonc`; omitting it falls back to the top-level config (no bindings)
  and migrations/dev fail.
- **Email is not simulated locally** — `TALASH_EMAIL` is omitted from the `local`
  env. Search still works (`aiRanked:false` unless AI is reachable); OTP-email
  sending will no-op. Fine for the smoke.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `No migrations present at …/workers/api/migrations` | You ran a migrate command without `--env local`. Add it. |
| `/health` → `{"status":"degraded","db":"error"}` | Booted without `--env local`, or migrations not applied. Run the migrate step. |
| Endpoints return `[]` after seeding | Seeded while the server was running. Stop it, `db fresh`, then boot. |
| `UNIQUE constraint failed: users.phone` | Used `db seed` on a populated DB. Use `db fresh`. |
| `server never became ready` | Check `/tmp/talash-api-smoke.log` for the wrangler stack trace. |
