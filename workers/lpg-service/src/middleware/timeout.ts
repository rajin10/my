import { createMiddleware } from "hono/factory";
import { GatewayTimeoutError } from "../core/errors";
import type { AppEnv } from "../types";

/**
 * Middleware that races the downstream handler against a deadline.
 * Throws GatewayTimeoutError (504) if the handler does not settle within `ms`.
 * Default: 15 000 ms — well inside Cloudflare's 30 s CPU limit.
 */
export function requestTimeout(ms = 15_000) {
	return createMiddleware<AppEnv>(async (_c, next) => {
		let timerId: ReturnType<typeof setTimeout> | undefined;

		const timeoutPromise = new Promise<never>((_, reject) => {
			timerId = setTimeout(() => reject(new GatewayTimeoutError()), ms);
		});

		try {
			await Promise.race([next(), timeoutPromise]);
		} finally {
			clearTimeout(timerId);
		}
	});
}
