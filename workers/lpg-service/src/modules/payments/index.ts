import { createRoute, z } from "@hono/zod-openapi";
import { createApp } from "../../core/create-app";
import { authenticate } from "../../middleware/auth";
import { requireAuth } from "../../middleware/auth-guard";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import { PaymentsService } from "./payments.service";

const RecordBody = z
	.object({
		businessId: z.string().min(1),
		userId: z.string().min(1),
		amount: z.number().int().positive(),
		note: z.string().optional(),
		orderId: z.string().optional(),
	})
	.openapi("RecordPaymentBody");

const IdParam = z.object({ id: z.string() });

const recordRoute = createRoute({
	method: "post",
	path: "/",
	tags: ["Payments"],
	summary: "Record a cash payment (owner)",
	security: [{ bearerAuth: [] }],
	request: {
		body: {
			content: { "application/json": { schema: RecordBody } },
			required: true,
		},
	},
	responses: {
		201: {
			content: { "application/json": { schema: z.any() } },
			description: "Created",
		},
	},
});

const voidRoute = createRoute({
	method: "delete",
	path: "/:id",
	tags: ["Payments"],
	summary: "Void a payment (owner)",
	security: [{ bearerAuth: [] }],
	request: { params: IdParam },
	responses: { 204: { description: "Voided" } },
});

export const paymentsApp = createApp();
paymentsApp.use("*", authenticate, requireAuth(["owner"]));

paymentsApp
	.openapi(recordRoute, async (c) => {
		const body = c.req.valid("json");
		const payment = await c.var.paymentsService.record(c.var.user.id, body);
		return c.json(payment, 201);
	})
	.openapi(voidRoute, async (c) => {
		await c.var.paymentsService.void(c.var.user.id, c.req.valid("param").id);
		return new Response(null, { status: 204 });
	});

export const installPaymentsService: ServiceInstaller = (
	c,
	{ paymentsRepo, authz },
) => c.set("paymentsService", new PaymentsService(paymentsRepo, authz));
