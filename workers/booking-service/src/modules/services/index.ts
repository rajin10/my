import { createRoute, z } from "@hono/zod-openapi";
import { createApp } from "../../core/create-app";
import { authenticate } from "../../middleware/auth";
import { requireAuth } from "../../middleware/auth-guard";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import { ServicesService } from "./services.service";

const ServiceSchema = z
	.object({
		id: z.string(),
		branchId: z.string(),
		name: z.string(),
		category: z.string(),
		duration: z.number(),
		price: z.number(),
		description: z.string().nullable(),
		imageUrl: z.string().nullable(),
		createdAt: z.string(),
		updatedAt: z.string().nullable(),
	})
	.openapi("Service");

const CreateServiceBody = z
	.object({
		name: z.string().min(1),
		category: z.string().min(1),
		duration: z.number().int().positive(),
		price: z.number().int().positive(),
		description: z.string().optional(),
	})
	.openapi("CreateServiceBody");

const UpdateServiceBody = CreateServiceBody.partial()
	.refine((v) => Object.keys(v).length > 0, {
		message: "At least one field required",
	})
	.openapi("UpdateServiceBody");

const IdParam = z.object({ id: z.string() });
const ErrorSchema = z
	.object({ ok: z.literal(false), code: z.string(), message: z.string() })
	.openapi("Error");

const listRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["Services"],
	summary: "List services for a branch",
	request: { query: z.object({ branchId: z.string() }) },
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						data: z.array(ServiceSchema),
						query: z.object({
							page: z.number(),
							limit: z.number(),
							total: z.number(),
							totalPages: z.number(),
							hasNextPage: z.boolean(),
							hasPrevPage: z.boolean(),
						}),
					}),
				},
			},
			description: "OK",
		},
	},
});

const getRoute = createRoute({
	method: "get",
	path: "/:id",
	tags: ["Services"],
	summary: "Get service",
	request: { params: IdParam },
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ data: ServiceSchema }) },
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
	tags: ["Services"],
	summary: "Create service",
	security: [{ bearerAuth: [] }],
	request: {
		query: z.object({ branchId: z.string() }),
		body: {
			content: { "application/json": { schema: CreateServiceBody } },
			required: true,
		},
	},
	responses: {
		201: {
			content: {
				"application/json": { schema: z.object({ data: ServiceSchema }) },
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
	tags: ["Services"],
	summary: "Update service",
	security: [{ bearerAuth: [] }],
	request: {
		params: IdParam,
		body: {
			content: { "application/json": { schema: UpdateServiceBody } },
			required: true,
		},
	},
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ data: ServiceSchema }) },
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
	tags: ["Services"],
	summary: "Delete service",
	security: [{ bearerAuth: [] }],
	request: { params: IdParam },
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ data: ServiceSchema }) },
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
	tags: ["Services"],
	summary: "Upload service photo",
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
	tags: ["Services"],
	summary: "Delete service photo",
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
		const svcs = await c.var.servicesService.listByBranch(branchId);
		return c.json(
			{
				data: svcs,
				query: {
					page: 1,
					limit: svcs.length,
					total: svcs.length,
					totalPages: 1,
					hasNextPage: false,
					hasPrevPage: false,
				},
			},
			200,
		);
	})
	.openapi(getRoute, async (c) => {
		const { id } = c.req.valid("param");
		const svc = await c.var.servicesService.get(id);
		return c.json({ data: svc }, 200);
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
		const svc = await c.var.servicesService.create(
			c.var.user.id,
			branchId,
			body,
			c.var.scopedBranchIds,
		);
		return c.json({ data: svc }, 201);
	})
	.openapi(updateRoute, async (c) => {
		const { id } = c.req.valid("param");
		const body = c.req.valid("json");
		const svc = await c.var.servicesService.update(
			c.var.user.id,
			id,
			body,
			c.var.scopedBranchIds,
		);
		return c.json({ data: svc }, 200);
	})
	.openapi(deleteRoute, async (c) => {
		const { id } = c.req.valid("param");
		const svc = await c.var.servicesService.delete(
			c.var.user.id,
			id,
			c.var.scopedBranchIds,
		);
		return c.json({ data: svc }, 200);
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
		const result = await c.var.servicesService.uploadPhoto(
			c.var.user.id,
			id,
			file,
			c.var.scopedBranchIds,
		);
		return c.json(result, 200);
	})
	.openapi(deletePhotoRoute, async (c) => {
		const { id } = c.req.valid("param");
		await c.var.servicesService.deletePhoto(
			c.var.user.id,
			id,
			c.var.scopedBranchIds,
		);
		return new Response(null, { status: 204 });
	});

export const servicesApp = createApp()
	.route("/", publicApp)
	.route("/", privateApp);

export const installServicesService: ServiceInstaller = (
	c,
	{ servicesRepo, authz, storage },
) =>
	c.set("servicesService", new ServicesService(servicesRepo, authz, storage));
