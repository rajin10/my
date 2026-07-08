# Mobile offline write queue — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task with spec + code quality review after each task.

**Goal:** Add MMKV mutation outbox to `@repo/mobile-query` and wire owner booking + customer low-risk mutations to queue offline (option A).

**Architecture:** Separate outbox store in MMKV; apps register executor maps; flush on reconnect; optimistic UI unchanged from existing mutations.

**Tech Stack:** Expo 56, TanStack Query v5, MMKV, NetInfo, Vitest.

**Branch:** Continue on `feature/mobile-offline-read-only` (phase 1 uncommitted) or `feature/mobile-offline-write-queue` from same base.

**Spec:** [docs/superpowers/specs/2026-06-12-mobile-offline-write-queue-design.md](../specs/2026-06-12-mobile-offline-write-queue-design.md)

---

### Task 1: Outbox core in `@repo/mobile-query`

**Files:**
- Create: `packages/mobile-query/src/outbox/types.ts`
- Create: `packages/mobile-query/src/outbox/allowlist.ts`
- Create: `packages/mobile-query/src/outbox/storage.ts`
- Create: `packages/mobile-query/src/outbox/flush.ts`
- Create: `packages/mobile-query/src/outbox/use-outbox.ts`
- Create: `packages/mobile-query/src/outbox/use-outbox-sync.ts`
- Create: `packages/mobile-query/src/__tests__/outbox.test.ts`
- Modify: `packages/mobile-query/src/index.ts`
- Modify: `packages/mobile-query/vitest.setup.ts` (if needed)

- [ ] **Step 1:** Define `OutboxEntry`, `OutboxMutationType`, `OutboxExecutorMap`, `FlushResult` in `types.ts`.
- [ ] **Step 2:** Implement `QUEUEABLE_MUTATIONS` allowlist per `MobileAppId` in `allowlist.ts` + `isQueueableMutation(type, appId)`.
- [ ] **Step 3:** MMKV storage: `outboxStorageKey(appId)`, `loadOutbox`, `saveOutbox`, `enqueueOutboxEntry`, `removeOutboxEntry`, `clearOutbox` in `storage.ts`.
- [ ] **Step 4:** `flushOutbox(appId, executors, options?)` — FIFO, max 5 retries, conflict detection via executor returning `{ conflict: true }`, returns `{ processed, failed, paused }`.
- [ ] **Step 5:** `useOutbox(appId)` reactive hook (poll storage on interval or use simple state + manual refresh after enqueue/flush).
- [ ] **Step 6:** `useOutboxSync(appId, executors, enabled)` — NetInfo listener + AppState; call `flushOutbox` when online.
- [ ] **Step 7:** Unit tests for allowlist, enqueue, flush success, conflict drop, retry cap, clearOutbox.
- [ ] **Step 8:** Export from `index.ts`; run `cd packages/mobile-query && bun run test`.

**Acceptance:** All outbox unit tests pass; no app wiring yet.

---

### Task 2: OutboxSyncProvider + PendingSyncBanner

**Files:**
- Create: `packages/mobile-query/src/OutboxSyncProvider.tsx`
- Create: `packages/mobile-query/src/PendingSyncBanner.tsx`
- Modify: `packages/mobile-query/src/index.ts`

- [ ] **Step 1:** `OutboxSyncProvider` accepts `appId`, `executors`, `children`; calls `useOutboxSync`.
- [ ] **Step 2:** `PendingSyncBanner` shows when `pendingCount > 0` (below or integrated with OfflineBanner — show “N actions waiting to sync” in amber when offline with pending outbox).
- [ ] **Step 3:** Export both; unit test allowlist-only logic if UI untestable.

**Acceptance:** Components compile; provider does not crash under test mocks.

---

### Task 3: Owner app — executors + queue booking mutations

**Files:**
- Create: `apps/owner-app/src/lib/outbox-executors.ts`
- Modify: `apps/owner-app/src/app/_layout.tsx` — wrap with `OutboxSyncProvider`, add `PendingSyncBanner`
- Modify: `apps/owner-app/src/context.tsx` — replace `ensureOnline()` block on confirm/decline/cancel/complete/assign with queue path; keep ensureOnline on catalog/team/etc.
- Modify: `apps/owner-app/src/context.tsx` — `signOut` calls `clearOutbox(OWNER_APP_ID)`
- Modify: `apps/owner-app/src/components/screens/TodayScreen.tsx` (or booking card) — pending sync indicator via `useOutbox` + booking id

- [ ] **Step 1:** Define executor map calling existing API methods.
- [ ] **Step 2:** Helper `queueOrMutate({ mutationType, payload, onlineMutate, optimistic })` — if online run mutate; if offline && queueable enqueue + optimistic.
- [ ] **Step 3:** Wire `confirmBooking`, `declineBooking`, `cancelBooking`, `completeBooking`, `assignStaff`, `readAll`, notification read in `tapNotif`.
- [ ] **Step 4:** Pending badge on booking rows (Today + Bookings if shared card component).
- [ ] **Step 5:** Run `cd apps/owner-app && bun run test`.

**Acceptance:** Owner tests pass; offline confirm enqueues instead of toast-block.

---

### Task 4: Customer app — queue favourites, cancel, notifications

**Files:**
- Create: `apps/mobile-app/src/lib/outbox-executors.ts`
- Modify: `apps/mobile-app/src/app/_layout.tsx`
- Modify: `apps/mobile-app/src/context.tsx`
- Modify: `apps/mobile-app/src/hooks/useOrders.ts` — remove offline guard on useCancelOrder OR route cancel through context only (prefer context `cancelBooking` only)

- [ ] **Step 1:** Executor map for customer allowlist.
- [ ] **Step 2:** Queue `toggleSave`, `cancelBooking`, `readNotif`, `readAllNotifs` when offline.
- [ ] **Step 3:** Keep `startBooking`, `confirmBooking`, order hooks blocked offline.
- [ ] **Step 4:** `signOut` clears outbox.
- [ ] **Step 5:** Run `cd apps/mobile-app && bun run test`.

**Acceptance:** Customer tests pass.

---

### Task 5: Documentation

**Files:**
- Modify: `docs/guides/mobile-offline.md`
- Modify: `apps/mobile-app/AGENTS.md`, `apps/owner-app/AGENTS.md`
- Modify: `docs/superpowers/specs/2026-06-12-mobile-offline-read-only-design.md` — link to phase 2 spec

- [ ] **Step 1:** Document outbox, allowlists, flush, sign-out, manual QA for phase 2.
- [ ] **Step 2:** Update app AGENTS.md offline sections.

**Acceptance:** Docs consistent with code.

---

### Task 6: Verification

- [ ] Run `packages/mobile-query`, `apps/mobile-app`, `apps/owner-app` tests.
- [ ] Run scoped biome check on changed paths.
