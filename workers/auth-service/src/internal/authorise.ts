import { TeamRepository } from "@repo/core/src/database/repositories/team.repository";
import { createApp } from "../core/create-app";
import { ForbiddenError, UnauthorizedError } from "../core/errors";
import { authenticate } from "../middleware/auth";

export const internalApp = createApp();

internalApp.use("*", authenticate);

internalApp.post("/authorise", async (c) => {
	const body = (await c.req.json().catch(() => ({}))) as {
		requiredRoles?: string[];
		branchScope?: boolean;
	};

	const user = c.var.user;
	if (!user) throw new UnauthorizedError();

	if (body.requiredRoles?.length && !body.requiredRoles.includes(user.role)) {
		throw new ForbiddenError(
			`This action requires one of the following roles: ${body.requiredRoles.join(", ")}.`,
		);
	}

	let scopedBranchIds: string[] | null = null;
	if (body.branchScope) {
		if (user.role === "owner") {
			scopedBranchIds = null;
		} else {
			const teamRepo = new TeamRepository(c.var.db);
			scopedBranchIds = await teamRepo.findBranchIdsByUser(user.id);
		}
	}

	return c.json({ user, scopedBranchIds }, 200);
});
