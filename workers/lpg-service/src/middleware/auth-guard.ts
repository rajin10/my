import { createMiddleware } from "hono/factory";
import { ForbiddenError, UnauthorizedError } from "../core/errors";
import type { AppEnv } from "../types";

/**
 * Unified route authorization middleware.
 *
 * @param roles   Allowed roles — user must have one to proceed.
 * @param options Set `branchScope: true` on business-management routes that managers
 *                and staff should access. Resolves and injects `scopedBranchIds`
 *                into the request context: `null` for owners (unrestricted) or the
 *                array of assigned branch IDs for managers/staff.
 */
export function requireAuth(
	roles: string[],
	options?: { branchScope?: boolean },
) {
	return createMiddleware<AppEnv>(async (c, next) => {
		const user = c.var.user;
		if (!user) throw new UnauthorizedError();
		if (!roles.includes(user.role)) {
			throw new ForbiddenError(
				`This action requires one of the following roles: ${roles.join(", ")}.`,
			);
		}

		if (options?.branchScope) {
			const authHeader = c.req.header("Authorization");
			if (!authHeader) throw new UnauthorizedError();

			const authService = c.env.AUTH_SERVICE;
			if (!authService) throw new UnauthorizedError();

			const res = await authService.fetch("http://internal/authorise", {
				method: "POST",
				headers: {
					Authorization: authHeader,
					"content-type": "application/json",
				},
				body: JSON.stringify({ requiredRoles: roles, branchScope: true }),
			});

			if (res.status === 401) throw new UnauthorizedError();
			if (res.status === 403) {
				const body = (await res.json().catch(() => null)) as {
					message?: string;
				} | null;
				throw new ForbiddenError(body?.message ?? "Forbidden");
			}
			if (!res.ok) {
				throw new ForbiddenError("Forbidden");
			}

			const data = (await res.json()) as { scopedBranchIds: string[] | null };
			c.set("scopedBranchIds", data.scopedBranchIds);
		}

		await next();
	});
}
