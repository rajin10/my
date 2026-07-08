# CI / CD Guide

Workflow file: `.github/workflows/ci.yml` — type-check, tests, build, Cloudflare deploy.

Mobile EAS builds are **manual** (CLI or Expo dashboard). See [EAS Deployment](eas-deployment.md).

Run **`bun run lint`** locally before every PR — lint is not currently enforced in CI (see checks job below).

---

## Triggers

### `ci.yml`

| Event                 | What runs                                           |
| --------------------- | --------------------------------------------------- |
| Pull request → `main` | `checks` job only (type-check, tests, build)        |
| Push to `main`        | `checks` then `deploy` (scoped to changed packages) |

---

## Jobs

### `checks`

Runs on every PR and every push to `main`. Executes across the whole monorepo via Turborepo (unchanged packages hit the local cache and are skipped).

Dependencies are installed with `bun install`, and CI restores a Bun dependency cache (`~/.bun/install/cache` + `**/node_modules`) keyed by `bun.lock` and workspace `package.json` files.

| Step       | Command                               | CI status     |
| ---------- | ------------------------------------- | ------------- |
| Lint       | `bun run lint` (Biome)                | Commented out |
| Type-check | `bun run check-types` (tsc via turbo) | Active        |
| Test       | `bun run test` (vitest via turbo)     | Active        |
| Build      | `bun run build` (turbo)               | Active        |

To re-enable lint in CI, uncomment the Lint step in `.github/workflows/ci.yml`.

### `deploy`

Runs only on push to `main`, after `checks` passes.

Deploy target detection still uses turbo graph scoping via `turbo run deploy --filter='...[HEAD^1]' --dry=json`, but actual deployment now runs through `cloudflare/wrangler-action@v3` per package. The workflow sets booleans for each deployable package and only runs the matching action steps.

Wrangler action inputs used in this repo:

- `apiToken`: `${{ secrets.CLOUDFLARE_API_TOKEN }}`
- `accountId`: `${{ secrets.CLOUDFLARE_ACCOUNT_ID }}`
- `packageManager`: `bun`
- `workingDirectory`: package-specific path
- `command`: package-specific deploy command

For the two Next.js apps (`sites/marketing-site`, `sites/business-dashboard`), the workflow uses `preCommands: bunx opennextjs-cloudflare build` before `command: deploy`.

Because `NEXT_PUBLIC_*` variables are inlined at build time, CI sets `NEXT_PUBLIC_API_URL` (and `API_URL`) before running site pre-build:

- both branches -> `https://api.mahannankhan.info`

Staging site deploys carry no custom-domain routes and serve on the account's `workers.dev` subdomain; production deploys attach `talash.mahannankhan.info` (marketing) and `business.mahannankhan.info` (dashboard).

**D1 migrations** run automatically before the API worker deploy (and only when `@repo/api` is in scope) via `d1 migrations apply TALASH_DB --remote`. This is idempotent — only unapplied migrations execute. Additive migrations (new tables, new columns with defaults) are safe to run before deploy. Destructive migrations (dropping columns/tables) should be done in two PRs: deploy the code change first, then drop the column.

Worker deploy/migration commands explicitly target the named production environment:

- `deploy --env production --minify`
- `d1 migrations apply TALASH_DB --env production --remote`

Site deploy commands also explicitly target the named production environment:

- `deploy --env production`

---

## Required GitHub secrets

Add these in **Settings → Secrets and variables → Actions**:

| Secret                  | Used by  | Where to get it                                                                                                                                                      |
| ----------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | `ci.yml` | Cloudflare dashboard → My Profile → API Tokens. Create a token with **Workers Scripts: Edit**, **D1: Edit**, and **Pages: Edit** permissions for the Talash account. |
| `CLOUDFLARE_ACCOUNT_ID` | `ci.yml` | Cloudflare dashboard → right sidebar on the Workers overview page.                                                                                                   |

`EXPO_TOKEN` is only needed if you re-add automated EAS workflows.

---

## Path coverage

Turbo dry-run detection (`--filter='...[HEAD^1]'`) still uses the monorepo dependency graph, so:

- Changes to `packages/core` → deploys `workers/api`, `workers/queue`, `workers/scheduled` (all import core)
- Changes to `packages/api-client` → deploys any site or worker that imports it
- Changes only inside `sites/marketing-site` → deploys marketing site only
- Changes only inside `workers/api` → deploys api worker only (+ runs D1 migrations)

---

## Mobile apps (manual EAS)

`apps/mobile-app` and `apps/owner-app` are built and submitted via the EAS CLI from your machine or Expo's dashboard — not via GitHub Actions.

```sh
bun run mobile-app:build:prod
bun run mobile-app:submit
bun run owner-app:build:prod
bun run owner-app:submit
```

See [EAS Deployment](eas-deployment.md) for profiles, credentials, and Play Store setup.

---

## Adding a new deployable package

1. Add a `deploy` script to the package's `package.json` (e.g. `wrangler deploy --env production --minify`).
2. Ensure the package appears in `turbo.json`'s `deploy` task (no change needed if it inherits the root task).
3. Add a package flag and a `cloudflare/wrangler-action@v3` step in `.github/workflows/ci.yml`.
4. The path-based scoping remains automatic — turbo's graph detects which packages are affected.

## Manual DB seed

The **DB Seed** workflow (`.github/workflows/db-seed.yml`, workflow_dispatch) seeds the shared remote D1 with faker demo data from a Linux runner: Actions tab -> DB Seed -> Run workflow (inputs: user count, RNG seed). Use this instead of running `cli db seed --env staging` on low-memory Windows machines, where the CLI's local workerd step fails.
