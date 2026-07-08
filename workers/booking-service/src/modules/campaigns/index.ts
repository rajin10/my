import { createRoute, z } from "@hono/zod-openapi";
import { CampaignsRepository } from "@repo/core/src/database/repositories/campaigns.repository";
import { CustomersRepository } from "@repo/core/src/database/repositories/customers.repository";
import { createApp } from "../../core/create-app";
import { authenticate } from "../../middleware/auth";
import { requireAuth } from "../../middleware/auth-guard";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import { CampaignsService } from "./campaigns.service";

const CampaignSchema = z
	.object({
		id: z.string(),
		businessId: z.string(),
		name: z.string(),
		segment: z.enum(["All", "VIP", "Regular", "New", "AtRisk"]),
		channels: z.string(),
		message: z.string(),
		status: z.enum(["Draft", "Sent"]),
		sentAt: z.string().nullable(),
		recipientCount: z.number().nullable(),
		createdAt: z.string(),
		updatedAt: z.string().nullable(),
	})
	.openapi("Campaign");

const CreateCampaignBody = z
	.object({
		businessId: z.string(),
		name: z.string().min(1),
		segment: z.enum(["All", "VIP", "Regular", "New", "AtRisk"]).default("All"),
		channels: z.array(z.enum(["Email", "SMS", "Push"])).default(["Email"]),
		message: z.string().default(""),
	})
	.openapi("CreateCampaignBody");

const UpdateCampaignBody = z
	.object({
		name: z.string().optional(),
		segment: z.enum(["All", "VIP", "Regular", "New", "AtRisk"]).optional(),
		channels: z.array(z.enum(["Email", "SMS", "Push"])).optional(),
		message: z.string().optional(),
	})
	.openapi("UpdateCampaignBody");

const BusinessIdQuery = z.object({ businessId: z.string() });
const IdParam = z.object({ id: z.string() });
const ErrorSchema = z
	.object({ ok: z.literal(false), code: z.string(), message: z.string() })
	.openapi("Error");

const listRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["Campaigns"],
	summary: "List campaigns for a business",
	security: [{ bearerAuth: [] }],
	request: { query: BusinessIdQuery },
	responses: {
		200: {
			content: { "application/json": { schema: z.array(CampaignSchema) } },
			description: "OK",
		},
	},
});

const createRoute_ = createRoute({
	method: "post",
	path: "/",
	tags: ["Campaigns"],
	summary: "Create a campaign",
	security: [{ bearerAuth: [] }],
	request: {
		body: {
			content: { "application/json": { schema: CreateCampaignBody } },
			required: true,
		},
	},
	responses: {
		201: {
			content: { "application/json": { schema: CampaignSchema } },
			description: "Created",
		},
	},
});

const updateRoute = createRoute({
	method: "patch",
	path: "/:id",
	tags: ["Campaigns"],
	summary: "Update campaign",
	security: [{ bearerAuth: [] }],
	request: {
		params: IdParam,
		body: {
			content: { "application/json": { schema: UpdateCampaignBody } },
			required: true,
		},
	},
	responses: {
		200: {
			content: { "application/json": { schema: CampaignSchema } },
			description: "Updated",
		},
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not found",
		},
	},
});

const sendRoute = createRoute({
	method: "post",
	path: "/:id/send",
	tags: ["Campaigns"],
	summary: "Mark campaign as sent",
	security: [{ bearerAuth: [] }],
	request: { params: IdParam, query: BusinessIdQuery },
	responses: {
		200: {
			content: { "application/json": { schema: CampaignSchema } },
			description: "Sent",
		},
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not found",
		},
		409: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Already sent",
		},
	},
});

const deleteRoute = createRoute({
	method: "delete",
	path: "/:id",
	tags: ["Campaigns"],
	summary: "Delete a campaign",
	security: [{ bearerAuth: [] }],
	request: { params: IdParam },
	responses: {
		204: { description: "Deleted" },
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not found",
		},
	},
});

export const campaignsApp = createApp();
campaignsApp.use("*", authenticate, requireAuth(["owner"]));

campaignsApp
	.openapi(listRoute, async (c) => {
		const { businessId } = c.req.valid("query");
		const campaigns = await c.var.campaignsService.list(
			c.var.user.id,
			businessId,
		);
		return c.json(campaigns, 200);
	})
	.openapi(createRoute_, async (c) => {
		const body = c.req.valid("json");
		const campaign = await c.var.campaignsService.create(c.var.user.id, body);
		return c.json(campaign, 201);
	})
	.openapi(updateRoute, async (c) => {
		const { id } = c.req.valid("param");
		const body = c.req.valid("json");
		const campaign = await c.var.campaignsService.update(
			c.var.user.id,
			id,
			body,
		);
		return c.json(campaign, 200);
	})
	.openapi(sendRoute, async (c) => {
		const { id } = c.req.valid("param");
		const { businessId } = c.req.valid("query");
		const campaign = await c.var.campaignsService.send(
			c.var.user.id,
			id,
			businessId,
		);
		return c.json(campaign, 200);
	})
	.openapi(deleteRoute, async (c) => {
		const { id } = c.req.valid("param");
		await c.var.campaignsService.delete(c.var.user.id, id);
		return c.body(null, 204);
	});

export const installCampaignsService: ServiceInstaller = (c, { db, authz }) =>
	c.set(
		"campaignsService",
		new CampaignsService(
			new CampaignsRepository(db),
			new CustomersRepository(db),
			authz,
		),
	);
