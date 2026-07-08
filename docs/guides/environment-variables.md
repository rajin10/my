# Environment variables

Where configuration lives across the monorepo — local dev, production, and secrets.

**Auth setup:** [google-auth.md](google-auth.md) (OAuth client IDs, redirect URIs).

---

## Quick reference

| Package                    | Local file                                   | Production config                                      |
| -------------------------- | -------------------------------------------- | ------------------------------------------------------ |
| `workers/api`              | `.dev.vars.development` (or `.dev.vars`)     | `wrangler.jsonc` `env.production` + Cloudflare secrets |
| `workers/auth-service`     | `.dev.vars` (same secrets as API)            | `wrangler.jsonc` `env.production` + Cloudflare secrets |
| `workers/queue`            | `.dev.vars` (optional — no secrets required) | Bindings in `wrangler.jsonc`                           |
| `workers/scheduled`        | `.dev.vars` (optional — no secrets required) | Bindings in `wrangler.jsonc`                           |
| `sites/marketing-site`     | `.env.local` (copy from `.env.example`)      | `wrangler.jsonc` `env.production.vars`                 |
| `sites/business-dashboard` | `.env.local` (copy from `.env.example`)      | `wrangler.jsonc` `env.production.vars`                 |
| `apps/mobile-app`          | Expo public env / `eas.json` profiles        | EAS secrets + `eas.json` `env`                         |
| `apps/owner-app`           | Expo public env / `eas.json` profiles        | EAS secrets + `eas.json` `env`                         |
| CI (GitHub Actions)        | —                                            | Repository secrets (see [ci-cd.md](ci-cd.md))          |

**Rule:** `NEXT_PUBLIC_*` and `EXPO_PUBLIC_*` are embedded in client bundles — never put secrets there.

---

## API worker (`workers/api`)

### Required for local dev

Copy `workers/api/.dev.vars.example` → `.dev.vars`:

| Variable               | Required | Purpose                                                                                                                                                                                                                                                             |
| ---------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `JWT_SECRET`           | Yes      | Signs access tokens                                                                                                                                                                                                                                                 |
| `GOOGLE_CLIENT_ID`     | Yes      | Google OAuth (comma-separated for multiple clients)                                                                                                                                                                                                                 |
| `GOOGLE_CLIENT_SECRET` | Yes      | OAuth code exchange — **secret, never in `wrangler.jsonc`**                                                                                                                                                                                                         |
| `ALLOWED_ORIGINS`      | Yes      | CORS — comma-separated frontend origins                                                                                                                                                                                                                             |
| `PUBLIC_R2_URL`        | Yes      | Absolute, scheme-included base for R2 photo URLs (e.g. `https://storage.yourdomain.com`). Must start with `https://` — a scheme-less host renders as a relative path in `<img src>` and 404s. `R2Storage` defensively prepends `https://` if the scheme is missing. |
| `ENVIRONMENT`          | No       | `development` / `production`                                                                                                                                                                                                                                        |

### Wrangler environments (`wrangler.jsonc`)

`workers/api/wrangler.jsonc` now defines three fully isolated named environments:

- `env.development`
- `env.test`
- `env.production`

Cloudflare bindings are non-inheritable, so each environment defines its own `d1_databases`, `kv_namespaces`, `r2_buckets`, `queues`, `send_email`, and `vars`.

### Production (`env.production` + Cloudflare dashboard)

Non-secret vars in `wrangler.jsonc` `vars`:

| Variable           | Purpose                                                        |
| ------------------ | -------------------------------------------------------------- |
| `ENVIRONMENT`      | Runtime environment label                                      |
| `GOOGLE_CLIENT_ID` | OAuth client ID(s)                                             |
| `PUBLIC_R2_URL`    | R2 public URL base                                             |
| `ALLOWED_ORIGINS`  | Production site origins (marketing, dashboard, custom domains) |

Set secrets per environment (not in config):

- `wrangler secret put JWT_SECRET --env production` — **required**; signs access tokens (callback returns 500 if missing)
- `wrangler secret put GOOGLE_CLIENT_SECRET --env production` — **required** for `POST /auth/google/callback`

Use the same pattern for `staging` (`--env staging`). Verify with `wrangler secret list --env production` — both names must appear.

### Bindings (not env vars)

Configured in `wrangler.jsonc`: `TALASH_DB`, `TALASH_KV`, `TALASH_STORAGE`, `TALASH_QUEUE`, `TALASH_AI`, `TALASH_EMAIL`, `AUTH_SERVICE` (Service Binding to `talash-auth-service`).

**KV isolation:** `env.staging` and `env.production` use **separate** `TALASH_KV` namespace IDs so staging rate-limit counters and OAuth state nonces do not affect production. Staging and production still share the same remote D1 database (see [cli.md](cli.md)).

| Environment | KV namespace title  | Namespace ID                       |
| ----------- | ------------------- | ---------------------------------- |
| staging     | `talash-kv-staging` | `501beb10c51f443395fa891471662853` |
| production  | (production KV)     | `3756ed88c35846098dc79548cfd00b0d` |

To recreate staging KV: `cd workers/api && bunx wrangler kv namespace create talash-kv-staging`, then update `env.staging.kv_namespaces[0].id` in `wrangler.jsonc`.

### Remote D1 operations need Cloudflare auth

Remote CLI DB ops — `db migrate`/`seed`/`fresh --env staging|production` — call `wrangler d1 … --remote`, which requires Cloudflare auth: run `wrangler login` once, or set `CLOUDFLARE_API_TOKEN` (and `CLOUDFLARE_ACCOUNT_ID` in CI). See [cli.md](cli.md#remote-seeding-staging--production).

---

## Auth-service worker (`workers/auth-service`)

Owns `/api/v1/auth/*` and `/api/v1/users/*`. Frontends still call the gateway; auth-service is reached via the `AUTH_SERVICE` Service Binding on `workers/api`.

### Required for local dev

Copy the same secrets as the API worker into `workers/auth-service/.dev.vars`:

| Variable               | Required | Purpose                                              |
| ---------------------- | -------- | ---------------------------------------------------- |
| `JWT_SECRET`           | Yes      | Must **match** `workers/api` — gateway verifies locally |
| `GOOGLE_CLIENT_ID`     | Yes      | Google OAuth                                         |
| `GOOGLE_CLIENT_SECRET` | Yes      | OAuth code exchange                                  |
| `ALLOWED_ORIGINS`      | Yes      | CORS                                                 |
| `PUBLIC_R2_URL`        | Yes      | User avatar URLs                                     |
| `ALLOWED_RESET_URIS`   | Yes      | Password reset redirect allowlist                    |
| `EMAIL_FROM`           | Yes      | Transactional email sender                           |

### Bindings

`TALASH_DB`, `TALASH_KV`, `TALASH_STORAGE` — same D1/KV/R2 as the gateway in each environment.

### Production secrets

Set the same secrets as the API worker:

- `wrangler secret put JWT_SECRET --env production` (must match API worker value)
- `wrangler secret put GOOGLE_CLIENT_SECRET --env production`

See [workers/auth-service/CLAUDE.md](../../workers/auth-service/CLAUDE.md).

---

## Queue worker (`workers/queue`)

No secrets required for local dev. Uses `TALASH_DB` and `TALASH_EMAIL` bindings.

Copy `workers/queue/.dev.vars.example` → `.dev.vars` only if you add custom overrides.

---

## Scheduled worker (`workers/scheduled`)

No secrets required. Uses `TALASH_DB` and `TALASH_QUEUE` bindings only.

---

## Marketing site (`sites/marketing-site`)

Copy `sites/marketing-site/.env.example` → `.env.local`:

| Variable                      | Required | Default (if unset)              | Purpose                                                           |
| ----------------------------- | -------- | ------------------------------- | ----------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`         | No       | `http://localhost:8787`         | API base URL                                                      |
| `NEXT_PUBLIC_SITE_URL`        | No       | `https://talash.app`            | Canonical URL for sitemap, robots, OG                             |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | No       | —                               | Google Maps embed on business pages; placeholder shown if missing |
| `NEXT_PUBLIC_PLAY_STORE_URL`  | No       | Play Store link for `talash.bd` | `/download` page + footer                                         |
| `NEXT_PUBLIC_APP_STORE_URL`   | No       | `""`                            | App Store link (optional)                                         |

Wrangler environments: `sites/marketing-site/wrangler.jsonc` defines `env.development`, `env.test`, `env.production` with separate `NEXT_PUBLIC_API_URL` values.

`NEXT_PUBLIC_*` values are resolved at build time. Ensure `NEXT_PUBLIC_API_URL` is present in the build environment for the target deploy environment.

Marketing site deploy commands:

- Staging: `bun run --filter @repo/marketing-site deploy:staging`
- Production: `bun run --filter @repo/marketing-site deploy:production`

No `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — OAuth is handled by the API worker.

---

## Business dashboard (`sites/business-dashboard`)

Copy `sites/business-dashboard/.env.example` → `.env.local`:

| Variable                    | Required | Default (if unset)      | Purpose                                                            |
| --------------------------- | -------- | ----------------------- | ------------------------------------------------------------------ |
| `NEXT_PUBLIC_API_URL`       | No       | `http://localhost:8787` | API base URL                                                       |
| `NEXT_PUBLIC_MARKETING_URL` | No       | `""`                    | Link to customer site from overview (e.g. `http://localhost:3000`) |

Wrangler environments: `sites/business-dashboard/wrangler.jsonc` defines `env.development`, `env.test`, `env.production` with separate `NEXT_PUBLIC_API_URL` values.

`NEXT_PUBLIC_*` values are resolved at build time. Ensure `NEXT_PUBLIC_API_URL` is present in the build environment for the target deploy environment.

Business dashboard deploy commands:

- Staging: `bun run --filter @repo/business-dashboard deploy:staging`
- Production: `bun run --filter @repo/business-dashboard deploy:production`

**Local ports:** marketing-site usually runs on `:3000`, dashboard on `:3001` when both are started. Set `NEXT_PUBLIC_MARKETING_URL=http://localhost:3000` accordingly.

---

## Mobile apps (`apps/mobile-app`, `apps/owner-app`)

### Expo public env

| Variable                    | Default                 | Purpose                                       |
| --------------------------- | ----------------------- | --------------------------------------------- |
| `EXPO_PUBLIC_API_URL`       | `http://localhost:8787` | API base URL                                  |
| `EXPO_PUBLIC_AUTH_PROVIDER` | `redirect`              | `redirect` (Expo Go) or `native` (EAS builds) |

Set in `eas.json` per build profile (dev / preview / production). Expo Go uses `redirect` unless overridden.

### `app.json` `extra` (not env vars)

| Field                     | Purpose                                                                 |
| ------------------------- | ----------------------------------------------------------------------- |
| `extra.googleWebClientId` | Required for native Google Sign-In (`EXPO_PUBLIC_AUTH_PROVIDER=native`) |
| `extra.eas.projectId`     | EAS project ID                                                          |
| `scheme`                  | Deep link scheme (`mobileapp://` / `ownerapp://`) for OAuth callback    |

Redirect auth flow does not need a client ID in the app — the API worker handles OAuth.

### Gitignored files (not env vars)

- `google-services.json` — Firebase Android config (FCM + Google Sign-In). Copy from `google-services.json.example` after downloading from Firebase Console.
- `google-play-service-account.json` — Play Console service account key for `eas submit`. Copy from `google-play-service-account.json.example`.

---

## GitHub Actions secrets

| Secret                  | Used for                                   |
| ----------------------- | ------------------------------------------ |
| `CLOUDFLARE_API_TOKEN`  | Deploy workers and Pages on push to `main` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account targeting               |

These are exported by the GitHub Actions deploy job and used by Wrangler Action to run `wrangler deploy --env production` for worker packages.

`EXPO_TOKEN` — only needed if you re-add automated EAS workflows.

See [ci-cd.md](ci-cd.md).

---

## Local setup commands

```sh
# API worker
cp workers/api/.dev.vars.example workers/api/.dev.vars
# Edit JWT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ALLOWED_ORIGINS

# Optional: explicit development env file
cp workers/api/.dev.vars.example workers/api/.dev.vars.development

# Marketing site
cp sites/marketing-site/.env.example sites/marketing-site/.env.local

# Business dashboard
cp sites/business-dashboard/.env.example sites/business-dashboard/.env.local

# Seed local DB
bun run cli db seed
bun run api:dev
```

Mobile: `bun run mobile-app:dev` — uses `http://localhost:8787` by default.

---

## Adding a new variable

1. Add to the relevant `.env.example` or `.dev.vars.example`
2. Document in this file
3. If client-exposed (`NEXT_PUBLIC_` / `EXPO_PUBLIC_`), confirm it is safe to embed in the bundle
4. Update production config (`wrangler.jsonc` or EAS) in the same PR

---

## Related docs

- [google-auth.md](google-auth.md) — OAuth clients and redirect URIs
- [eas-deployment.md](eas-deployment.md) — EAS build env and secrets
- [getting-started.md](../getting-started.md) — first-run setup
- [contributing.md](contributing.md) — PR checklist when env changes
