import { createRoute, z } from "@hono/zod-openapi";
import { createApp } from "../../core/create-app";
import { authenticate } from "../../middleware/auth";
import { requireAuth } from "../../middleware/auth-guard";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import { ProductsService } from "./products.service";

const ProductSchema = z
	.object({
		id: z.string(),
		branchId: z.string(),
		name: z.string(),
		category: z.string().nullable(),
		price: z.number(),
		stock: z.number(),
		description: z.string().nullable(),
		imageUrl: z.string().nullable(),
		status: z.enum(["Active", "Inactive"]),
		createdAt: z.string(),
		updatedAt: z.string().nullable(),
	})
	.openapi("Product");

const CreateProductBody = z
	.object({
		name: z.string().min(1),
		category: z.string().optional(),
		price: z.number().int().nonnegative(),
		stock: z.number().int().nonnegative().default(0),
		description: z.string().optional(),
		status: z.enum(["Active", "Inactive"]).optional(),
	})
	.openapi("CreateProductBody");

const UpdateProductBody = CreateProductBody.partial()
	.refine((v) => Object.keys(v).length > 0, {
		message: "At least one field required",
	})
	.openapi("UpdateProductBody");

const IdParam = z.object({ id: z.string() });
const ErrorSchema = z
	.object({ ok: z.literal(false), code: z.string(), message: z.string() })
	.openapi("Error");

const listRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["Products"],
	summary: "List products for a branch",
	request: { query: z.object({ branchId: z.string() }) },
	responses: {
		200: {
			content: { "application/json": { schema: z.array(ProductSchema) } },
			description: "OK",
		},
	},
});

const getRoute = createRoute({
	method: "get",
	path: "/:id",
	tags: ["Products"],
	summary: "Get product",
	request: { params: IdParam },
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ data: ProductSchema }) },
			},
			description: "OK",
		},
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not found",
		},
	},
});

const createRoute_ = createRoute({
	method: "post",
	path: "/",
	tags: ["Products"],
	summary: "Create product",
	security: [{ bearerAuth: [] }],
	request: {
		query: z.object({ branchId: z.string() }),
		body: {
			content: { "application/json": { schema: CreateProductBody } },
			required: true,
		},
	},
	responses: {
		201: {
			content: {
				"application/json": { schema: z.object({ data: ProductSchema }) },
			},
			description: "Created",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
	},
});

const updateRoute = createRoute({
	method: "patch",
	path: "/:id",
	tags: ["Products"],
	summary: "Update product",
	security: [{ bearerAuth: [] }],
	request: {
		params: IdParam,
		body: {
			content: { "application/json": { schema: UpdateProductBody } },
			required: true,
		},
	},
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ data: ProductSchema }) },
			},
			description: "Updated",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not found",
		},
	},
});

const deleteRoute = createRoute({
	method: "delete",
	path: "/:id",
	tags: ["Products"],
	summary: "Delete product",
	security: [{ bearerAuth: [] }],
	request: { params: IdParam },
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ data: ProductSchema }) },
			},
			description: "Deleted",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not found",
		},
	},
});

const uploadPhotoRoute = createRoute({
	method: "post",
	path: "/:id/photo",
	tags: ["Products"],
	summary: "Upload product photo",
	security: [{ bearerAuth: [] }],
	request: { params: IdParam },
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ url: z.string() }) },
			},
			description: "Uploaded",
		},
		400: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "No file",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not found",
		},
	},
});

const deletePhotoRoute = createRoute({
	method: "delete",
	path: "/:id/photo",
	tags: ["Products"],
	summary: "Delete product photo",
	security: [{ bearerAuth: [] }],
	request: { params: IdParam },
	responses: {
		204: { description: "Deleted" },
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not found",
		},
	},
});

const publicApp = createApp()
	.openapi(listRoute, async (c) => {
		const { branchId } = c.req.valid("query");
		const products = await c.var.productsService.listByBranch(branchId);
		return c.json(products, 200);
	})
	.openapi(getRoute, async (c) => {
		const { id } = c.req.valid("param");
		const product = await c.var.productsService.get(id);
		return c.json({ data: product }, 200);
	});

const privateApp = createApp();
privateApp.use(
	"*",
	authenticate,
	requireAuth(["owner", "manager"], { branchScope: true }),
);
privateApp
	.openapi(createRoute_, async (c) => {
		const { branchId } = c.req.valid("query");
		const body = c.req.valid("json");
		const product = await c.var.productsService.create(
			c.var.user.id,
			branchId,
			body,
			c.var.scopedBranchIds,
		);
		return c.json({ data: product }, 201);
	})
	.openapi(updateRoute, async (c) => {
		const { id } = c.req.valid("param");
		const body = c.req.valid("json");
		const product = await c.var.productsService.update(
			c.var.user.id,
			id,
			body,
			c.var.scopedBranchIds,
		);
		return c.json({ data: product }, 200);
	})
	.openapi(deleteRoute, async (c) => {
		const { id } = c.req.valid("param");
		const product = await c.var.productsService.delete(
			c.var.user.id,
			id,
			c.var.scopedBranchIds,
		);
		return c.json({ data: product }, 200);
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
		const result = await c.var.productsService.uploadPhoto(
			c.var.user.id,
			id,
			file,
			c.var.scopedBranchIds,
		);
		return c.json(result, 200);
	})
	.openapi(deletePhotoRoute, async (c) => {
		const { id } = c.req.valid("param");
		await c.var.productsService.deletePhoto(
			c.var.user.id,
			id,
			c.var.scopedBranchIds,
		);
		return new Response(null, { status: 204 });
	});

export const productsApp = createApp()
	.route("/", publicApp)
	.route("/", privateApp);

export const installProductsService: ServiceInstaller = (
	c,
	{ productsRepo, authz, storage },
) =>
	c.set("productsService", new ProductsService(productsRepo, authz, storage));
