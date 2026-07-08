import { createMiddleware } from "hono/factory";
import { SessionTokens } from "../modules/auth/session-tokens";
import type { AppEnv } from "../types";

/** Sets `c.var.user` when a valid Bearer token is present; otherwise continues without user. */
export const optionalAuth = createMiddleware<AppEnv>(async (c, next) => {
	const authHeader = c.req.header("Authorization");
	const token = authHeader?.startsWith("Bearer ")
		? authHeader.slice(7)
		: undefined;

	if (token) {
		try {
			const user = await SessionTokens.verify(token, c.env.JWT_SECRET);
			c.set("user", user);
		} catch {
			// Invalid or expired token — treat as anonymous walk-in customer.
		}
	}

	await next();
});
