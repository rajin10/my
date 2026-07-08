import { createRoute, z } from "@hono/zod-openapi";
import { createApp } from "../../core/create-app";
import { authenticate } from "../../middleware/auth";
import { requireAuth } from "../../middleware/auth-guard";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import { KhataService } from "./khata.service";

const BusinessIdQuery = z.object({ businessId: z.string() });
const CustomerParams = z.object({ userId: z.string() });

const duesRoute = createRoute({
	method: "get",
	path: "/dues",
	tags: ["Khata"],
	summary: "Customer dues list (owner)",
	security: [{ bearerAuth: [] }],
	request: { query: BusinessIdQuery },
	responses: {
		200: {
			content: { "application/json": { schema: z.any() } },
			description: "OK",
		},
	},
});

const ledgerRoute = createRoute({
	method: "get",
	path: "/customers/:userId",
	tags: ["Khata"],
	summary: "One customer's khata ledger (owner)",
	security: [{ bearerAuth: [] }],
	request: { params: CustomerParams, query: BusinessIdQuery },
	responses: {
		200: {
			content: { "application/json": { schema: z.any() } },
			description: "OK",
		},
	},
});

export const khataApp = createApp();
khataApp.use("*", authenticate, requireAuth(["owner"]));

khataApp
	.openapi(duesRoute, async (c) => {
		const { businessId } = c.req.valid("query");
		const dues = await c.var.khataService.dues(c.var.user.id, businessId);
		return c.json(dues, 200);
	})
	.openapi(ledgerRoute, async (c) => {
		const { userId } = c.req.valid("param");
		const { businessId } = c.req.valid("query");
		const ledger = await c.var.khataService.customerLedger(
			c.var.user.id,
			businessId,
			userId,
		);
		return c.json(ledger, 200);
	});

export const installKhataService: ServiceInstaller = (
	c,
	{ khataRepo, paymentsRepo, authz },
) => c.set("khataService", new KhataService(khataRepo, paymentsRepo, authz));
