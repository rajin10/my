import { createMiddleware } from "hono/factory";
import { ForbiddenError, UnauthorizedError } from "../core/errors";
import type { AppEnv } from "../types";

/**
 * Unified route authorization middleware.
 *
 * Note: auth-service will own branch scoping later; for now this middleware
 * supports role-gating only (branchScope is ignored).
 */
export function requireAuth(roles: string[]) {
	return createMiddleware<AppEnv>(async (c, next) => {
		const user = c.var.user;
		if (!user) throw new UnauthorizedError();
		if (!roles.includes(user.role)) {
			throw new ForbiddenError(
				`This action requires one of the following roles: ${roles.join(", ")}.`,
			);
		}
		await next();
	});
}
