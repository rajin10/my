# Email / password authentication

Talash supports **Google OAuth** and **email/password** sign-in across the API and all four clients. Session tokens (JWT access + refresh) are identical regardless of provider.

## API routes

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/v1/auth/register` | Create account with email + password |
| `POST` | `/api/v1/auth/login` | Sign in with email + password |
| `POST` | `/api/v1/auth/forgot-password` | Request reset email (always 200) |
| `POST` | `/api/v1/auth/reset-password` | Set new password from email token |

Google routes (`/google/*`), `/refresh`, `/logout`, `/me`, and `/sessions` are unchanged.

### Request bodies

**Register / login** accept optional `source` (`marketing-site` | `mobile-app` | `business-app`) — same per-role account rules as Google ([ADR 0002](../adr/0002-per-role-accounts-via-sign-in-source.md)).

**Forgot password** requires `reset_uri` — the client-specific page the email link opens. Must match `ALLOWED_RESET_URIS` (comma-separated env var).

## Data model

Password hashes live in **`auth_credentials`**, not on `users`:

```
users.id  ←── auth_credentials.user_id (unique, cascade delete)
              password_hash (pbkdf2:100000:…)
```

One credentials row per user. Google-only accounts have no row until they set a password (via forgot-password / reset).

## Environment variables

| Variable | Purpose |
| --- | --- |
| `EMAIL_FROM` | Sender for reset emails (e.g. `noreply@talash.bd`) |
| `ALLOWED_RESET_URIS` | Comma-separated allowlist of `reset_uri` values |

Local example (`workers/api/wrangler.jsonc` `local` env):

```
ALLOWED_RESET_URIS=http://localhost:3000/auth/reset-password,http://localhost:3001/auth/reset-password,mobileapp://auth/reset-password,ownerapp://auth/reset-password
```

Without `TALASH_EMAIL` configured, local dev logs the reset URL to the console.

## Client `reset_uri` values

| Client | `reset_uri` |
| --- | --- |
| marketing-site | `{origin}/auth/reset-password` |
| business-dashboard | `{origin}/auth/reset-password` |
| mobile-app | `mobileapp://auth/reset-password` |
| owner-app | `ownerapp://auth/reset-password` |

## Account linking

- Email/password register → new `users` row + `auth_credentials` row.
- Google sign-in with matching email → links `googleId` on the existing row (existing behaviour).
- Google-first account without a password → use **forgot password** to set the first password.

## api-client

```ts
api.auth.register({ email, password, name, source? })
api.auth.login({ email, password, source? })
api.auth.forgotPassword({ email, reset_uri, source? })
api.auth.resetPassword({ token, password })
api.auth.me() // returns flat AuthUser (not { data: AuthUser })
```

401 responses from these public routes do **not** trigger token refresh / `onUnauthorized` (same as Google routes).

**marketing-site:** after email/password sign-in, use `window.location.replace` (not `router.replace`) — same as the Google OAuth callback — so `AuthProvider` bootstraps with tokens already set and the Nav shows the profile slot.

## Account deletion verification

Self-service delete (`DELETE /api/v1/users/:id`) requires proof of identity in the request body:

```ts
api.users.delete(userId, { password: "..." })
// or
api.users.delete(userId, { idToken: googleIdToken })
```

`GET /auth/me` returns `authMethods: { password: boolean, google: boolean }` so clients can show password and/or Google verification and disable unavailable options. All four clients use a two-step UI: confirm → verify → delete. Wrong password returns **422** (`"Verification failed."`) — not 401 — so clients keep the session and show the error in the modal.

Web apps need `NEXT_PUBLIC_GOOGLE_CLIENT_ID` for in-page Google re-auth during delete (same web client ID as the API accepts).

## Related

- [Google Auth](google-auth.md) — OAuth setup and flows
- [Design spec](../superpowers/specs/2026-06-12-email-password-auth-design.md)
