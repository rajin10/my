import "server-only";
import { createApi } from "@repo/api-client";
import { vars } from "./vars";

/**
 * Token-less API caller for server components / prefetch. No browser token
 * store, no `onUnauthorized` window redirect — public reads only. Public
 * endpoints never 401, so refresh/onUnauthorized never fire here. Kept out of
 * client bundles by `server-only`.
 *
 * `next: { revalidate: 300 }` opts every server read into Next's Data Cache.
 * **Inert today:** no OpenNext incremental-cache override is wired (see
 * `open-next.config.ts`), so on Cloudflare Workers there is nowhere to persist
 * the cache across requests — it currently only dedupes within a single render.
 * Wiring `r2IncrementalCache` (+ an R2 binding + bucket) makes it effective ISR.
 */
export const serverApi = createApi({
	baseUrl: vars.API_URL,
	next: { revalidate: 300 },
});
