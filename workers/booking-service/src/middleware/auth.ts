import { createMiddleware } from "hono/factory";
import { UnauthorizedError } from "../core/errors";
import { SessionTokens } from "../modules/auth/session-tokens";
import type { AppEnv } from "../types";

export const authenticate = createMiddleware<AppEnv>(async (c, next) => {
	const authHeader = c.req.header("Authorization");
	const token = authHeader?.startsWith("Bearer ")
		? authHeader.slice(7)
		: undefined;

	if (!token) {
		throw new UnauthorizedError("Missing Bearer token.");
	}

	// SessionTokens.verify maps the (internal) JWT payload to AuthUser and throws
	// UnauthorizedError("Invalid or expired token.") on any verification failure.
	const user = await SessionTokens.verify(token, c.env.JWT_SECRET);

	c.set("user", user);
	await next();
});
