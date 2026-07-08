import { createRoute, z } from "@hono/zod-openapi";
import { createApp } from "../../core/create-app";
import { authenticate } from "../../middleware/auth";
import { requireAuth } from "../../middleware/auth-guard";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import { BranchesService } from "./branches.service";

const BranchSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		businessId: z.string(),
		address: z.string(),
		city: z.string(),
		createdAt: z.string(),
		updatedAt: z.string().nullable(),
	})
	.openapi("Branch");

const CreateBranchBody = z
	.object({
		name: z.string().min(1),
		address: z.string().min(1),
		city: z.string().min(1),
	})
	.openapi("CreateBranchBody");

const UpdateBranchBody = CreateBranchBody.partial()
	.refine((v) => Object.keys(v).length > 0, {
		message: "At least one field required",
	})
	.openapi("UpdateBranchBody");

const IdParam = z.object({ id: z.string() });
const ErrorSchema = z
	.object({ ok: z.literal(false), code: z.string(), message: z.string() })
	.openapi("Error");

const listRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["Branches"],
	summary: "List branches for a business",
	request: { query: z.object({ businessId: z.string() }) },
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						data: z.array(BranchSchema),
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
	tags: ["Branches"],
	summary: "Get branch",
	request: { params: IdParam },
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ data: BranchSchema }) },
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
	tags: ["Branches"],
	summary: "Create branch",
	security: [{ bearerAuth: [] }],
	request: {
		query: z.object({ businessId: z.string() }),
		body: {
			content: { "application/json": { schema: CreateBranchBody } },
			required: true,
		},
	},
	responses: {
		201: {
			content: {
				"application/json": { schema: z.object({ data: BranchSchema }) },
			},
			description: "Created",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Business not found",
		},
	},
});

const updateRoute = createRoute({
	method: "patch",
	path: "/:id",
	tags: ["Branches"],
	summary: "Update branch",
	security: [{ bearerAuth: [] }],
	request: {
		params: IdParam,
		body: {
			content: { "application/json": { schema: UpdateBranchBody } },
			required: true,
		},
	},
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ data: BranchSchema }) },
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
	tags: ["Branches"],
	summary: "Delete branch",
	security: [{ bearerAuth: [] }],
	request: { params: IdParam },
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ data: BranchSchema }) },
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

const BranchHoursSchema = z
	.object({
		id: z.string(),
		branchId: z.string(),
		dayOfWeek: z.number().int().min(0).max(6),
		openTime: z.string().nullable(),
		closeTime: z.string().nullable(),
		isClosed: z.boolean(),
	})
	.openapi("BranchHours");

const UpsertHoursBody = z
	.object({
		hours: z
			.array(
				z.object({
					dayOfWeek: z.number().int().min(0).max(6),
					isClosed: z.boolean().default(false),
					openTime: z
						.string()
						.regex(/^\d{2}:\d{2}$/)
						.nullable()
						.optional(),
					closeTime: z
						.string()
						.regex(/^\d{2}:\d{2}$/)
						.nullable()
						.optional(),
				}),
			)
			.min(1)
			.max(7),
	})
	.openapi("UpsertBranchHoursBody");

const getHoursRoute = createRoute({
	method: "get",
	path: "/:id/hours",
	tags: ["Branches"],
	summary: "Get branch working hours",
	request: { params: IdParam },
	responses: {
		200: {
			content: { "application/json": { schema: z.array(BranchHoursSchema) } },
			description: "OK",
		},
	},
});

const AvailabilityQuery = z.object({
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	serviceId: z.string(),
});

const AvailabilitySchema = z
	.object({
		date: z.string(),
		serviceId: z.string(),
		isClosed: z.boolean(),
		slots: z.array(z.string()),
	})
	.openapi("BranchAvailability");

const getAvailabilityRoute = createRoute({
	method: "get",
	path: "/:id/availability",
	tags: ["Branches"],
	summary: "List bookable slots for a branch, service, and date",
	request: {
		params: IdParam,
		query: AvailabilityQuery,
	},
	responses: {
		200: {
			content: { "application/json": { schema: AvailabilitySchema } },
			description: "OK",
		},
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not found",
		},
		422: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Validation error",
		},
	},
});

const putHoursRoute = createRoute({
	method: "put",
	path: "/:id/hours",
	tags: ["Branches"],
	summary: "Set branch working hours (owner)",
	security: [{ bearerAuth: [] }],
	request: {
		params: IdParam,
		body: {
			content: { "application/json": { schema: UpsertHoursBody } },
			required: true,
		},
	},
	responses: {
		200: {
			content: { "application/json": { schema: z.array(BranchHoursSchema) } },
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

const publicApp = createApp()
	.openapi(listRoute, async (c) => {
		const { businessId } = c.req.valid("query");
		const branches = await c.var.branchesService.listByBusiness(businessId);
		return c.json(
			{
				data: branches,
				query: {
					page: 1,
					limit: branches.length,
					total: branches.length,
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
		const branch = await c.var.branchesService.get(id);
		return c.json({ data: branch }, 200);
	})
	.openapi(getHoursRoute, async (c) => {
		const { id } = c.req.valid("param");
		const hours = await c.var.branchesService.getHours(id);
		return c.json(hours, 200);
	})
	.openapi(getAvailabilityRoute, async (c) => {
		const { id } = c.req.valid("param");
		const { date, serviceId } = c.req.valid("query");
		const result = await c.var.branchesService.getAvailability(
			id,
			date,
			serviceId,
		);
		return c.json(result, 200);
	});

const privateApp = createApp();
privateApp.use("*", authenticate, requireAuth(["owner"]));
privateApp
	.openapi(createRoute_, async (c) => {
		const { businessId } = c.req.valid("query");
		const body = c.req.valid("json");
		const branch = await c.var.branchesService.create(
			c.var.user.id,
			businessId,
			body,
		);
		return c.json({ data: branch }, 201);
	})
	.openapi(updateRoute, async (c) => {
		const { id } = c.req.valid("param");
		const body = c.req.valid("json");
		const branch = await c.var.branchesService.update(c.var.user.id, id, body);
		return c.json({ data: branch }, 200);
	})
	.openapi(deleteRoute, async (c) => {
		const { id } = c.req.valid("param");
		const branch = await c.var.branchesService.delete(c.var.user.id, id);
		return c.json({ data: branch }, 200);
	})
	.openapi(putHoursRoute, async (c) => {
		const { id } = c.req.valid("param");
		const { hours } = c.req.valid("json");
		const updated = await c.var.branchesService.setHours(
			c.var.user.id,
			id,
			hours,
		);
		return c.json(updated, 200);
	});

export const branchesApp = createApp()
	.route("/", publicApp)
	.route("/", privateApp);

export const installBranchesService: ServiceInstaller = (
	c,
	{ branchesRepo, servicesRepo, bookingsRepo, authz },
) =>
	c.set(
		"branchesService",
		new BranchesService(branchesRepo, servicesRepo, bookingsRepo, authz),
	);
