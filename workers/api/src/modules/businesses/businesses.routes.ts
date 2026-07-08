import { createRoute, z } from "@hono/zod-openapi";
import {
	BusinessIdParamSchema,
	BusinessSchema,
	CreateBusinessBodySchema,
	ErrorSchema,
	PaginatedBusinessesSchema,
	UpdateBusinessBodySchema,
} from "./businesses.schemas";

const tag = ["Businesses"];

export const listBusinessesRoute = createRoute({
	method: "get",
	path: "/",
	tags: tag,
	summary: "List businesses",
	request: {
		query: z.object({
			page: z.coerce.number().int().positive().default(1).optional(),
			limit: z.coerce.number().int().positive().max(100).default(10).optional(),
			search: z.string().optional(),
			sort: z.string().optional(),
			sortBy: z.enum(["asc", "desc"]).default("desc").optional(),
			cursor: z.string().optional(),
		}),
	},
	responses: {
		200: {
			content: { "application/json": { schema: PaginatedBusinessesSchema } },
			description: "OK",
		},
	},
});

export const getBusinessRoute = createRoute({
	method: "get",
	path: "/:id",
	tags: tag,
	summary: "Get business by ID",
	request: { params: BusinessIdParamSchema },
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ data: BusinessSchema }) },
			},
			description: "OK",
		},
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not found",
		},
	},
});

export const createBusinessRoute = createRoute({
	method: "post",
	path: "/",
	tags: tag,
	summary: "Create business",
	security: [{ bearerAuth: [] }],
	request: {
		body: {
			content: { "application/json": { schema: CreateBusinessBodySchema } },
			required: true,
		},
	},
	responses: {
		201: {
			content: {
				"application/json": { schema: z.object({ data: BusinessSchema }) },
			},
			description: "Created",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
	},
});

export const updateBusinessRoute = createRoute({
	method: "patch",
	path: "/:id",
	tags: tag,
	summary: "Update business",
	security: [{ bearerAuth: [] }],
	request: {
		params: BusinessIdParamSchema,
		body: {
			content: { "application/json": { schema: UpdateBusinessBodySchema } },
			required: true,
		},
	},
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ data: BusinessSchema }) },
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

export const deleteBusinessRoute = createRoute({
	method: "delete",
	path: "/:id",
	tags: tag,
	summary: "Delete business (soft)",
	security: [{ bearerAuth: [] }],
	request: { params: BusinessIdParamSchema },
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ data: BusinessSchema }) },
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

export const restoreBusinessRoute = createRoute({
	method: "patch",
	path: "/:id/restore",
	tags: tag,
	summary: "Restore soft-deleted business (owner)",
	security: [{ bearerAuth: [] }],
	request: { params: BusinessIdParamSchema },
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ data: BusinessSchema }) },
			},
			description: "Restored",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not found or not deleted",
		},
	},
});
