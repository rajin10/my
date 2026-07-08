# Auth-service worker split — design

- **Date:** 2026-06-16
- **Status:** Implemented on `develop` (2026-06-16)
- **Scope:** `workers/api` (gateway) + `workers/auth-service` (new) + `packages/api-client` (no path changes) + `packages/core` (reused repos/schema)

## Problem

Today `workers/api` owns:

- Authentication (`/api/v1/auth/*`): Google OAuth, email/password, session tokens, refresh token rotation, `/me`, sessions.
- Users (`/api/v1/users/*`): self profile + photo upload + delete account proof.
- Authorisation: role gates (`requireAuth`) + branch scoping (`AuthorizationService.resolveBranchScope`) used across owner/manager/staff routes.

We want to **separate identity + authorisation** into a separately deployed Worker, `workers/auth-service`, while keeping the rest of the domain modules (bookings, businesses, orders, etc.) in `workers/api`.

## Goals

- Move **identity + authorisation** to `workers/auth-service` deployed independently.
- Keep **frontends unchanged initially** (they keep calling the same `/api/v1/...` base URL).
- Preserve current auth semantics:
  - refresh + rotation behaviour
  - “public auth routes” must not trigger client-side refresh/auto sign-out on 401
  - branch-scope injection (`scopedBranchIds`) continues to work
- Keep request latency reasonable (avoid adding a network hop to every request when not needed).

## Non-goals (v1)

- Cross-service caching of authz decisions.
- New permission model / fine-grained permission sets (we keep role + branch-scope as-is).
- Changing `@repo/api-client` public paths (no breaking client contract).

## Decisions log

| Decision | Choice |
| --- | --- |
| Surface for frontends | **Frontends keep calling `workers/api`**; gateway proxies auth + users |
| Worker-to-worker auth | **Cloudflare Service Bindings** (`workers/api` → `workers/auth-service`) |
| JWT verification | `workers/api` **verifies JWT locally**; delegates “who can do what” to `auth-service` |
| Internal authorisation contract | Single internal endpoint returning **`{ user, scopedBranchIds }`** |
| Caching | **Per-request only** (no cross-request caching in gateway) |

## Architecture (selected approach)

### Public routing

`workers/api` remains the single public edge API for frontends. It proxies:

- `/api/v1/auth/*` → `workers/auth-service`
- `/api/v1/users/*` → `workers/auth-service`

All other `/api/v1/*` modules remain implemented in `workers/api`.

### Internal authorisation

`workers/api` calls `workers/auth-service` via Service Binding to resolve authorisation context when needed.

The gateway keeps local JWT verification for performance, then invokes auth-service for scope/role decisions.

## Contracts

### 1) Internal endpoint: `POST /internal/authorise`

**Audience:** only other Talash workers (initially `workers/api`) via Service Binding.

**Request**

- Headers:
  - `Authorization: Bearer <accessToken>`
- Body:
  - `requiredRoles?: string[]`
  - `branchScope?: boolean`

**Response (200)**

```ts
type InternalAuthoriseResponse = {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    photoUrl?: string | null;
  };
  scopedBranchIds: string[] | null; // null = owner (unrestricted), array = manager/staff assigned branches
};
```

**Errors**

- `401` invalid/expired token
- `403` caller does not satisfy `requiredRoles` or is not allowed to resolve scope

**Notes**

- This endpoint is explicitly **not** a general “permissions list” API in v1.
- `workers/api` does **not** cross-request cache the result; it’s per-request only.

### 2) Gateway proxying `/api/v1/auth/*` and `/api/v1/users/*`

`workers/api` must proxy responses with:

- identical HTTP status codes
- identical JSON bodies (or pass-through for `204`/empty)
- identical content-type headers where relevant

The gateway should avoid “re-wrapping” errors; the goal is contract parity for all clients.

## Code ownership after split

### `workers/auth-service` owns

- `/api/v1/auth/*` routes and `AuthService` + `SessionTokens` implementation.
- `/api/v1/users/*` routes + `UsersService` including:
  - delete account proof verification (password or Google ID token)
  - photo upload to R2 (`file` form field)
- Authorisation logic currently living in `workers/api/src/core/authorization.ts`, including:
  - `resolveBranchScope(user)` and any business/team access primitives required by branch-scoped routes.
- `POST /internal/authorise` and any future internal authz endpoints.

### `workers/api` owns

- All non-auth/user domain modules.
- Gateway proxy routing for `/api/v1/auth/*` and `/api/v1/users/*`.
- Local JWT verification middleware (fast path) to extract the authenticated `user` subject.
- Calling `POST /internal/authorise` when role/scope resolution is required.

## Deployment & configuration

### `workers/auth-service` bindings

- **D1**: `TALASH_DB`
- **KV**: `TALASH_KV` (OAuth state, reset tokens, rate limits)
- **R2**: `TALASH_STORAGE` (user avatars)
- **Email** (if used): `TALASH_EMAIL`
- **Env/secrets** (at minimum): `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `EMAIL_FROM`, `ALLOWED_RESET_URIS`

### `workers/api` additions

- **Service Binding**: e.g. `AUTH_SERVICE` pointing at `workers/auth-service`
- Keeps existing domain bindings (D1/KV/R2/Queue/etc.) as today.

## Migration plan (phased, reversible)

### Phase 0 — Scaffold

- `workers/auth-service` exists (created via `npm create cloudflare@latest`).

### Phase 1 — Auth routes move

- Move `/api/v1/auth/*` to `auth-service`.
- Add gateway proxying in `workers/api`.
- Ensure `@repo/api-client` continues to call the same paths.

### Phase 2 — Users routes move

- Move `/api/v1/users/*` to `auth-service`.
- Add gateway proxying in `workers/api`.

### Phase 3 — Authorisation centralisation

- Implement `POST /internal/authorise` in `auth-service`.
- Update `workers/api` auth guard(s) to call it for:
  - role gates (requiredRoles)
  - branch scope injection (`branchScope: true` ⇒ sets `scopedBranchIds`)

## Testing

- **Auth-service**
  - Unit tests for token flows (refresh rotation, logout, `/me`), and delete-account proof verification.
  - Route tests for `/api/v1/auth/*` and `/api/v1/users/*`.
  - Route tests for `/internal/authorise` (401/403/200 cases).

- **Gateway (`workers/api`)**
  - Proxy tests: for representative endpoints under `/api/v1/auth/*` and `/api/v1/users/*`, ensure status/body parity.
  - Auth-guard tests: verify `branchScope` injection still yields the same `scopedBranchIds` behaviour as before.

- **Clients**
  - `packages/api-client` tests continue to pass without path changes.

## Documentation updates (during implementation)

- `docs/architecture.md` — add auth-service to the worker diagram and data flow.
- `docs/guides/api-endpoints.md` — clarify that auth/users are served by auth-service behind the gateway.
- `workers/api/CLAUDE.md` — describe gateway proxy + internal authorise call.
- New `workers/auth-service/CLAUDE.md` or `AGENTS.md` — document auth-service responsibilities and layering.

