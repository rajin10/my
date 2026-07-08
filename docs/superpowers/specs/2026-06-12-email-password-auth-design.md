# Email/password authentication — design

- **Date:** 2026-06-12
- **Status:** Approved design — ready for implementation planning
- **Scope:** API + all four clients (marketing-site, business-dashboard, mobile-app, owner-app)
- **Related:** [Google Auth guide](../../guides/google-auth.md) · [ADR 0002 — per-role accounts via sign-in source](../../adr/0002-per-role-accounts-via-sign-in-source.md)

## Context

Talash currently supports **Google-only** sign-in across the API and all clients. Session infrastructure (JWT access + refresh tokens, rotation, `/me`, session management) is mature and provider-agnostic — all sign-in paths converge on `SessionTokens.issue()`.

Per-role accounts (ADR 0002) allow one email to hold separate `user` and `owner` rows. Google sign-in already auto-links by email when `googleId` is null. This design adds email/password as a parallel credential method without changing the session model or role-selection rules.

## Goals

Add simple email/password authentication alongside Google:

- Register with email + password + name
- Login with email + password
- Forgot/reset password via email (no signup email verification)
- All four clients updated with dual auth UI

## Decisions log

| Decision | Choice | Rationale |
|---|---|---|
| Scope | Register + login + forgot/reset | User confirmed; no email verification, no change-password-while-logged-in |
| Clients | All four (API + 2 sites + 2 Expo apps) | User confirmed |
| Architecture | `auth_credentials` table + KV reset tokens | Sensitive auth data isolated from the public user profile; mirrors existing `auth_refresh_tokens` pattern |
| Password policy | Min 8 chars, no complexity | User confirmed |
| Account linking | Auto-link Google when `googleId` is null; password login on same row once set | Symmetric with existing Google flow; Google-first users set password via forgot-password |
| Reset links | Per-client URIs via client-supplied `reset_uri` | Owner-app and business-dashboard share `business-app` source — `reset_uri` disambiguates (mirrors Google `redirect_uri`) |
| Password hashing | PBKDF2-SHA256 via `crypto.subtle`, 100k iterations | Native on Workers; no WASM bcrypt bundle |
| Email delivery | Reactivate `TALASH_EMAIL` binding | Binding exists; OTP path was retired |

## Out of scope (v1)

- Email verification on signup
- Change password while logged in
- OTP / magic links
- Social providers beyond Google
- Admin-created password accounts

---

## Section 1 — API routes & data model

### New routes (under `/api/v1/auth`)

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| `POST` | `/register` | Public | `{ email, password, name, source? }` | `{ user, accessToken, refreshToken, expiresIn, isNewUser: true }` |
| `POST` | `/login` | Public | `{ email, password, source? }` | `{ user, accessToken, refreshToken, expiresIn }` |
| `POST` | `/forgot-password` | Public | `{ email, source?, reset_uri }` | `{ message }` — always 200 |
| `POST` | `/reset-password` | Public | `{ token, password }` | `{ message }` |

Existing routes unchanged: `/refresh`, `/logout`, `/me`, `/sessions`, all Google routes.

`source` follows the same rules as Google (`marketing-site` / `mobile-app` / `business-app` → role via `roleForSource()`). Absent `source` defaults to least-privileged `user`.

### Schema change

New table `auth_credentials` (alongside existing `auth_refresh_tokens` in `auth.schema.ts`):

```ts
auth_credentials
  id                  text PK
  user_id             text FK → users.id (unique, cascade delete)
  password_hash       text nullable   // pbkdf2:100000:<salt_b64>:<hash_b64>
  password_updated_at text nullable
  created_at, updated_at, deleted_at
```

The `users` table stays profile-only — no password column. One credentials row per user (`user_id` unique). Login and reset look up credentials by `user_id` after resolving the user by `(email, role)`.

Migration: edit `packages/core/src/database/schema/auth.schema.ts`, run `bun run db:generate` in an interactive terminal.

### Reset token storage (KV)

```
Key:   reset:token:<uuid>
Value: { userId, email, source, resetUri }
TTL:   3600 (1 hour), single-use (deleted on successful reset)
```

Add `resetToken` key helper to `KV_KEYS` and `KV_TTL` in `workers/api/src/core/kv/cache.ts`.

### Per-client reset URIs

Client sends `reset_uri` on forgot-password. API validates against `ALLOWED_RESET_URIS` env (comma-separated).

| Client | Example `reset_uri` |
|---|---|
| marketing-site | `https://talash.bd/auth/reset-password` |
| business-dashboard | `https://business.talash.bd/auth/reset-password` |
| mobile-app | `mobileapp://auth/reset-password` |
| owner-app | `ownerapp://auth/reset-password` |

Email link format: `{reset_uri}?token={uuid}`.

Local dev URIs (e.g. `http://localhost:3000/auth/reset-password`) must be included in local `.dev.vars`.

### Account linking rules

1. **Register (email/password)** → create row with `email + passwordHash + role`; `googleId` null.
2. **Login (email/password)** → find by `(email, role)`; verify hash; 401 generic `"Invalid email or password."` if no row, no `passwordHash`, or wrong password.
3. **Google sign-in (existing)** → if row exists by email with null `googleId`, link `googleId`; if row already has `googleId`, same row; if Google-first with no password, user sets first password via **forgot-password**.
4. **Conflict on register:** email exists for role with `googleId` but no `passwordHash` → 409 with message to sign in with Google or use forgot-password to set a password.

### Rate limits

| Route | Limit |
|---|---|
| `/register` | 10 req / 60 s per IP |
| `/login` | 20 req / 60 s per IP |
| `/forgot-password` | 5 req / 60 s per IP |
| `/reset-password` | 10 req / 60 s per IP |

---

## Section 2 — Backend modules, hashing & email

### Module layout

```
workers/api/src/modules/auth/
  password-identity.ts    # hash, verify, validate policy — pure, unit-testable
  password-email.ts       # reset email template + send via TALASH_EMAIL seam
  auth.service.ts         # register, login, forgotPassword, resetPassword orchestration

packages/core/src/database/repositories/
  auth.repository.ts      # registerWithPassword, findByEmailAndRole, findCredentialsByUserId, setPasswordHash
```

`PasswordIdentity` is injectable like `GoogleIdentity` — no DB, no KV. `AuthService` owns KV reset-token lifecycle (generate → store → validate → delete), same as OAuth state.

Wire `TALASH_EMAIL` and new env vars in `middleware/services.ts` when constructing `AuthService`.

### Password hashing

**PBKDF2-SHA256** via `crypto.subtle`:

- 100,000 iterations
- 16-byte random salt per password
- Stored format: `pbkdf2:100000:<salt_b64>:<hash_b64>`

`PasswordIdentity` methods:

- `hash(password) → string`
- `verify(password, stored) → boolean` (constant-time compare)
- `validatePolicy(password) → void` — throws `ValidationError` if < 8 chars

Email normalised to lowercase + trimmed before lookup/store.

### Environment variables

| Variable | Purpose |
|---|---|
| `EMAIL_FROM` | Sender address (e.g. `noreply@talash.bd`) |
| `ALLOWED_RESET_URIS` | Comma-separated allowlist of reset URIs |

Add to `wrangler.jsonc` vars (per env), `.dev.vars`, `.env.example`, and `docs/guides/environment-variables.md`.

### Forgot-password email

`PasswordEmail` module with injectable `SendEmail` seam:

```
Subject: Reset your Talash password

Hi {name},

We received a request to reset your password. Tap the link below — it expires in 1 hour.

{reset_uri}?token={token}

If you didn't request this, ignore this email.
```

Forgot-password **always returns 200** with `"If an account exists, a reset link has been sent."` Email sent only when a matching `(email, role)` row exists.

Local dev without email: log reset URL to console when `ENVIRONMENT=local`.

### AuthService flows

```
register(email, password, name, source)
  → validate policy → normalise email → role = roleForSource(source)
  → repo.registerWithPassword(...)  [409 if email taken for role]
  → sessionTokens.issue(user)

login(email, password, source)
  → find by (email, role) → verify hash
  → 401 generic if no row / no hash / wrong password
  → sessionTokens.issue(user)

forgotPassword(email, source, resetUri)
  → validate resetUri against allowlist
  → find user; if found → generate token → KV store → send email
  → always return generic success message

resetPassword(token, password)
  → validate policy → KV lookup → delete token (single-use)
  → repo.setPasswordHash(userId, hash) → return success message
```

### `@repo/api-client` additions

```ts
register(body: { email, password, name, source? })
login(body: { email, password, source? })
forgotPassword(body: { email, reset_uri, source? })
resetPassword(body: { token, password })
```

`@repo/api-client` must **not** trigger refresh/`onUnauthorized` on 401 from `/api/v1/auth/register`, `/login`, `/forgot-password`, `/reset-password` (same rule as Google routes).

---

## Section 3 — Client UI

All four clients keep Google sign-in and add email/password below an "or" divider. Same session handling after login/register — store tokens via existing `tokenStore`, bootstrap auth.

### Web sites (Next.js)

**marketing-site**

| Route | Purpose |
|---|---|
| `/login` | Email + password form; link to register and forgot-password |
| `/register` | Name, email, password; `source: "marketing-site"` |
| `/forgot-password` | Email; `reset_uri: {origin}/auth/reset-password` |
| `/auth/reset-password` | Reads `?token=`; new password → `POST /reset-password` |

**business-dashboard**

Same pattern on existing `AuthScreen` / `/login` with `source: "business-app"`.

### Mobile apps (Expo)

**mobile-app** and **owner-app** — new screens in auth stack:

| Screen | Purpose |
|---|---|
| Sign-in (existing) | Google + email/password + links |
| Register | Name, email, password |
| Forgot password | Email → API with app deep-link `reset_uri` |
| Reset password | Deep-link handler at `auth/reset-password?token=` |

Deep-link URIs:

- mobile-app: `mobileapp://auth/reset-password`
- owner-app: `ownerapp://auth/reset-password`

Register Expo linking config for reset-password route.

`source` values unchanged: mobile-app → `"mobile-app"`, owner-app → `"business-app"`.

### Shared UI patterns

- Email: `type="email"`, autocomplete hints
- Password: `type="password"`, show/hide toggle
- Client-side min 8 chars before submit; server 422 for policy violations
- Reuse/extend existing auth error helpers
- Loading states on submit buttons

### Auth screen layout

```
┌─────────────────────────────┐
│  [Continue with Google]     │
│                             │
│  ─────── or ───────         │
│                             │
│  Email                      │
│  Password                   │
│  [Sign in]                  │
│                             │
│  Forgot password? · Register│
└─────────────────────────────┘
```

---

## Section 4 — Testing & documentation

### Tests

**Unit** (`password-identity.test.ts`):

- Hash/verify round-trip
- Wrong password rejected
- Policy validation (< 8 chars → error)

**Service/route** (`auth.routes.test.ts` extensions):

- Register → login → `/me` happy path
- Duplicate register → 409
- Login wrong password → 401 (generic message)
- Forgot-password → always 200
- Reset with valid token → login with new password works
- Reset token single-use
- Google-first account → forgot-password sets password → email login works
- Rate limits at configured thresholds

### Documentation updates (same implementation PR)

- New: `docs/guides/email-password-auth.md`
- Update: `docs/guides/api-endpoints.md`, `docs/guides/google-auth.md`, `docs/guides/environment-variables.md`
- Update: `workers/api/CLAUDE.md`, root `AGENTS.md`, `apps/mobile-app/AGENTS.md`, `apps/owner-app/AGENTS.md`, `docs/guides/ui-backend-sync.md`
- Remove "Google-only" / "do not add email/password" constraints from agent guides

---

## Implementation notes

- Follow existing module pattern: `auth.routes.ts` OpenAPI definitions, thin handlers in `index.ts`, business logic in `AuthService`, DB in `AuthRepository`.
- `passwordHash` must never appear on `users` rows, in JWT payloads, user list responses, or `UsersRepository` selectable fields — it lives only in `auth_credentials`.
- Seeder: optionally add a dev user with password hash for local testing (CLI seeder or documented curl flow).
