# Google Auth Guide

All four apps support **Google OAuth** and **email/password** sign-in. See [email-password-auth.md](email-password-auth.md) for register, login, and password reset. This guide covers Google only. Two distinct Google flows are used:

Web apps (business-dashboard, marketing-site) use the **server-side redirect flow**. Mobile apps (mobile-app, owner-app) support two providers switched via `EXPO_PUBLIC_AUTH_PROVIDER`:

| Provider           | `EXPO_PUBLIC_AUTH_PROVIDER` | Works in Expo Go       | Sign-in UX            |
| ------------------ | --------------------------- | ---------------------- | --------------------- |
| Redirect (default) | `redirect` or unset         | ✅ Yes                 | In-app browser        |
| Native SDK         | `native`                    | ❌ No (EAS build only) | Native account picker |

EAS build profiles (`eas.json`) set `EXPO_PUBLIC_AUTH_PROVIDER=native` for all three profiles (dev/preview/production). Expo Go / local dev uses `redirect` by default.

## Architecture

### Server-side redirect flow (web apps + mobile redirect provider)

```
Client
  └── GET /api/v1/auth/google?redirect_uri=<callback>&source=<source>
        └── API stores state → returns { url }
              └── browser/WebBrowser redirects to Google
                    └── Google redirects to callback?code=&state=
                          └── POST /api/v1/auth/google/callback { code, state, redirect_uri }
                                └── API exchanges code → fetch user profile
                                      └── find-or-create user
                                            └── return { accessToken, refreshToken }
```

Both mobile apps use `expo-web-browser`'s `openAuthSessionAsync(url, redirectUri)` to open an in-app browser session. When Google redirects to the app's custom scheme (`ownerapp://` or `mobileapp://`), the browser session closes and returns the URL so the app can parse `code` and `state`.

### Native SDK flow (mobile apps, `EXPO_PUBLIC_AUTH_PROVIDER=native`)

```
Mobile app (@react-native-google-signin/google-signin)
  └── GoogleSignin.configure({ webClientId })
        └── GoogleSignin.signIn() → native account picker
              └── response.data.idToken (or GoogleSignin.getTokens().idToken)
                    └── POST /api/v1/auth/google/token { idToken, source }
                          └── API verifies RS256 signature (Google JWKS)
                                └── find-or-create user
                                      └── return { accessToken, refreshToken, isNewUser }
```

`AuthScreen.tsx` in each mobile app is a thin switcher — it lazy-loads `AuthScreenNative.tsx` or `AuthScreenRedirect.tsx` via conditional `require` so the native module is never evaluated in Expo Go.

### Sign-in source → account role

Both flows carry a **`source`** field that decides which account role the sign-in provisions, so one Google identity can hold a separate `user` and `owner` account. Each client sends its own value explicitly:

| Client                     | `source`         | Role  |
| -------------------------- | ---------------- | ----- |
| `apps/mobile-app`          | `mobile-app`     | user  |
| `sites/marketing-site`     | `marketing-site` | user  |
| `sites/business-dashboard` | `business-app`   | owner |
| `apps/owner-app`           | `business-app`   | owner |

`source` is optional — an absent value defaults to the least-privileged `user` role. In the redirect flow it is captured into KV state at `GET /auth/google` time (not re-sent on the callback). Full rationale, the trust model, and the self-service-roles-only invariant: [ADR 0002](../adr/0002-per-role-accounts-via-sign-in-source.md) and [workers/api/CLAUDE.md](../../workers/api/CLAUDE.md).

## Required Google Cloud Console setup

Talash uses GCP project **`163196138441`**. The production/staging **Web application** client ID is:

`163196138441-dvuciv0t2ddnkr61fck5r9i9v2jq0a64.apps.googleusercontent.com`

(`GOOGLE_CLIENT_ID` in `workers/api/wrangler.jsonc` for `staging` and `production`.)

1. Open [Google Cloud Console](https://console.cloud.google.com/) → project `163196138441`.
2. Enable **Google Identity** (OAuth 2.0 APIs).
3. Configure the **OAuth consent screen** (app name, support email, scopes). For public production sign-in, publish the app to **Production** — Testing mode only allows listed test users.
4. Under **APIs & Services → Credentials**, edit the **Web application** OAuth client above.
5. Add **authorised redirect URIs** (web apps build these dynamically as `{origin}/auth/callback` — every origin users can sign in from must be listed):

| URI                                                                              | App / environment                             |
| -------------------------------------------------------------------------------- | --------------------------------------------- |
| `https://talash.bd/auth/callback`                                                | Marketing site (production)                   |
| `https://www.talash.bd/auth/callback`                                            | Marketing site (production, www)              |
| `https://studio.talash.bd/auth/callback`                                         | Business dashboard (production, legacy)       |
| `https://www.studio.talash.bd/auth/callback`                                     | Business dashboard (production, legacy www)   |
| `https://business.talash.bd/auth/callback`                                       | Business dashboard (production)               |
| `https://www.business.talash.bd/auth/callback`                                   | Business dashboard (production, www)          |
| `https://test.talash.bd/auth/callback`                                           | Marketing site (test)                         |
| `https://test-studio.talash.bd/auth/callback`                                    | Business dashboard (test)                     |
| `https://talash-marketing-site.hasibur.workers.dev/auth/callback`                | Marketing site (Cloudflare Pages preview)     |
| `https://talash-business-dashboard.hasibur.workers.dev/auth/callback`            | Business dashboard (Cloudflare Pages preview) |
| `https://talash-marketing-site-staging.hasibur.workers.dev/auth/callback`        | Marketing site (staging Pages)                |
| `https://talash-business-dashboard-staging.hasibur.workers.dev/auth/callback`    | Business dashboard (staging Pages)            |
| `https://talash-marketing-site-production.hasibur.workers.dev/auth/callback`     | Marketing site (production Pages)             |
| `https://talash-business-dashboard-production.hasibur.workers.dev/auth/callback` | Business dashboard (production Pages)         |
| `mobileapp://auth/callback`                                                      | mobile-app (iOS/Android deep link)            |
| `ownerapp://auth/callback`                                                       | owner-app (iOS/Android deep link)             |
| `http://localhost:3000/auth/callback`                                            | Local dev — business dashboard                |
| `http://localhost:3001/auth/callback`                                            | Local dev — marketing site                    |

6. Add matching **authorised JavaScript origins** for each HTTPS/HTTP web origin (no path — e.g. `https://talash.bd`, not `/auth/callback`):

| Origin                                                             | App / environment                             |
| ------------------------------------------------------------------ | --------------------------------------------- |
| `https://talash.bd`                                                | Marketing site (production)                   |
| `https://www.talash.bd`                                            | Marketing site (production, www)              |
| `https://studio.talash.bd`                                         | Business dashboard (production)               |
| `https://www.studio.talash.bd`                                     | Business dashboard (production, www)          |
| `https://test.talash.bd`                                           | Marketing site (test)                         |
| `https://test-studio.talash.bd`                                    | Business dashboard (test)                     |
| `https://talash-marketing-site.hasibur.workers.dev`                | Marketing site (Cloudflare Pages preview)     |
| `https://talash-business-dashboard.hasibur.workers.dev`            | Business dashboard (Cloudflare Pages preview) |
| `https://talash-marketing-site-staging.hasibur.workers.dev`        | Marketing site (staging Pages)                |
| `https://talash-business-dashboard-staging.hasibur.workers.dev`    | Business dashboard (staging Pages)            |
| `https://talash-marketing-site-production.hasibur.workers.dev`     | Marketing site (production Pages)             |
| `https://talash-business-dashboard-production.hasibur.workers.dev` | Business dashboard (production Pages)         |
| `http://localhost:3000`                                            | Local dev — business dashboard                |
| `http://localhost:3001`                                            | Local dev — marketing site                    |

7. Create additional OAuth 2.0 client IDs as needed:
   - **Android** — for production Android builds (SHA-1 fingerprint in Firebase)
   - **iOS** — for production iOS builds

Changes in the Console can take a few minutes to propagate. If sign-in fails with _"doesn't comply with Google's OAuth 2.0 policy"_ and a `redirect_uri=` in the error, the URI shown is missing from the web client's authorised redirect URIs — add it exactly (scheme, host, path; no trailing slash).

## Environment variables

Full reference: [environment-variables.md](environment-variables.md).

### API worker (`workers/api/.dev.vars` + `wrangler.jsonc`)

| Variable               | Value                                                     |
| ---------------------- | --------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | Web client ID (or comma-separated list of all client IDs) |
| `GOOGLE_CLIENT_SECRET` | Web client secret — required for the redirect flow        |

`GOOGLE_CLIENT_ID` can be a comma-separated list if you want to accept tokens from multiple clients (web, Android, iOS):

```
GOOGLE_CLIENT_ID=web-client-id.apps.googleusercontent.com,android-client-id.apps.googleusercontent.com
```

`GOOGLE_CLIENT_SECRET` must be in `.dev.vars` locally and never committed. It is used by `POST /api/v1/auth/google/callback` to exchange the authorization code.

### Mobile apps (`apps/mobile-app`, `apps/owner-app`)

**Redirect provider** (Expo Go / default): no client ID env var needed — the redirect flow is handled by the API worker. Deep link schemes (`mobileapp://auth/callback`, `ownerapp://auth/callback`) are registered in `app.json`.

**Native provider** (EAS builds): set `googleWebClientId` in `app.json` under `extra`:

```json
"extra": {
  "googleWebClientId": "your-web-client-id.apps.googleusercontent.com"
}
```

This is read at runtime via `Constants.expoConfig.extra.googleWebClientId`. For production, set a real client ID; the placeholder `YOUR_GOOGLE_WEB_CLIENT_ID` will cause `idToken` to be null (the fallback to `getTokens()` handles this, but the token may be rejected by the API if the audience is wrong).

### Web apps (`sites/business-dashboard` and `sites/marketing-site`)

No `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is needed — the client ID is handled entirely by the API worker. The web apps only need `NEXT_PUBLIC_API_URL` to know where to call the API.

## How the ID token is verified (backend)

`AuthService.verifyGoogleIdToken` does:

1. Parses the JWT header/payload (base64url decode)
2. Validates `exp` (not expired), `iss` (`accounts.google.com`), and `aud` (in allowed client IDs)
3. Fetches Google's JWKS from `https://www.googleapis.com/oauth2/v3/certs`
4. Imports the RSA public key via Web Crypto (`crypto.subtle.importKey`)
5. Verifies the RS256 signature (`crypto.subtle.verify`)

No external libraries needed — pure Web Crypto, works on Cloudflare Workers.

## How the redirect flow works (backend)

`AuthService.getGoogleAuthUrl` generates a state nonce, stores it in KV (5 min TTL), and returns a Google authorization URL.

`AuthService.handleGoogleCallback` verifies the state from KV, exchanges the code for an access token via `https://oauth2.googleapis.com/token`, fetches the user profile from `https://www.googleapis.com/oauth2/v3/userinfo`, and calls `findOrCreateUserByGoogle`.

Rate limits (per IP, KV-backed fixed window):

- `GET /auth/google` — 30 req/60 s (OAuth URL / state-nonce generation)
- `POST /auth/refresh` — 30 req/60 s
- `POST /auth/google/token` — 20 req/60 s

`POST /auth/google/callback` is not IP-rate-limited: OAuth state in KV and Google's one-time auth code already protect the exchange; a per-IP cap caused production sign-in failures (429) for users on shared mobile NAT.

Web login pages (`marketing-site`, `business-dashboard`) map API **429** responses to `?error=rate_limited` with user-facing copy via `@repo/api-client` helpers (`authCallbackErrorParam`, `authLoginErrorMessage`).

## User account linking

`AuthRepository.findOrCreateUserByGoogle`:

1. Looks up by `googleId` — existing Google user → return as-is
2. Looks up by `email` — existing OTP user with same email → links the `googleId` to that account
3. Neither found → creates a new user

## Routing after sign-in

All four apps use the redirect flow (`POST /api/v1/auth/google/callback`), which returns `AuthTokens` without `isNewUser`.

- **owner-app**: after `handleAuthed`, calls `api.businesses.list`; no business → `/(setup)/` (onboarding); business exists → `/(tabs)`
- **mobile-app**: routes to a fixed destination (Account tab) after sign-in — no setup flow
- **business-dashboard**: redirects to `/overview`
- **marketing-site**: redirects to the `next` param or `/`

The `POST /api/v1/auth/google/token` (ID token) endpoint still returns `isNewUser: boolean` but is no longer used by any app.

## Adding more auth providers later

Add a new route (e.g. `POST /auth/apple/token`) that:

1. Verifies the provider's token using that provider's public keys
2. Calls a new repository method (e.g. `findOrCreateUserByApple`) following the same pattern
3. Returns `{ ...AuthTokens, isNewUser: boolean }`

The `users` table already has `googleId` — add `appleId`, `facebookId`, etc. as needed.
