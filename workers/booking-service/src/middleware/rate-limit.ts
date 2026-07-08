import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { TooManyRequestsError } from "../core/errors";
import { kvIncr } from "../core/kv/cache";
import type { AppEnv } from "../types";

interface RateLimitOptions {
	/** Maximum allowed requests per window. */
	limit: number;
	/** Window duration in seconds. */
	windowSecs: number;
	/** Custom key function. Defaults to `rl:<path>:<cf-ip>`. */
	keyFn?: (c: Context<AppEnv>) => string;
}

/**
 * KV-backed fixed-window rate limiter.
 * Uses CF-Connecting-IP (set by Cloudflare) so the key is always the real client IP.
 * Returns 429 with Retry-After header when the limit is exceeded.
 */
export function rateLimitWhen(
	when: (c: Context<AppEnv>) => boolean,
	options: RateLimitOptions,
) {
	const limiter = rateLimit(options);
	return createMiddleware<AppEnv>(async (c, next) => {
		if (!when(c)) {
			await next();
			return;
		}
		return limiter(c, next);
	});
}

export function rateLimit({ limit, windowSecs, keyFn }: RateLimitOptions) {
	return createMiddleware<AppEnv>(async (c, next) => {
		const ip =
			c.req.header("CF-Connecting-IP") ??
			c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ??
			"unknown";
		const key = keyFn ? keyFn(c) : `rl:${c.req.path}:${ip}`;
		const count = await kvIncr(c.env.TALASH_KV!, key, windowSecs);
		if (count > limit) {
			c.header("Retry-After", String(windowSecs));
			throw new TooManyRequestsError();
		}
		await next();
	});
}
