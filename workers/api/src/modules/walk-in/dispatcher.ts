import { createRoute, z } from "@hono/zod-openapi";
import { createApp } from "../../core/create-app";
import { ValidationError } from "../../core/errors";
import { authenticate } from "../../middleware/auth";
import { requireAuth } from "../../middleware/auth-guard";
import { optionalAuth } from "../../middleware/optional-auth";
import {
	resolveBranchVertical,
	workerForVertical,
} from "./branch-vertical";

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

function forwardHeaders(req: Request): Headers {
	const headers = new Headers();
	for (const name of ["Authorization", "X-Device-ID", "X-Device-Name"]) {
		const value = req.headers.get(name);
		if (value) headers.set(name, value);
	}
	const contentType = req.headers.get("Content-Type");
	if (contentType) headers.set("Content-Type", contentType);
	return headers;
}

async function proxyRequest(c: {
	req: { raw: Request; url: string };
	env: CloudflareBindings;
}, worker: Fetcher) {
	return worker.fetch(c.req.raw);
}

async function proxyJsonPost(
	c: { req: { raw: Request; url: string }; env: CloudflareBindings },
	worker: Fetcher,
	body: unknown,
) {
	const url = new URL(c.req.url);
	return worker.fetch(
		new Request(url.toString(), {
			method: "POST",
			headers: forwardHeaders(c.req.raw),
			body: JSON.stringify(body),
		}),
	);
}

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
	summary: "Submit a walk-in booking or order",
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
			description: "Slot or stock conflict",
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
	summary: "Batch sync walk-in submissions from owner queue",
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
	summary: "List my synced walk-in receipts",
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
		const { branchId } = c.req.valid("query");
		const vertical = await resolveBranchVertical(
			branchId,
			c.var.branchesRepo,
			c.var.businessesRepo,
			c.env.TALASH_KV,
		);
		return proxyRequest(c, workerForVertical(vertical, c.env));
	})
	.openapi(submitRoute, async (c) => {
		const body = c.req.valid("json");
		const vertical = await resolveBranchVertical(
			body.branchId,
			c.var.branchesRepo,
			c.var.businessesRepo,
			c.env.TALASH_KV,
		);
		if (body.vertical !== vertical) {
			throw new ValidationError(
				`Walk-in vertical ${body.vertical} does not match branch vertical ${vertical}`,
			);
		}
		return proxyRequest(c, workerForVertical(vertical, c.env));
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
		const bookingEntries = entries.filter((e) => e.vertical === "booking");
		const commerceEntries = entries.filter((e) => e.vertical === "commerce");

		const synced: Record<string, string> = {};

		if (bookingEntries.length > 0) {
			const res = await proxyJsonPost(
				c,
				c.env.BOOKING_SERVICE,
				{ entries: bookingEntries },
			);
			if (!res.ok) return res;
			const data = (await res.json()) as { synced?: Record<string, string> };
			Object.assign(synced, data.synced ?? {});
		}

		if (commerceEntries.length > 0) {
			const res = await proxyJsonPost(
				c,
				c.env.LPG_SERVICE,
				{ entries: commerceEntries },
			);
			if (!res.ok) return res;
			const data = (await res.json()) as { synced?: Record<string, string> };
			Object.assign(synced, data.synced ?? {});
		}

		return c.json({ synced }, 200);
	})
	.openapi(branchQrRoute, async (c) => {
		const { branchId } = c.req.valid("json");
		const vertical = await resolveBranchVertical(
			branchId,
			c.var.branchesRepo,
			c.var.businessesRepo,
			c.env.TALASH_KV,
		);
		return proxyRequest(c, workerForVertical(vertical, c.env));
	})
	.openapi(sessionsRoute, async (c) => {
		const { branchId } = c.req.valid("json");
		const vertical = await resolveBranchVertical(
			branchId,
			c.var.branchesRepo,
			c.var.businessesRepo,
			c.env.TALASH_KV,
		);
		return proxyRequest(c, workerForVertical(vertical, c.env));
	});

const receiptsApp = createApp();
receiptsApp.use("*", authenticate);
receiptsApp.openapi(receiptsRoute, async (c) => {
	const headers = forwardHeaders(c.req.raw);
	const url = new URL(c.req.url);

	const [bookingRes, commerceRes] = await Promise.all([
		c.env.BOOKING_SERVICE.fetch(
			new Request(url.toString(), { method: "GET", headers }),
		),
		c.env.LPG_SERVICE.fetch(
			new Request(url.toString(), { method: "GET", headers }),
		),
	]);

	if (!bookingRes.ok) return bookingRes;
	if (!commerceRes.ok) return commerceRes;

	const bookingData = (await bookingRes.json()) as {
		bookings?: unknown[];
	};
	const commerceData = (await commerceRes.json()) as {
		orders?: unknown[];
	};

	return c.json(
		{
			bookings: bookingData.bookings ?? [],
			orders: commerceData.orders ?? [],
		},
		200,
	);
});

export const walkInDispatcherApp = createApp()
	.route("/", publicApp)
	.route("/", receiptsApp)
	.route("/", ownerApp);
