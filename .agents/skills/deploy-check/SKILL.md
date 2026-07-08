---
name: deploy-check
description: Pre-deploy safety checklist for Talash — confirms environment, git state, and runs the correct deploy command per target
---

# Deploy checklist

## Understand the normal deploy path first

**Deploys are automated via GitHub Actions.** The correct flow for almost every deploy is:

- **Staging**: push or merge to `staging` branch → CI runs checks → CI deploys automatically
- **Production**: push or merge to `main` branch → CI runs checks → CI deploys automatically

⚠️ **Known issue in production CI** (`production.yml`): the `checks` job has `if: github.ref == 'refs/heads/develop'` — this condition is wrong (should be `main`). Until fixed, the `checks` job never runs on production pushes, meaning the `deploy` job (which `needs: checks`) also never runs. **Production deploys via CI are currently broken.** Raise this with the team before deploying to production.

Only proceed with a **manual local deploy** when:
- CI is broken and a hotfix must go out immediately
- You need to deploy a specific target that CI wouldn't detect (rare)
- You are explicitly asked to deploy manually

---

## Pre-flight checks (run these before any manual deploy)

### 1. Confirm git state is clean
```sh
git status
```
There should be no uncommitted changes. If there are, either commit them or stash before deploying — you want to deploy exactly what's in history.

### 2. Confirm the correct branch
```sh
git branch --show-current
```
| Branch | Deploys to | Wrangler env flag |
|--------|-----------|-------------------|
| `staging` | Staging (CF staging env) | `--env staging` |
| `main` | Production (CF production env) | `--env production` |

**Never deploy production from a feature branch.** If you're not on `main`, stop.

### 3. Confirm checks pass locally
```sh
bun run check-types && bun run test && bun run build
```
Do not deploy if any of these fail.

---

## Identify the deploy target

Ask: which package(s) changed?

| What changed | Target name | bun command |
|---|---|---|
| `workers/api/` | API worker | `bun run deploy:api` |
| `workers/queue/` | Queue worker | `bun run deploy:queue` |
| `workers/scheduled/` | Scheduled worker | `bun run deploy:scheduled` |
| All three workers | Workers bundle | `bun run deploy:workers` |
| `sites/marketing-site/` | Marketing site | `bun run deploy:marketing-site` |
| `sites/business-dashboard/` | Business dashboard | `bun run deploy:business-dashboard` |
| Both sites | Sites bundle | `bun run deploy:apps` |
| Everything | Full deploy | `bun run deploy:all` |

`packages/core/` changes alone do not deploy — they affect whichever worker/site imports them; deploy that downstream package instead.

---

## Special steps per target

### API worker — migrations MUST run before deploy
If `workers/api/` changed and there are new migration files in `workers/api/drizzle/`, apply them first:

```sh
# Staging:
cd workers/api && bunx wrangler d1 migrations apply TALASH_DB --env staging --remote

# Production:
cd workers/api && bunx wrangler d1 migrations apply TALASH_DB --env production --remote
```

Then run the deploy:
```sh
bun run deploy:api
```

Migrations are idempotent — applying them again when there's nothing new is safe.

### Marketing site / business dashboard — Next.js build required
The Turbo deploy task handles this automatically via `preCommands: bunx opennextjs-cloudflare build` in CI, and the Turbo config should mirror this locally. If the build artifact is stale or missing, run manually:

```sh
# For marketing site:
cd sites/marketing-site && bunx opennextjs-cloudflare build
# For business dashboard:
cd sites/business-dashboard && bunx opennextjs-cloudflare build
```

Then run the deploy script from the monorepo root.

---

## Confirm before running

Before executing any deploy command, state clearly:
- **Target**: which package(s)
- **Environment**: staging or production
- **Branch**: currently on `staging` or `main`
- **Migrations needed**: yes/no (API only)

Get explicit confirmation from the user, then run the command.

---

## After deploy

Check the Cloudflare dashboard or use the Cloudflare observability MCP to confirm the new version is live:
```sh
# Quick health check after API deploy:
curl https://<api-host>/health
```

If the deploy fails mid-way (e.g. migration applied but worker deploy failed), do not retry blindly — investigate the error first. Migrations are safe to re-run; partial worker deploys just mean the old version is still live.
