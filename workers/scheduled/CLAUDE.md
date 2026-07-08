# scheduled — agent guide

Cloudflare cron trigger worker. Runs scheduled maintenance tasks on a cron schedule.

## Documentation update policy

- Any feature implementation, refactor, behavior change, cron/binding change, or workflow change must include documentation updates in the same task/PR.
- Update existing docs first (this file, related worker/core docs, and relevant guides under [../../docs/](../../docs/)).
- Any feature implementation or refactor must run lint, tests, and build before completion (`bun run lint`, `bun run scheduled:test`, and `bun run build`, or equivalent scoped commands).
- Do not mark work complete until code and documentation are both updated and consistent.

## Stack

Cloudflare Workers runtime. Depends on `@repo/core` for repositories. No HTTP server.

## Entry point

`src/index.ts` exports only `scheduled:` — there is no `fetch` handler.

## Current crons

| Expression    | Handler                     | What it does                                                                                 |
| ------------- | --------------------------- | -------------------------------------------------------------------------------------------- |
| `0 0 * * *`   | `expireOldCoupons`          | Expires coupons past their `expiresAt` date; logs owner notification intent per unique business |
| `0 2 * * *`   | `pruneExpiredRefreshTokens` | Deletes refresh tokens past their `expiresAt`                                                |
| `0 4 * * SUN` | `reconcileRewardBalances`   | Finds and corrects drift between `reward_points.balance` and ledger                          |

Dispatch is handled via the `CRON_HANDLERS` map in `src/handler.ts`.

## Adding a new cron

1. Add the cron expression to `wrangler.jsonc` `triggers.crons`.
2. Write a handler `async (_env, scheduledTime) => Promise<void>` in `src/handler.ts`.
3. Register it in the `CRON_HANDLERS` map.
4. If DB access is needed, use `getDB()` from `@repo/core/src/database/client`.

## Bindings

| Binding        | Purpose                              |
| -------------- | ------------------------------------ |
| `TALASH_DB`    | D1 database                          |
| `TALASH_QUEUE` | Queue producer for owner push alerts |

## Dev

```sh
bun run scheduled:dev                                              # from monorepo root
curl "http://localhost:8787/__scheduled?cron=0+0+*+*+*"           # trigger manually
```
