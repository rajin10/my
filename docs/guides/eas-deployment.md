# EAS Deployment — Google Play (Android)

Both Expo apps (`apps/mobile-app`, `apps/owner-app`) use [EAS Build](https://docs.expo.dev/build/introduction/) for Android APK/AAB builds and [EAS Submit](https://docs.expo.dev/submit/introduction/) for Google Play uploads.

| App      | Slug              | Android package      | EAS project                 |
| -------- | ----------------- | -------------------- | --------------------------- |
| Customer | `talash-customer` | `talash.bd`          | `hasib_dev/talash-customer` |
| Owner    | `talash-owner`    | `business.talash.bd` | `hasib_dev/talash-owner`    |

## Prerequisites

1. **EAS CLI** — `bun add -g eas-cli` (or `npm install -g eas-cli`)
2. **Expo account** — `eas login`; `owner` in each `app.json` is `hasib_dev`
3. **Google Play Console** — one app listing per package name above
4. **Firebase `google-services.json`** — one per Android package (FCM + Google Sign-In)
5. **Play service account** — JSON key with **Release manager** for `eas submit`

---

## Build profiles

Configured in each app's `eas.json`:

| Profile       | Output                 | API                           | Distribution        | Play track (submit)  |
| ------------- | ---------------------- | ----------------------------- | ------------------- | -------------------- |
| `development` | Debug APK + dev client | Staging (`api.talash.com.bd`) | Internal (EAS link) | —                    |
| `preview`     | Release APK            | Staging                       | Internal            | `internal` (draft)   |
| `production`  | AAB (Play Store)       | Production (`api.talash.bd`)  | Store               | `production` (draft) |

All EAS profiles set `EXPO_PUBLIC_AUTH_PROVIDER=native` (required for `@react-native-google-signin` in standalone builds). Expo Go local dev keeps `redirect` via `.env` / default.

`android.googleServicesFile` in each `app.json` points at `./google-services.json` (Firebase). Dev and preview inherit it; production inherits it for local builds. `app.config.js` disables cleartext HTTP for preview and production (`usesCleartextTraffic` is `true` only for the `development` profile).

`appVersionSource: remote` + `android.autoIncrement: true` on production lets EAS manage `versionCode` on each Play-bound build — do not set `versionCode` in `app.json`.

### Production profile

| Setting | Value |
| ------- | ----- |
| `distribution` | `store` (Play Store AAB) |
| `EXPO_PUBLIC_API_URL` | `https://api.talash.bd` |
| `android.buildType` | `app-bundle` |
| `android.autoIncrement` | `true` (remote `versionCode`) |
| `channel` | `production` (EAS Update) |
| Cleartext HTTP | off (`app.config.js`) |
| Firebase config | `./google-services.json` via `app.json` (local/`--local` builds) |
| Play submit key | `./google-play-service-account.json` via `submit.production` |

**EAS cloud builds (from git, no local file):** upload Firebase config as a project secret, then set `"googleServicesFile": "$GOOGLE_SERVICES_JSON"` on the `production` profile’s `android` block (see §2 below). Local production builds (`eas build --local --profile production`) keep using the on-disk `./google-services.json` included via `.easignore`.

---

## Commands

### From monorepo root

```sh
# Customer app
bun run mobile-app:build:dev       # development APK
bun run mobile-app:build:preview   # preview APK (staging API)
bun run mobile-app:build:prod      # production AAB
bun run mobile-app:submit:preview  # submit latest build → Play internal track
bun run mobile-app:submit          # submit latest build → Play production track
bun run mobile-app:update          # OTA to production channel

# Owner app
bun run owner-app:build:dev
bun run owner-app:build:preview
bun run owner-app:build:prod
bun run owner-app:submit:preview
bun run owner-app:submit
bun run owner-app:update
```

### From an app directory

```sh
cd apps/mobile-app   # or apps/owner-app

bun run build:dev
bun run build:preview
bun run build:prod
bun run submit:preview    # internal track
bun run submit:prod       # production track
bun run build-and-submit  # production build + auto-submit
bun run update            # OTA (--channel production)
bun run update:preview    # OTA (--channel preview)
```

Track builds at [expo.dev/accounts/hasib_dev/builds](https://expo.dev/accounts/hasib_dev/builds).

---

## First-time setup (once per app)

### 1. EAS project

Already initialised — `extra.eas.projectId` and `updates.url` are set in both `app.json` files. Re-run only if you recreate a project:

```sh
cd apps/mobile-app && eas init
cd apps/owner-app && eas init
```

### 2. Firebase `google-services.json`

Download from [Firebase Console](https://console.firebase.google.com) → project linked to GCP `163196138441` → add Android apps and download `google-services.json`:

- `talash.bd` → `apps/mobile-app/google-services.json` (see `google-services.json.example`)
- `business.talash.bd` → `apps/owner-app/google-services.json` (see `google-services.json.example`)

Referenced by `android.googleServicesFile` in each `app.json`. After the first EAS Android build, run `eas credentials` → copy the keystore **SHA-1** → add it in Firebase → Android app settings (required for native Google Sign-In).

Files are gitignored. Each app’s `.easignore` includes `!google-services.json` so local and cloud EAS builds can read the file from disk. For CI-only setups, upload as an EAS file secret:

```sh
cd apps/mobile-app
eas secret:create --scope project --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json
```

Then add to the relevant `eas.json` build profile:

```json
"android": { "googleServicesFile": "$GOOGLE_SERVICES_JSON" }
```

### 3. Play Store service account

1. Play Console → **Setup** → **API access** → link GCP project
2. Create a service account with **Release manager**
3. Download the JSON key → `apps/<app>/google-play-service-account.json` (gitignored; see `google-play-service-account.json.example`)

`eas.json` `submit.*.android.serviceAccountKeyPath` points at this file — **not** `google-services.json`.

### 4. Signing keystore

EAS manages Android keystores by default (no `credentialsSource: "local"`). On first production build:

```sh
cd apps/mobile-app
eas build -p android --profile production
# Choose "Generate new keystore" when prompted
```

Inspect credentials later: `eas credentials -p android`

### 5. Google Play Console apps

Create listings for `talash.bd` and `business.talash.bd`. Complete store listing, content rating, and privacy policy before promoting beyond internal testing.

### 6. OAuth redirect URIs

In Google Cloud Console → OAuth web client, ensure authorised redirect URIs include:

- `mobileapp://auth/callback`
- `ownerapp://auth/callback`

---

## Submitting to Google Play

Submissions use `releaseStatus: "draft"` — review and roll out manually in Play Console.

```sh
# Preview build → internal testing
bun run mobile-app:build:preview
bun run mobile-app:submit:preview

# Production AAB → production track (draft)
bun run mobile-app:build:prod
bun run mobile-app:submit
```

Change `track` in `eas.json` (`internal` | `alpha` | `beta` | `production`) per rollout stage.

---

## OTA updates (EAS Update)

`runtimeVersion.policy: "appVersion"` limits OTA compatibility to the same `version` string in `app.json`.

```sh
bun run mobile-app:update -- "fix: booking slot copy"
bun run owner-app:update:preview -- "preview: khata label"
```

Channels match build profiles: `development`, `preview`, `production`.

---

## Monorepo notes

- Root uses **bun workspaces**; `eas.json` `base` profile pins `bun: "1.3.1"` and `node: "24.11.0"`.
- Run EAS commands from the app directory (or via root `bun run mobile-app:*` / `owner-app:*` filters).
- Shared packages (`@repo/api-client`, `@repo/ui-native`, …) resolve via the workspace install EAS performs at the monorepo root.
- **CI / local `build` script:** each app's `package.json` `build` runs `expo export --platform android` (bundles the native JS graph without EAS credentials). Play Store builds still use `build:prod` / `eas build`. Firebase config lives in `app.json` `android.googleServicesFile`; for EAS cloud builds from git, upload `GOOGLE_SERVICES_JSON` as a project secret (see §2).

---

## CI/CD

EAS builds are **manual** today. To automate later, add a GitHub Actions workflow with an `EXPO_TOKEN` secret calling `eas build` / `eas submit`. See [ci-cd.md](ci-cd.md).

---

## Checklist before first Play submission

- [ ] Valid `google-services.json` per app (from Firebase, not a Play service-account key)
- [ ] EAS keystore SHA-1 added to Firebase Android app
- [ ] `google-play-service-account.json` in each app directory for `eas submit` (or EAS secret)
- [ ] Play Console listings created for both package names
- [ ] `eas build -p android --profile production` succeeds for both apps
- [ ] `eas submit --profile preview` uploads to internal testing
- [ ] Google Sign-In works on a physical device build (`EXPO_PUBLIC_AUTH_PROVIDER=native`)
- [ ] Store listing, privacy policy, and content rating complete

---

## Related

- [environment-variables.md](environment-variables.md) — mobile env vars
- [google-auth.md](google-auth.md) — OAuth flow
- [mobile-offline.md](mobile-offline.md) — offline behaviour in release builds
