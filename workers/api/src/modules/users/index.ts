import { UsersRepository } from "@repo/core/src/database/repositories/users.repository";
import { createApp } from "../../core/create-app";
import { ForbiddenError } from "../../core/errors";
import { authenticate } from "../../middleware/auth";
import { requireAuth } from "../../middleware/auth-guard";
import { rateLimitWhen } from "../../middleware/rate-limit";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import {
	createUserRoute,
	deleteUserRoute,
	getUserRoute,
	listUsersRoute,
	restoreUserRoute,
	updateUserRoute,
	uploadPhotoRoute,
} from "./users.routes";
import { UsersService } from "./users.service";

// Self-only: any authenticated user, identity check enforced per-handler.
const selfApp = createApp();
selfApp.use("*", authenticate);
selfApp.use(
	"/:id",
	rateLimitWhen((c) => c.req.method === "DELETE", {
		limit: 5,
		windowSecs: 900,
		keyFn: (c) => `rl:delete-account:${c.var.user.id}`,
	}),
);
selfApp
	.openapi(getUserRoute, async (c) => {
		const { id } = c.req.valid("param");
		if (c.var.user.id !== id)
			throw new ForbiddenError("You can only view your own account");
		const user = await c.var.usersService.get(id);
		return c.json({ data: user }, 200);
	})
	.openapi(updateUserRoute, async (c) => {
		const { id } = c.req.valid("param");
		if (c.var.user.id !== id)
			throw new ForbiddenError("You can only update your own account");
		const body = c.req.valid("json");
		const user = await c.var.usersService.update(id, body);
		return c.json({ data: user }, 200);
	})
	.openapi(deleteUserRoute, async (c) => {
		const { id } = c.req.valid("param");
		if (c.var.user.id !== id)
			throw new ForbiddenError("You can only delete your own account");
		const proof = c.req.valid("json");
		const user = await c.var.usersService.delete(id, proof);
		return c.json({ data: user }, 200);
	})
	.openapi(uploadPhotoRoute, async (c) => {
		const { id } = c.req.valid("param");
		if (c.var.user.id !== id)
			throw new ForbiddenError("You can only update your own account");
		const body = await c.req.parseBody();
		const file = body.file;
		if (!(file instanceof File))
			return c.json(
				{
					ok: false as const,
					code: "BAD_REQUEST",
					message: "No file uploaded",
				},
				400,
			);
		const result = await c.var.usersService.uploadPhoto(id, file);
		return c.json(result, 200);
	});

// Owner/moderator: user enumeration restricted to privileged roles.
const ownerApp = createApp();
ownerApp.use("*", authenticate, requireAuth(["owner", "moderator"]));
ownerApp.openapi(listUsersRoute, async (c) => {
	const query = c.req.valid("query");
	const result = await c.var.usersService.list(query);
	return c.json(result, 200);
});

// Moderator-only: account creation and restore are administrative operations.
const moderatorApp = createApp();
moderatorApp.use("*", authenticate, requireAuth(["moderator"]));
moderatorApp
	.openapi(createUserRoute, async (c) => {
		const body = c.req.valid("json");
		const user = await c.var.usersService.create(body);
		return c.json({ data: user }, 201);
	})
	.openapi(restoreUserRoute, async (c) => {
		const { id } = c.req.valid("param");
		const user = await c.var.usersService.restore(id);
		return c.json(user, 200);
	});

export const usersApp = createApp()
	.route("/", selfApp)
	.route("/", ownerApp)
	.route("/", moderatorApp);

export const installUsersService: ServiceInstaller = (c, { db, storage }) =>
	c.set(
		"usersService",
		new UsersService(new UsersRepository(db), storage, c.var.authService),
	);
