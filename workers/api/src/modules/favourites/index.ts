import { createRoute, z } from "@hono/zod-openapi";
import { FavouritesRepository } from "@repo/core/src/database/repositories/favourites.repository";
import { createApp } from "../../core/create-app";
import { authenticate } from "../../middleware/auth";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import { FavouritesService } from "./favourites.service";

const FavouriteSchema = z
	.object({
		id: z.string(),
		userId: z.string(),
		businessId: z.string(),
		createdAt: z.string(),
	})
	.openapi("Favourite");

const BusinessIdParam = z.object({ businessId: z.string() });
const ErrorSchema = z
	.object({ ok: z.literal(false), code: z.string(), message: z.string() })
	.openapi("Error");

const listRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["Favourites"],
	summary: "List my favourite businesses",
	security: [{ bearerAuth: [] }],
	responses: {
		200: {
			content: { "application/json": { schema: z.array(FavouriteSchema) } },
			description: "OK",
		},
	},
});

const addRoute = createRoute({
	method: "post",
	path: "/:businessId",
	tags: ["Favourites"],
	summary: "Add business to favourites",
	security: [{ bearerAuth: [] }],
	request: { params: BusinessIdParam },
	responses: {
		201: {
			content: { "application/json": { schema: FavouriteSchema } },
			description: "Added",
		},
		409: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Already favourited",
		},
	},
});

const removeRoute = createRoute({
	method: "delete",
	path: "/:businessId",
	tags: ["Favourites"],
	summary: "Remove business from favourites",
	security: [{ bearerAuth: [] }],
	request: { params: BusinessIdParam },
	responses: {
		204: { description: "Removed" },
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not found",
		},
	},
});

const checkRoute = createRoute({
	method: "get",
	path: "/:businessId",
	tags: ["Favourites"],
	summary: "Check if business is favourited",
	security: [{ bearerAuth: [] }],
	request: { params: BusinessIdParam },
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ isFavourited: z.boolean() }) },
			},
			description: "OK",
		},
	},
});

export const favouritesApp = createApp();
favouritesApp.use("*", authenticate);
favouritesApp
	.openapi(listRoute, async (c) => {
		const favs = await c.var.favouritesService.list(c.var.user.id);
		return c.json(favs, 200);
	})
	.openapi(checkRoute, async (c) => {
		const { businessId } = c.req.valid("param");
		const result = await c.var.favouritesService.check(
			c.var.user.id,
			businessId,
		);
		return c.json(result, 200);
	})
	.openapi(addRoute, async (c) => {
		const { businessId } = c.req.valid("param");
		const fav = await c.var.favouritesService.add(c.var.user.id, businessId);
		return c.json(fav, 201);
	})
	.openapi(removeRoute, async (c) => {
		const { businessId } = c.req.valid("param");
		await c.var.favouritesService.remove(c.var.user.id, businessId);
		return c.body(null, 204);
	});

export const installFavouritesService: ServiceInstaller = (c, { db }) =>
	c.set(
		"favouritesService",
		new FavouritesService(new FavouritesRepository(db)),
	);
