# Auth Service — agent guide

`workers/auth-service` is a separately deployed Cloudflare Worker that owns **identity + authorisation** for Talash.

## Documentation update policy

- Any feature implementation, refactor, behavior change, API change, schema change, command change, or workflow change must include documentation updates in the same task/PR.
- Update existing docs first (especially [../../docs/README.md](../../docs/README.md), [../../docs/guides/api-endpoints.md](../../docs/guides/api-endpoints.md), and related AGENTS/CLAUDE files).
- Any feature implementation or refactor must run lint, tests, and build before completion (`bun run lint`, `bun run --filter @repo/auth-service test`, and `bun run build`, or equivalent scoped commands).

## Responsibilities

- **Public endpoints (via gateway):**
  - `/api/v1/auth/*` — Google OAuth, email/password, sessions, refresh rotation, `/me`
  - `/api/v1/users/*` — self profile, photo upload, delete-account proof, moderator ops
- **Internal endpoints (service-to-service):**
  - `POST /internal/authorise` — resolve `{ user, scopedBranchIds }` for the gateway

Frontends keep calling `workers/api`; `workers/api` proxies these routes to auth-service via the **`AUTH_SERVICE` Service Binding**.

## Key invariants

- JWT **payload shape is internal** to `SessionTokens`; only `SessionTokens.verify()` maps to `AuthUser`.
- “Public auth routes” 401s must not trigger client refresh/sign-out logic in `@repo/api-client`.
- Branch scope semantics: owners → `scopedBranchIds = null`; manager/staff → assigned branch IDs.

## Module layout

Same pattern as `workers/api`:

```
src/modules/auth/     # AuthService, SessionTokens, GoogleIdentity, routes
src/modules/users/    # UsersService, routes (self / owner / moderator sub-apps)
src/internal/         # POST /internal/authorise
src/middleware/       # auth, auth-guard, cors, rate-limit, services injection
```

Repositories and schema live in `@repo/core`.

## Cloudflare bindings

| Binding          | Type          | Used for                                      |
| ---------------- | ------------- | --------------------------------------------- |
| `TALASH_DB`      | `D1Database`  | Users, auth credentials, refresh tokens       |
| `TALASH_KV`      | `KVNamespace` | OAuth state, reset tokens, rate limits        |
| `TALASH_STORAGE` | `R2Bucket`    | User avatar uploads                           |

Required secrets: `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `EMAIL_FROM`, `ALLOWED_RESET_URIS`.

## Local dev

Auth routes are proxied from the gateway — **both workers must run** for sign-in and user profile flows:

```sh
# Terminal 1 — gateway (default port 8787)
bun run api:dev

# Terminal 2 — auth-service (wrangler picks a port; binding resolves automatically)
bun run --filter @repo/auth-service dev
```

`JWT_SECRET` in `workers/api/wrangler.jsonc` (`env.local`) and `workers/auth-service/wrangler.jsonc` (`env.local`) **must match** — the gateway verifies tokens locally on domain routes; auth-service issues them.

`dev:all` does not yet start auth-service automatically; run it in a second terminal when testing auth.

## Testing

```sh
bun run --filter @repo/auth-service test
```

Tests live in `src/__tests__/modules/` and `src/__tests__/internal/`.

## Related docs

- Design: [../../docs/superpowers/specs/2026-06-16-auth-service-split-design.md](../../docs/superpowers/specs/2026-06-16-auth-service-split-design.md)
- Gateway proxy: [../api/CLAUDE.md](../api/CLAUDE.md)
- Endpoint index: [../../docs/guides/api-endpoints.md](../../docs/guides/api-endpoints.md)
