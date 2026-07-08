import { createRoute, z } from "@hono/zod-openapi";
import { createApp } from "../../core/create-app";
import { authenticate } from "../../middleware/auth";
import { requireAuth } from "../../middleware/auth-guard";
import { optionalAuth } from "../../middleware/optional-auth";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import { WalkInService } from "./walk-in.service";

const ErrorSchema = z
	.object({ ok: z.literal(false), code: z.string(), message: z.string() })
	.openapi("WalkInError");

const WalkInCustomerSchema = z.object({
	userId: z.string().optional(),
	guestName: z.string().optional(),
	guestPhone: z.string().optional(),
});

const WalkInSubmitBody = z
	.object({
		localId: z.string().min(1),
		branchId: z.string().min(1),
		vertical: z.enum(["booking", "commerce"]),
		customer: WalkInCustomerSchema,
		booking: z
			.object({
				serviceId: z.string().min(1),
				slot: z.string().min(1),
			})
			.optional(),
		order: z
			.object({
				items: z
					.array(
						z.object({
							productId: z.string().min(1),
							qty: z.number().int().positive(),
						}),
					)
					.min(1),
			})
			.optional(),
		total: z.number().int().nonnegative(),
		submittedAt: z.number().int(),
	})
	.openapi("WalkInSubmitBody");

const contextRoute = createRoute({
	method: "get",
	path: "/context",
	tags: ["Walk-in"],
	summary: "Get walk-in catalog snapshot",
	request: {
		query: z.object({
			branchId: z.string().min(1),
			session: z.string().optional(),
			signature: z.string().optional(),
		}),
	},
	responses: {
		200: {
			content: { "application/json": { schema: z.any() } },
			description: "OK",
		},
		422: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Invalid session or signature",
		},
	},
});

const submitRoute = createRoute({
	method: "post",
	path: "/submit",
	tags: ["Walk-in"],
	summary: "Submit a walk-in booking",
	request: {
		body: {
			content: { "application/json": { schema: WalkInSubmitBody } },
			required: true,
		},
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						localId: z.string(),
						serverId: z.string(),
						status: z.literal("accepted"),
					}),
				},
			},
			description: "Accepted",
		},
		409: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Slot conflict",
		},
		422: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Validation error",
		},
	},
});

const syncRoute = createRoute({
	method: "post",
	path: "/sync",
	tags: ["Walk-in"],
	summary: "Batch sync booking walk-in submissions from owner queue",
	security: [{ bearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({
						entries: z.array(WalkInSubmitBody).min(1).max(20),
					}),
				},
			},
			required: true,
		},
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						synced: z.record(z.string(), z.string()),
					}),
				},
			},
			description: "Synced",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
	},
});

const branchQrRoute = createRoute({
	method: "post",
	path: "/branch-qr",
	tags: ["Walk-in"],
	summary: "Generate or regenerate signed branch QR",
	security: [{ bearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({ branchId: z.string().min(1) }),
				},
			},
			required: true,
		},
	},
	responses: {
		200: {
			content: { "application/json": { schema: z.any() } },
			description: "OK",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
	},
});

const sessionsRoute = createRoute({
	method: "post",
	path: "/sessions",
	tags: ["Walk-in"],
	summary: "Create a short-lived walk-in session",
	security: [{ bearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({ branchId: z.string().min(1) }),
				},
			},
			required: true,
		},
	},
	responses: {
		201: {
			content: { "application/json": { schema: z.any() } },
			description: "Created",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
	},
});

const receiptsRoute = createRoute({
	method: "get",
	path: "/receipts",
	tags: ["Walk-in"],
	summary: "List my synced booking walk-in receipts",
	security: [{ bearerAuth: [] }],
	responses: {
		200: {
			content: { "application/json": { schema: z.any() } },
			description: "OK",
		},
	},
});

const publicApp = createApp();
publicApp.use("*", optionalAuth);
publicApp
	.openapi(contextRoute, async (c) => {
		const { branchId, session, signature } = c.req.valid("query");
		return c.json(
			await c.var.walkInService.getContext(branchId, session, signature),
			200,
		);
	})
	.openapi(submitRoute, async (c) => {
		const result = await c.var.walkInService.submit(
			c.req.valid("json"),
			c.var.user?.id,
		);
		return c.json(result, 200);
	});

const ownerApp = createApp();
ownerApp.use(
	"*",
	authenticate,
	requireAuth(["owner", "manager"], { branchScope: true }),
);
ownerApp
	.openapi(syncRoute, async (c) => {
		const { entries } = c.req.valid("json");
		return c.json(
			await c.var.walkInService.syncBatch(
				entries,
				c.var.user.id,
				c.var.scopedBranchIds,
			),
			200,
		);
	})
	.openapi(branchQrRoute, async (c) => {
		const { branchId } = c.req.valid("json");
		return c.json(
			await c.var.walkInService.regenerateBranchQr(
				c.var.user.id,
				branchId,
				c.var.scopedBranchIds,
			),
			200,
		);
	})
	.openapi(sessionsRoute, async (c) => {
		const { branchId } = c.req.valid("json");
		const session = await c.var.walkInService.createSession(
			c.var.user.id,
			branchId,
			c.var.scopedBranchIds,
		);
		return c.json(session, 201);
	});

const receiptsApp = createApp();
receiptsApp.use("*", authenticate);
receiptsApp.openapi(receiptsRoute, async (c) => {
	return c.json(await c.var.walkInService.listReceipts(c.var.user.id), 200);
});

export const walkInApp = createApp()
	.route("/", publicApp)
	.route("/", receiptsApp)
	.route("/", ownerApp);

export const installWalkInService: ServiceInstaller = (
	c,
	{
		branchesRepo,
		businessesRepo,
		servicesRepo,
		bookingsRepo,
		authz,
		queue,
		kv,
		env,
	},
) => {
	c.set(
		"walkInService",
		new WalkInService(
			branchesRepo,
			businessesRepo,
			servicesRepo,
			bookingsRepo,
			authz,
			queue,
			kv,
			env.JWT_SECRET,
		),
	);
};
