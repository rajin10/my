# Mobile offline

Offline resilience for `apps/mobile-app` and `apps/owner-app`.

## Overview

Both Expo apps persist TanStack Query cache to device storage (MMKV) so users can view previously fetched data when offline or after restart. **Phase 1** blocks all writes offline. **Phase 2** queues selected mutations in an MMKV outbox and syncs when back online.

| Phase | Spec |
| --- | --- |
| Read-only cache | [2026-06-12-mobile-offline-read-only-design.md](../superpowers/specs/2026-06-12-mobile-offline-read-only-design.md) |
| Write queue | [2026-06-12-mobile-offline-write-queue-design.md](../superpowers/specs/2026-06-12-mobile-offline-write-queue-design.md) |
| Walk-in QR + LAN | [2026-06-12-walk-in-qr-lan-sync-design.md](../superpowers/specs/2026-06-12-walk-in-qr-lan-sync-design.md) |

## Walk-in (B1 online / B2 LAN)

**B1 (shipped):** QR scan → fast booking/order via `POST /api/v1/walk-in/submit`. Guest name + phone or signed-in customer. Owner displays branch/session QR in owner-app **Walk-in** screen.

**B2 (shipped):** `@repo/walk-in-sync` — owner LAN hub (Bonjour + local HTTP), customer LAN fallback when Wi‑Fi works but mobile data does not, MMKV walk-in queue flushed by owner on reconnect.

| App | LAN wiring |
| --- | --- |
| `owner-app` | Walk-in screen → **Walk-in mode** toggle starts hub; Today shows **Walk-ins (live)**; queue flushes via `POST /api/v1/walk-in/sync` |
| `mobile-app` | Walk-in flow uses hub when `isInternetReachable === false`; amber banner on walk-in routes |

**Requires EAS dev/production builds** — LAN modules do not run in Expo Go.

### Package: `@repo/walk-in-sync`

| Export | Purpose |
| --- | --- |
| `startWalkInHub` / `discoverHub` | Owner HTTP server + Bonjour publish; customer discovery |
| `fetchHubContext` / `submitToHub` | LAN HTTP client |
| `enqueueWalkInSubmission` / `flushWalkInQueue` | MMKV queue (`talash-walk-in-${appId}`) |
| `useLanFallbackEligible` | Wi‑Fi connected, internet unreachable |
| `WalkInLanBanner` | Amber/red connectivity banner |

Owner `signOut()`: also call `clearWalkInQueue('owner-app')`. Customer: `clearWalkInQueue('mobile-app')`.

| App | Entry |
| --- | --- |
| `mobile-app` | Account → Scan shop QR; deep link `mobileapp://walk-in?branchId=` |
| `owner-app` | Today → Walk-in |
| Marketing | `https://talash.app/w/{branchId}` universal link |

## Shared package: `@repo/mobile-query`

### Query cache (phase 1)

| Export | Purpose |
| --- | --- |
| `createMobileQueryClient()` | `offlineFirst` defaults, infinite `gcTime`, NetInfo-backed retry |
| `MobilePersistQueryClientProvider` | Wrap app root; rehydrates MMKV cache on launch |
| `clearPersistedCache(appId)` | Call on sign-out (after `queryClient.clear()`) |
| `useNetworkStatus()` | NetInfo wrapper |
| `useOfflineAction()` / `useOnlineGuard()` | Gate blocked mutations offline |
| `OfflineBanner` | Amber when showing saved data; red when no cache |
| `StaleDataNote` | Optional “Saved · last updated …” on detail screens |

### Mutation outbox (phase 2)

| Export | Purpose |
| --- | --- |
| `enqueueOutboxEntry` / `loadOutbox` / `clearOutbox` | MMKV outbox storage (`talash-outbox-${appId}`) |
| `flushOutbox(appId, executors)` | FIFO sync; max 5 retries; pauses on 401 |
| `isQueueableMutation(type, appId)` | Per-app allowlist check |
| `queueOrRunSync` / `useQueueOrRun` | Online → mutate; offline → enqueue if allowed |
| `useOutbox(appId)` | Pending/failed counts; `hasPendingForBooking(id)` |
| `OutboxSyncProvider` | Auto-flush on reconnect / foreground |
| `PendingSyncBanner` | “N actions waiting to sync” when offline with pending outbox |

App IDs: `mobile-app`, `owner-app` — separate MMKV namespaces per app.

## Queue allowlists (phase 2)

**Owner:** `bookings.confirm`, `bookings.cancel`, `bookings.complete`, `bookings.assign`, `notifications.markRead`, `notifications.markAllRead`

**Customer:** `favourites.add`, `favourites.remove`, `bookings.cancel`, `notifications.markRead`, `notifications.markAllRead`

All other writes remain blocked offline (new booking/order, catalog, khata, photos, etc.).

## App wiring

1. Root layout: `MobilePersistQueryClientProvider`, `OfflineBanner`, `PendingSyncBanner`
2. Context: `OutboxSyncProvider` with app-specific executors (`lib/outbox-executors.ts`)
3. Queueable handlers: `queueOrRunSync` — optimistic update + enqueue when offline
4. `signOut()`: `queryClient.clear()` → `clearPersistedCache(appId)` → `clearOutbox(appId)`
5. Owner booking rows: amber “Pending sync” via `useOutbox` + booking id

## Query allowlist

Only successful queries matching configured key prefixes are persisted. Volatile keys (`branch-availability`, `users/search`) are excluded. See `packages/mobile-query/src/allowlist.ts`.

## Manual QA

**Phase 1**

1. Load a screen online → aeroplane mode → data still visible
2. Kill app → reopen offline → data still visible
3. Tap a blocked write offline → toast, no API call
4. Sign out → reopen → no previous user’s cached data

**Phase 2**

1. Owner: confirm a pending booking offline → optimistic UI + “Pending sync” badge → online → syncs
2. Customer: toggle favourite offline → syncs on reconnect
3. Conflict: change booking on server while queued → toast “This booking was already updated.”
4. Sign out clears outbox (no stale queued actions for next user)

## Out of scope (phase 3)

Owner catalog CRUD queue, customer new booking/order queue, photo upload queue, SQLite entity store.
