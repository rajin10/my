import { createRoute, z } from "@hono/zod-openapi";
import {
	CreateUserBodySchema,
	DeleteUserBodySchema,
	ErrorSchema,
	PaginatedUsersSchema,
	UpdateUserBodySchema,
	UserIdParamSchema,
	UserSchema,
} from "./users.schemas";

const tag = ["Users"];

export const listUsersRoute = createRoute({
	method: "get",
	path: "/",
	tags: tag,
	summary: "List users",
	request: {
		query: z.object({
			page: z.coerce.number().int().positive().default(1).optional(),
			limit: z.coerce.number().int().positive().max(100).default(10).optional(),
			search: z.string().optional(),
			sort: z.string().optional(),
			sortBy: z.enum(["asc", "desc"]).default("desc").optional(),
		}),
	},
	responses: {
		200: {
			content: { "application/json": { schema: PaginatedUsersSchema } },
			description: "OK",
		},
	},
});

export const getUserRoute = createRoute({
	method: "get",
	path: "/:id",
	tags: tag,
	summary: "Get user by ID",
	request: { params: UserIdParamSchema },
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ data: UserSchema }) },
			},
			description: "OK",
		},
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not found",
		},
	},
});

export const createUserRoute = createRoute({
	method: "post",
	path: "/",
	tags: tag,
	summary: "Create user",
	request: {
		body: {
			content: { "application/json": { schema: CreateUserBodySchema } },
			required: true,
		},
	},
	responses: {
		201: {
			content: {
				"application/json": { schema: z.object({ data: UserSchema }) },
			},
			description: "Created",
		},
		422: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Validation error",
		},
	},
});

export const updateUserRoute = createRoute({
	method: "patch",
	path: "/:id",
	tags: tag,
	summary: "Update user",
	request: {
		params: UserIdParamSchema,
		body: {
			content: { "application/json": { schema: UpdateUserBodySchema } },
			required: true,
		},
	},
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ data: UserSchema }) },
			},
			description: "Updated",
		},
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not found",
		},
	},
});

export const deleteUserRoute = createRoute({
	method: "delete",
	path: "/:id",
	tags: tag,
	summary: "Delete user",
	description:
		"Soft-delete the authenticated user's own account. Requires password or Google ID token verification.",
	security: [{ bearerAuth: [] }],
	request: {
		params: UserIdParamSchema,
		body: {
			content: { "application/json": { schema: DeleteUserBodySchema } },
			required: true,
		},
	},
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ data: UserSchema }) },
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
		422: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Verification failed or unavailable verification method",
		},
		429: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Too many attempts",
		},
	},
});

export const restoreUserRoute = createRoute({
	method: "patch",
	path: "/:id/restore",
	tags: tag,
	summary: "Restore soft-deleted user (admin)",
	request: { params: UserIdParamSchema },
	responses: {
		200: {
			content: { "application/json": { schema: UserSchema } },
			description: "Restored",
		},
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not found or not deleted",
		},
	},
});

export const uploadPhotoRoute = createRoute({
	method: "post",
	path: "/:id/photo",
	tags: tag,
	summary: "Upload the authenticated user's profile photo",
	security: [{ bearerAuth: [] }],
	request: { params: UserIdParamSchema },
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
		422: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Invalid image type or size too large",
		},
	},
});
