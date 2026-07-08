# Delete account verification — design

- **Date:** 2026-06-12
- **Status:** Approved design — ready for implementation planning
- **Scope:** API + all four clients (marketing-site, business-dashboard, mobile-app, owner-app)
- **Related:** [Email/password auth guide](../../guides/email-password-auth.md) · [Google Auth guide](../../guides/google-auth.md) · [API endpoints](../../guides/api-endpoints.md)

## Context

`DELETE /api/v1/users/:id` is authenticated and self-only, but a stolen session JWT is enough to permanently delete an account — the client only shows `window.confirm` / `Alert.alert` with no second factor.

Account deletion exists on all four clients:

| Client | Location |
|---|---|
| marketing-site | `ProfileCard.tsx` — confirm → delete → logout |
| business-dashboard | `account/page.tsx` — danger zone card |
| mobile-app | `AccountScreen.tsx` — Alert → delete |
| owner-app | `MoreScreen.tsx` — Alert → delete |

Auth methods already in production:

- **Email/password** — `auth_credentials.password_hash` (PBKDF2)
- **Google OAuth** — `users.googleId`
- **OTP** — retired; not used for this feature

Google-only accounts may have no password until they set one via forgot-password.

## Goals

Require the user to prove identity (password **or** Google re-auth) before account deletion. Enforce on the **API** so all clients are protected, not just marketing-site UI.

## Decisions log

| Decision | Choice | Rationale |
|---|---|---|
| Enforcement | API-level on `DELETE /users/:id` | User confirmed — UI-only checks are bypassable |
| Clients | All four updated in the same PR as the API | Talash controls every caller; no grace period |
| Verification methods | Password **or** Google — user picks | User confirmed option B |
| Method availability UI | Show both; disable unsupported options | User confirmed option C; driven by `/auth/me` flags |
| Request shape | Single `DELETE` with proof in body | User confirmed option A — minimal surface |
| Verification logic location | `AuthService.verifyAccountAction()` called by `UsersService.delete()` | Keeps auth crypto in the auth module; reusable later |
| OTP | Out of scope | Infrastructure retired; password + Google cover all linked accounts |

## Out of scope (v1)

- Email OTP / magic-link verification
- Deletion cooling-off period or undo window
- Reusing verification for other sensitive actions (change email, revoke all sessions) — helper is structured for future reuse but not wired elsewhere
- Moderator/admin delete flows (unchanged)

---

## Section 1 — API & data flow

### `/auth/me` — auth capability flags

Extend the response and `AuthUser` in `@repo/api-client`:

```ts
authMethods: {
  password: boolean;  // auth_credentials row exists with non-null passwordHash
  google: boolean;    // users.googleId is set
}
```

Computed server-side on each `/me` call — **no schema migration**.

Implementation: `AuthService.getUser()` (or a dedicated helper) loads the user row and credentials row, returns flags alongside existing profile fields.

### `DELETE /api/v1/users/:id` — required verification body

**Breaking change:** request body is now **required**.

```ts
// Exactly one field — validated with z.union + .refine()
{ password: string }   // min 1 character
| { idToken: string }  // Google ID token from fresh client-side re-auth
```

Reject **422** when:

- Body has both fields or neither field
- Chosen method is unavailable for the account (`password` sent but no credentials; `idToken` sent but no `googleId`)

### `AuthService.verifyAccountAction(userId, proof)`

| Path | Steps | Errors |
|---|---|---|
| Password | Load `auth_credentials` for `userId`; verify via `PasswordIdentity.verify()` | 422 if no password set or wrong password (`"Verification failed."`) |
| Google | `GoogleIdentity.verifyIdToken(idToken)`; assert `profile.sub === user.googleId` | 422 if no Google linked; **403** if token valid but wrong Google account |

Use generic copy for wrong password (same as login — no enumeration).

On success, `UsersService.delete(id)` runs the existing soft-delete path unchanged.

### Rate limiting

Add KV-backed rate limit on `DELETE /users/:id`:

- **5 attempts / 15 minutes per userId**
- Separate from login limits — mitigates brute-force on a stolen session

### Wiring

```
Client → DELETE /users/:id { password | idToken }
       → authenticate middleware (JWT)
       → self-only check (c.var.user.id === id)
       → rate limit
       → UsersService.delete(id, proof)
            → AuthService.verifyAccountAction(userId, proof)
            → existing soft-delete
       → 200 + deleted user JSON
       → client logout + redirect (unchanged)
```

---

## Section 2 — UI per client

### Shared `@repo/api-client` changes

- Extend `AuthUser` with `authMethods`
- Change `api.users.delete(id, proof)` to accept `{ password: string } | { idToken: string }`

### Web — marketing-site & business-dashboard

Replace `window.confirm` with a two-step **`DeleteAccountModal`** in `@repo/ui` (built on existing `Modal`):

| Step | Content |
|---|---|
| 1 — Confirm | "Permanently delete your account and all data? This cannot be undone." — **Continue** / Cancel |
| 2 — Verify | Password field (disabled if `!authMethods.password`) + **Verify with Google** button (disabled if `!authMethods.google`) + helper text for disabled options + **Delete account** (danger; enabled once proof is collected) |

**Google on web:** add `@react-oauth/google` `GoogleOAuthProvider` at app root. Web apps need `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (the web OAuth client ID — same value the API accepts in `GOOGLE_CLIENT_ID`). The verify button obtains a fresh `idToken` in-page via Google Identity Services — **no full OAuth redirect** (redirect would issue new Talash session tokens and confuse the flow). The token is passed directly to `DELETE /users/:id`; the API only checks `sub === googleId`.

**Wiring:**

- `sites/marketing-site/src/app/account/_components/ProfileCard.tsx`
- `sites/business-dashboard/src/app/(dashboard)/account/page.tsx`

Read `authMethods` from `useAuth().user` (populated by `/auth/me` bootstrap).

### Mobile — mobile-app & owner-app

Replace the single destructive `Alert.alert` with a two-step flow:

| Step | Content |
|---|---|
| 1 — Confirm | Existing `Alert.alert` (unchanged copy) |
| 2 — Verify | Bottom sheet or modal with password field + Google button |

Reuse `@react-native-google-signin/google-signin` from `AuthScreenNative` to obtain `idToken`. Pass it to `api.users.delete` — do **not** call `api.auth.googleToken` (that issues a new session).

Show inline error on 401 / 403 / 422 from the delete call.

**Wiring:**

- `apps/mobile-app/src/components/screens/AccountScreen.tsx`
- `apps/owner-app/src/components/screens/MoreScreen.tsx`

Consider a shared `DeleteAccountSheet` in `@repo/ui-native` if both apps end up identical.

---

## Section 3 — testing, docs & rollout

### API tests (`workers/api`)

| Area | Cases |
|---|---|
| `AuthService.verifyAccountAction` | Valid password; wrong password (401); valid Google token matching `googleId`; token for different account (403); unavailable method (422); neither/both fields (422) |
| `DELETE /users/:id` route | 401 unauthenticated; 403 wrong user; 422 missing/invalid proof or bad password; 200 valid password; 200 valid idToken |
| Rate limit | 6th attempt within window → 429 |
| `/auth/me` | Returns correct `authMethods` for password-only, Google-only, and linked accounts |

### Client tests

- `@repo/ui`: `DeleteAccountModal` — disabled states, password submit, error display
- marketing-site: update `ProfileCard.test.tsx` if delete is covered
- Mobile: RNTL on verification sheet where feasible; stub Google sign-in

### Documentation updates (same PR)

- `docs/guides/email-password-auth.md` — account deletion verification section
- `docs/guides/api-endpoints.md` — updated `DELETE /users/:id` contract + `/auth/me` fields
- `workers/api/CLAUDE.md` — delete account section
- `sites/marketing-site/AGENTS.md`, `sites/business-dashboard/AGENTS.md`, `apps/mobile-app/AGENTS.md`, `apps/owner-app/AGENTS.md`

### Rollout

Ship API + all four clients together. `DELETE` without a body returns **422** — no backward-compatible period needed.

### Verification before merge

Per repo policy: `bun run lint`, `bun run test`, `bun run build` (or scoped equivalents).
