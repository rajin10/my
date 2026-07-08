import { createRoute, z } from "@hono/zod-openapi";
import { NotificationsRepository } from "@repo/core/src/database/repositories/notifications.repository";
import { createApp } from "../../core/create-app";
import { authenticate } from "../../middleware/auth";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import { NotificationsService } from "./notifications.service";

const NotificationSchema = z.object({
	id: z.string(),
	type: z.enum([
		"booking",
		"cancel",
		"review",
		"system",
		"order",
		"order_cancelled",
	]),
	title: z.string(),
	body: z.string(),
	readAt: z.string().nullable(),
	businessId: z.string().nullable(),
	bookingId: z.string().nullable(),
	reviewId: z.string().nullable(),
	orderId: z.string().nullable(),
	go: z.enum(["bookings", "reviews", "orders"]).nullable(),
	createdAt: z.string(),
});

const listRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["Notifications"],
	summary: "List in-app notifications for the current user",
	security: [{ bearerAuth: [] }],
	request: {
		query: z.object({
			limit: z.coerce.number().int().positive().max(100).default(50).optional(),
		}),
	},
	responses: {
		200: {
			content: { "application/json": { schema: z.array(NotificationSchema) } },
			description: "OK",
		},
	},
});

const markReadRoute = createRoute({
	method: "patch",
	path: "/:id/read",
	tags: ["Notifications"],
	summary: "Mark a notification as read",
	security: [{ bearerAuth: [] }],
	request: { params: z.object({ id: z.string() }) },
	responses: {
		200: {
			content: { "application/json": { schema: NotificationSchema } },
			description: "OK",
		},
		404: {
			content: {
				"application/json": {
					schema: z.object({
						ok: z.literal(false),
						code: z.string(),
						message: z.string(),
					}),
				},
			},
			description: "Not found",
		},
	},
});

const markAllReadRoute = createRoute({
	method: "post",
	path: "/read-all",
	tags: ["Notifications"],
	summary: "Mark all notifications as read",
	security: [{ bearerAuth: [] }],
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ updated: z.number() }) },
			},
			description: "OK",
		},
	},
});

export const notificationsApp = createApp();
notificationsApp.use("*", authenticate);

notificationsApp
	.openapi(listRoute, async (c) => {
		const { limit } = c.req.valid("query");
		const items = await c.var.notificationsService.list(c.var.user.id, limit);
		return c.json(items, 200);
	})
	.openapi(markReadRoute, async (c) => {
		const { id } = c.req.valid("param");
		const item = await c.var.notificationsService.markRead(c.var.user.id, id);
		return c.json(item, 200);
	})
	.openapi(markAllReadRoute, async (c) => {
		const updated = await c.var.notificationsService.markAllRead(c.var.user.id);
		return c.json({ updated }, 200);
	});

export const installNotificationsService: ServiceInstaller = (c, { db }) =>
	c.set(
		"notificationsService",
		new NotificationsService(new NotificationsRepository(db)),
	);
