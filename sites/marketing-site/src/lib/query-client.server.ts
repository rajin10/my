import "server-only";
import { cache } from "react";
import { makeQueryClient } from "./query-client";

/**
 * One QueryClient per server request (React `cache()` is request-scoped), shared
 * across `generateMetadata` and the page body so their prefetches dedupe, and
 * isolated between requests so no data leaks across users.
 */
export const getServerQueryClient = cache(() => makeQueryClient());
