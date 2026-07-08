import { createRoute, z } from "@hono/zod-openapi";
import { CustomersRepository } from "@repo/core/src/database/repositories/customers.repository";
import { createApp } from "../../core/create-app";
import { authenticate } from "../../middleware/auth";
import { requireAuth } from "../../middleware/auth-guard";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import { CustomersService } from "./customers.service";

const CustomerSummarySchema = z
	.object({
		userId: z.string(),
		name: z.string(),
		email: z.string().nullable(),
		phone: z.string().nullable(),
		totalVisits: z.number(),
		totalSpend: z.number(),
		avgSpend: z.number(),
		lastVisit: z.string().nullable(),
		firstVisit: z.string().nullable(),
		tier: z.enum(["VIP", "Regular", "New", "AtRisk"]),
	})
	.openapi("CustomerSummary");

const CustomerVisitSchema = z
	.object({
		id: z.string(),
		slot: z.string(),
		status: z.string(),
		price: z.number(),
		discount: z.number(),
		serviceId: z.string(),
	})
	.openapi("CustomerVisit");

const BusinessIdQuery = z.object({ businessId: z.string() });
const CustomerParams = z.object({ userId: z.string() });

const listRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["Customers"],
	summary: "List customers for a business",
	security: [{ bearerAuth: [] }],
	request: { query: BusinessIdQuery },
	responses: {
		200: {
			content: {
				"application/json": { schema: z.array(CustomerSummarySchema) },
			},
			description: "OK",
		},
	},
});

const visitsRoute = createRoute({
	method: "get",
	path: "/:userId/visits",
	tags: ["Customers"],
	summary: "Get visit history for a customer",
	security: [{ bearerAuth: [] }],
	request: { params: CustomerParams, query: BusinessIdQuery },
	responses: {
		200: {
			content: { "application/json": { schema: z.array(CustomerVisitSchema) } },
			description: "OK",
		},
	},
});

export const customersApp = createApp();
customersApp.use("*", authenticate, requireAuth(["owner"]));

customersApp
	.openapi(listRoute, async (c) => {
		const { businessId } = c.req.valid("query");
		const customers = await c.var.customersService.list(
			c.var.user.id,
			businessId,
		);
		return c.json(customers, 200);
	})
	.openapi(visitsRoute, async (c) => {
		const { userId } = c.req.valid("param");
		const { businessId } = c.req.valid("query");
		const visits = await c.var.customersService.visits(
			c.var.user.id,
			businessId,
			userId,
		);
		return c.json(visits, 200);
	});

export const installCustomersService: ServiceInstaller = (c, { db, authz }) =>
	c.set(
		"customersService",
		new CustomersService(new CustomersRepository(db), authz),
	);
