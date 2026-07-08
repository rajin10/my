import { z } from "@hono/zod-openapi";
import { UserRole } from "@repo/core/src/database/schema";

export const UserRoleEnum = z.enum([
	UserRole.MANAGER,
	UserRole.MODERATOR,
	UserRole.OWNER,
	UserRole.STAFF,
	UserRole.USER,
]);

export const UserSchema = z
	.object({
		id: z.string(),
		email: z.string().nullable(),
		phone: z.string().nullable(),
		name: z.string(),
		role: UserRoleEnum,
		googleId: z.string().nullable(),
		photoUrl: z.string().nullable(),
		createdAt: z.string(),
		updatedAt: z.string().nullable(),
	})
	.openapi("User");

export const CreateUserBodySchema = z
	.object({
		name: z.string().min(1),
		role: UserRoleEnum,
		email: z.string().email().optional(),
		phone: z.string().optional(),
		googleId: z.string().optional(),
	})
	.openapi("CreateUserBody");

export const UpdateUserBodySchema = z
	.object({
		name: z.string().min(1).optional(),
		email: z.string().email().optional(),
		phone: z.string().optional(),
	})
	.refine((v) => Object.keys(v).length > 0, {
		message: "At least one field must be provided",
	})
	.openapi("UpdateUserBody");

export const UserIdParamSchema = z.object({ id: z.string() });

export const DeleteUserBodySchema = z
	.object({
		password: z.string().min(1).optional(),
		idToken: z.string().min(1).optional(),
	})
	.refine(
		(data) =>
			Boolean(data.password) !== Boolean(data.idToken) &&
			Boolean(data.password || data.idToken),
		{ message: "Provide exactly one of password or idToken" },
	)
	.openapi("DeleteUserBody");

export const PaginatedUsersSchema = z
	.object({
		data: z.array(UserSchema),
		query: z.object({
			page: z.number(),
			limit: z.number(),
			total: z.number(),
			totalPages: z.number(),
			hasNextPage: z.boolean(),
			hasPrevPage: z.boolean(),
		}),
	})
	.openapi("PaginatedUsers");

export const ErrorSchema = z
	.object({
		ok: z.literal(false),
		code: z.string(),
		message: z.string(),
	})
	.openapi("Error");
