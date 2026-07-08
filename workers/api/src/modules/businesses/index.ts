import { createRoute, z } from "@hono/zod-openapi";
import { createApp } from "../../core/create-app";
import { authenticate } from "../../middleware/auth";
import { requireAuth } from "../../middleware/auth-guard";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import {
	createBusinessRoute,
	deleteBusinessRoute,
	getBusinessRoute,
	listBusinessesRoute,
	restoreBusinessRoute,
	updateBusinessRoute,
} from "./businesses.routes";
import { BusinessesService } from "./businesses.service";

const BusinessPhotoSchema = z.object({
	id: z.string(),
	businessId: z.string(),
	url: z.string(),
	order: z.number(),
});

const listPhotosRoute = createRoute({
	method: "get",
	path: "/:id/photos",
	tags: ["Businesses"],
	summary: "List business photos",
	request: { params: z.object({ id: z.string() }) },
	responses: {
		200: {
			content: { "application/json": { schema: z.array(BusinessPhotoSchema) } },
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

const uploadPhotoRoute = createRoute({
	method: "post",
	path: "/:id/photos",
	tags: ["Businesses"],
	summary: "Upload business photo",
	security: [{ bearerAuth: [] }],
	request: { params: z.object({ id: z.string() }) },
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ url: z.string() }) },
			},
			description: "Uploaded",
		},
		400: {
			content: {
				"application/json": {
					schema: z.object({
						ok: z.literal(false),
						code: z.string(),
						message: z.string(),
					}),
				},
			},
			description: "No file",
		},
		403: {
			content: {
				"application/json": {
					schema: z.object({
						ok: z.literal(false),
						code: z.string(),
						message: z.string(),
					}),
				},
			},
			description: "Forbidden",
		},
	},
});

const deletePhotoRoute = createRoute({
	method: "delete",
	path: "/:id/photos/:photoId",
	tags: ["Businesses"],
	summary: "Delete business photo",
	security: [{ bearerAuth: [] }],
	request: { params: z.object({ id: z.string(), photoId: z.string() }) },
	responses: {
		204: { description: "Deleted" },
		403: {
			content: {
				"application/json": {
					schema: z.object({
						ok: z.literal(false),
						code: z.string(),
						message: z.string(),
					}),
				},
			},
			description: "Forbidden",
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

const reorderPhotosRoute = createRoute({
	method: "patch",
	path: "/:id/photos/order",
	tags: ["Businesses"],
	summary: "Reorder business photos",
	security: [{ bearerAuth: [] }],
	request: {
		params: z.object({ id: z.string() }),
		body: {
			content: {
				"application/json": {
					schema: z.object({
						orders: z.array(
							z.object({
								id: z.string(),
								order: z.number().int().nonnegative(),
							}),
						),
					}),
				},
			},
			required: true,
		},
	},
	responses: {
		200: {
			content: { "application/json": { schema: z.array(BusinessPhotoSchema) } },
			description: "Reordered",
		},
		403: {
			content: {
				"application/json": {
					schema: z.object({
						ok: z.literal(false),
						code: z.string(),
						message: z.string(),
					}),
				},
			},
			description: "Forbidden",
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

// Public read routes
const publicApp = createApp()
	.openapi(listBusinessesRoute, async (c) => {
		const query = c.req.valid("query");
		const result = await c.var.businessesService.list(query);
		return c.json(result, 200);
	})
	.openapi(getBusinessRoute, async (c) => {
		const { id } = c.req.valid("param");
		const business = await c.var.businessesService.get(id);
		return c.json({ data: business }, 200);
	})
	.openapi(listPhotosRoute, async (c) => {
		const { id } = c.req.valid("param");
		const photos = await c.var.businessesService.listPhotos(id);
		return c.json(photos, 200);
	});

// Owner-only write routes
const privateApp = createApp();
privateApp.use("*", authenticate, requireAuth(["owner"]));

privateApp
	.openapi(createBusinessRoute, async (c) => {
		const body = c.req.valid("json");
		const business = await c.var.businessesService.create(c.var.user.id, body);
		return c.json({ data: business }, 201);
	})
	.openapi(updateBusinessRoute, async (c) => {
		const { id } = c.req.valid("param");
		const body = c.req.valid("json");
		const business = await c.var.businessesService.update(
			c.var.user.id,
			id,
			body,
		);
		return c.json({ data: business }, 200);
	})
	.openapi(deleteBusinessRoute, async (c) => {
		const { id } = c.req.valid("param");
		const business = await c.var.businessesService.delete(c.var.user.id, id);
		return c.json({ data: business }, 200);
	})
	.openapi(uploadPhotoRoute, async (c) => {
		const { id } = c.req.valid("param");
		const body = await c.req.parseBody();
		const file = body.file;
		if (!(file instanceof File)) {
			return c.json(
				{
					ok: false as const,
					code: "BAD_REQUEST",
					message: "No file uploaded",
				},
				400,
			);
		}
		const result = await c.var.businessesService.uploadPhoto(
			c.var.user.id,
			id,
			file,
		);
		return c.json(result, 200);
	})
	.openapi(deletePhotoRoute, async (c) => {
		const { id, photoId } = c.req.valid("param");
		await c.var.businessesService.deletePhoto(c.var.user.id, id, photoId);
		return new Response(null, { status: 204 });
	})
	.openapi(reorderPhotosRoute, async (c) => {
		const { id } = c.req.valid("param");
		const { orders } = c.req.valid("json");
		await c.var.businessesService.reorderPhotos(c.var.user.id, id, orders);
		const photos = await c.var.businessesService.listPhotos(id);
		return c.json(photos, 200);
	})
	.openapi(restoreBusinessRoute, async (c) => {
		const { id } = c.req.valid("param");
		const business = await c.var.businessesService.restore(c.var.user.id, id);
		return c.json({ data: business }, 200);
	});

export const businessesApp = createApp()
	.route("/", publicApp)
	.route("/", privateApp);

export const installBusinessesService: ServiceInstaller = (
	c,
	{ businessesRepo, storage, kv, authz },
) =>
	c.set(
		"businessesService",
		new BusinessesService(businessesRepo, storage, kv, authz),
	);
