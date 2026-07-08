import { createRoute, z } from "@hono/zod-openapi";
import { createApp } from "../../core/create-app";
import { authenticate } from "../../middleware/auth";
import { requireAuth } from "../../middleware/auth-guard";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import { TeamService } from "./team.service";

const TeamMemberSchema = z
	.object({
		id: z.string(),
		userId: z.string(),
		businessId: z.string(),
		branchId: z.string().nullable(),
		title: z.string(),
		role: z.enum(["Owner", "Manager", "Staff"]),
		createdAt: z.string(),
		updatedAt: z.string().nullable(),
	})
	.openapi("TeamMember");

const AddMemberBody = z
	.object({
		userId: z.string(),
		businessId: z.string(),
		role: z.enum(["Manager", "Staff"]),
		title: z.string().default("Staff"),
		branchId: z.string().optional(),
	})
	.openapi("AddTeamMemberBody");

const UpdateMemberBody = z
	.object({
		role: z.enum(["Manager", "Staff"]).optional(),
		title: z.string().optional(),
		branchId: z.string().nullable().optional(),
	})
	.openapi("UpdateTeamMemberBody");

const BusinessQuery = z.object({ businessId: z.string() });
const IdParam = z.object({ id: z.string() });
const ErrorSchema = z
	.object({ ok: z.literal(false), code: z.string(), message: z.string() })
	.openapi("Error");

const PaginationMetaSchema = z.object({
	page: z.number(),
	limit: z.number(),
	total: z.number(),
	totalPages: z.number(),
	hasNextPage: z.boolean(),
	hasPrevPage: z.boolean(),
});

const listRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["Team"],
	summary: "List team members for a business",
	security: [{ bearerAuth: [] }],
	request: { query: BusinessQuery },
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						data: z.array(TeamMemberSchema),
						query: PaginationMetaSchema,
					}),
				},
			},
			description: "OK",
		},
	},
});

const addRoute = createRoute({
	method: "post",
	path: "/",
	tags: ["Team"],
	summary: "Add team member",
	security: [{ bearerAuth: [] }],
	request: {
		body: {
			content: { "application/json": { schema: AddMemberBody } },
			required: true,
		},
	},
	responses: {
		201: {
			content: {
				"application/json": { schema: z.object({ data: TeamMemberSchema }) },
			},
			description: "Added",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
		409: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Already a member",
		},
	},
});

const updateRoute = createRoute({
	method: "patch",
	path: "/:id",
	tags: ["Team"],
	summary: "Update team member",
	security: [{ bearerAuth: [] }],
	request: {
		params: IdParam,
		body: {
			content: { "application/json": { schema: UpdateMemberBody } },
			required: true,
		},
	},
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ data: TeamMemberSchema }) },
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

const removeRoute = createRoute({
	method: "delete",
	path: "/:id",
	tags: ["Team"],
	summary: "Remove team member",
	security: [{ bearerAuth: [] }],
	request: { params: IdParam },
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ data: TeamMemberSchema }) },
			},
			description: "Removed",
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

export const teamApp = createApp();
teamApp.use("*", authenticate, requireAuth(["owner"]));
teamApp
	.openapi(listRoute, async (c) => {
		const { businessId } = c.req.valid("query");
		const members = await c.var.teamService.listByBusiness(
			c.var.user.id,
			businessId,
		);
		return c.json(
			{
				data: members,
				query: {
					page: 1,
					limit: members.length,
					total: members.length,
					totalPages: 1,
					hasNextPage: false,
					hasPrevPage: false,
				},
			},
			200,
		);
	})
	.openapi(addRoute, async (c) => {
		const { businessId, ...data } = c.req.valid("json");
		const member = await c.var.teamService.add(c.var.user.id, businessId, data);
		return c.json({ data: member }, 201);
	})
	.openapi(updateRoute, async (c) => {
		const { id } = c.req.valid("param");
		const body = c.req.valid("json");
		const member = await c.var.teamService.update(c.var.user.id, id, body);
		return c.json({ data: member }, 200);
	})
	.openapi(removeRoute, async (c) => {
		const { id } = c.req.valid("param");
		const member = await c.var.teamService.remove(c.var.user.id, id);
		return c.json({ data: member }, 200);
	});

export const installTeamService: ServiceInstaller = (c, { teamRepo, authz }) =>
	c.set("teamService", new TeamService(teamRepo, authz));
