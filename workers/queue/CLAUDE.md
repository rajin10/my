# queue — agent guide

Cloudflare Queue consumer worker. Receives job batches from the `talash-queues` queue and dispatches them to handlers.

## Documentation update policy

- Any feature implementation, refactor, behavior change, job contract change, binding change, or workflow change must include documentation updates in the same task/PR.
- Update existing docs first (this file, queue job docs in `@repo/core`, and relevant guides under [../../docs/](../../docs/)).
- Any feature implementation or refactor must run lint, tests, and build before completion (`bun run lint`, `bun run queue:test`, and `bun run build`, or equivalent scoped commands).
- Do not mark work complete until code and documentation are both updated and consistent.

## Stack

Cloudflare Workers runtime. Depends on `@repo/core` for repositories, notifications, and job types. No HTTP server.

## Entry point

`src/index.ts` exports only `queue:` — there is no `fetch` handler.

## Job types

All job payloads are defined in `packages/core/src/queue/jobs.ts` as the `JobPayload` union. Enqueue from `@repo/api` via `QueueProducer.send(payload)`.

All job payloads extend `BaseJob` which adds an optional `requestId?: string` for cross-service log correlation.

| Type                             | Payload fields                        | Handler status                                                          |
| -------------------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| `notification.booking_created`   | `bookingId: string`                   | Implemented — Expo push to customer + business owner                       |
| `notification.booking_cancelled` | `bookingId: string`                   | Implemented — Expo push to customer + business owner                       |
| `notification.review_pending`    | `reviewId: string`                    | Implemented — Expo push to business owner                                  |
| `notification.order_status_changed` | `orderId: string`, `status: OrderStatusType` | Implemented — in-app notification + Expo push to the customer (`order` type for forward transitions, `order_cancelled` for cancellations, `go: "orders"`) |
| `rewards.credit`                 | `userId: string`, `bookingId: string` | Implemented — credits rewards points for a completed booking            |
| `campaign.send`                  | `campaignId: string`                  | Implemented — marks Sent before fan-out (idempotency guard), then pushes to confirmed/completed customers **best-effort per customer**: one customer's push failure is logged and skipped, never aborting the batch or retrying (a retry would hit the Sent guard and silently drop the rest) |

## Error handling

Each message is processed individually. On success, `msg.ack()` is called. On any thrown error, the message is retried via `msg.retry()` and the error is logged. Failed messages re-enter the queue according to the retry policy (max 3 retries) then land in the `talash-dlq` dead-letter queue.

**Push delivery is best-effort and never triggers a retry.** The durable result of a notification job is the recorded in-app notification row; the Expo push is a secondary side-effect. `pushAndCleanup` swallows all push/token-cleanup failures (logged, not rethrown), so a transport failure does not re-run the handler. This matters because notifications have **no dedup key** — a retry would re-insert a duplicate in-app row. Genuine DB failures (e.g. `recordInAppNotification`) still throw and retry as normal. Note: this closes only the push-failure-after-record window; a DB failure *between* two `recordInAppNotification` calls in a multi-recipient handler (e.g. booking customer + owner) can still partially re-record on retry — fully closing that needs a notification dedup key (deferred).

## Push token lifecycle

`sendExpoPush()` returns `{ delivered, deviceNotRegistered }` and swallows Expo HTTP errors (returns `delivered: false`). When Expo responds with `DeviceNotRegistered`, the caller invokes `AuthRepository.clearPushToken(userId)` to remove the stale token so future pushes are not attempted on the same dead endpoint. `pushAndCleanup` wraps the send + token-cleanup in a try/catch so the remaining throw paths (fetch network exception, `res.json()` parse failure, `clearPushToken` write) are logged rather than propagated — see Error handling for why.

## Notification idempotency (dedupe key)

In-app notifications are deduplicated on a deterministic `dedupeKey`, so a queue retry — or a job that re-runs after partially completing a multi-recipient handler — cannot write a duplicate in-app row. `recordInAppNotification` accepts an optional `dedupeKey`; `NotificationsRepository.create` inserts with `ON CONFLICT (dedupe_key) DO NOTHING` against the unique index `notifications_dedupe_key_idx`, then returns the surviving row. Keys are per **event + recipient** so distinct notifications never collide:

| Handler | Key |
| --- | --- |
| order status | `order:<orderId>:<status>:<userId>` (status is forward-only + terminal cancel, so each transition is distinct; only retries dedup) |
| booking created/cancelled | `booking_<event>:<bookingId>:<recipientId>` (customer and owner get distinct rows) |
| review pending | `review_pending:<reviewId>:<ownerId>` |
| coupon expired | `coupon_expired:<businessId>:<ownerId>:<YYYY-MM-DD>` (day-bucketed: a later day is a legitimately new notification; same-day retries dedup) |

Keyless notifications (`dedupeKey` omitted → `null`) always insert — SQLite treats NULLs as distinct in a unique index, so legacy rows and any ad-hoc notification are unaffected. Schema: `notifications.dedupe_key` + unique index, added in migration `0003_ambiguous_beyonder`.

## Repository instance reuse

Repositories are instantiated once at the top of `handleQueue` (per batch) and passed into each handler via the `Repos` interface — not re-created per message. This avoids redundant `getDB()` calls and object allocation inside the hot path.

## Adding a new job type

1. Add the payload type to `packages/core/src/queue/jobs.ts` (`JobPayload` union).
2. Add a `case` to `dispatch()` in `src/handler.ts`.
3. Enqueue from `@repo/api` via `QueueProducer.send({ type: "...", ... })`.

## Bindings

| Binding        | Purpose                                                      |
| -------------- | ------------------------------------------------------------ |
| `TALASH_DB`    | D1 database (read/write for job side-effects)                |

> Note: the `TALASH_EMAIL` binding is no longer used by this worker — the OTP email/SMS jobs were removed when the OTP auth path was retired. The binding can be dropped from `wrangler.jsonc` in a separate infra cleanup.

## Dev

```sh
bun run queue:dev   # from monorepo root
```

Local queue delivery across two separate `wrangler dev` processes is a known Wrangler limitation — messages produced by the API locally may not reach this consumer. Use `wrangler dev --local` with a single multi-worker setup, or test handlers directly.
