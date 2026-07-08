import { createRoute, z } from "@hono/zod-openapi";
import { createApp } from "../../core/create-app";
import { authenticate } from "../../middleware/auth";
import { requireAuth } from "../../middleware/auth-guard";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import { OrdersService } from "./orders.service";

const ErrorSchema = z
	.object({ ok: z.literal(false), code: z.string(), message: z.string() })
	.openapi("Error");

const IdParam = z.object({ id: z.string() });

const PlaceOrderBody = z
	.object({
		branchId: z.string().min(1),
		addressId: z.string().min(1),
		items: z
			.array(
				z.object({
					productId: z.string().min(1),
					quantity: z.number().int().positive(),
				}),
			)
			.min(1),
	})
	.openapi("PlaceOrderBody");

const UpdateStatusBody = z
	.object({
		status: z.enum(["Confirmed", "OutForDelivery", "Delivered", "Cancelled"]),
	})
	.openapi("UpdateOrderStatusBody");

const placeOrderRoute = createRoute({
	method: "post",
	path: "/",
	tags: ["Orders"],
	summary: "Place an order",
	security: [{ bearerAuth: [] }],
	request: {
		body: {
			content: { "application/json": { schema: PlaceOrderBody } },
			required: true,
		},
	},
	responses: {
		201: {
			content: { "application/json": { schema: z.any() } },
			description: "Created",
		},
		409: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Out of stock",
		},
		422: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Invalid order",
		},
	},
});

const listMineRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["Orders"],
	summary: "List my orders",
	security: [{ bearerAuth: [] }],
	responses: {
		200: {
			content: { "application/json": { schema: z.array(z.any()) } },
			description: "OK",
		},
	},
});

const cancelRoute = createRoute({
	method: "patch",
	path: "/:id/cancel",
	tags: ["Orders"],
	summary: "Cancel my order",
	security: [{ bearerAuth: [] }],
	request: { params: IdParam },
	responses: {
		204: { description: "Cancelled" },
		422: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not cancellable",
		},
	},
});

const listByBranchRoute = createRoute({
	method: "get",
	path: "/branch",
	tags: ["Orders"],
	summary: "List orders for a branch",
	security: [{ bearerAuth: [] }],
	request: { query: z.object({ branchId: z.string() }) },
	responses: {
		200: {
			content: { "application/json": { schema: z.array(z.any()) } },
			description: "OK",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
	},
});

const updateStatusRoute = createRoute({
	method: "patch",
	path: "/:id/status",
	tags: ["Orders"],
	summary: "Update order status (incl. owner cancel)",
	security: [{ bearerAuth: [] }],
	request: {
		params: IdParam,
		body: {
			content: { "application/json": { schema: UpdateStatusBody } },
			required: true,
		},
	},
	responses: {
		200: {
			content: { "application/json": { schema: z.any() } },
			description: "Updated",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
		422: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Invalid transition",
		},
	},
});

const getRoute = createRoute({
	method: "get",
	path: "/:id",
	tags: ["Orders"],
	summary: "Get an order",
	security: [{ bearerAuth: [] }],
	request: { params: IdParam },
	responses: {
		200: {
			content: { "application/json": { schema: z.any() } },
			description: "OK",
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

const customerApp = createApp();
customerApp.use("*", authenticate);
customerApp
	.openapi(placeOrderRoute, async (c) => {
		const order = await c.var.ordersService.create(
			c.var.user.id,
			c.req.valid("json"),
		);
		return c.json(order, 201);
	})
	.openapi(listMineRoute, async (c) => {
		return c.json(await c.var.ordersService.listMine(c.var.user.id), 200);
	})
	.openapi(cancelRoute, async (c) => {
		await c.var.ordersService.cancel(c.var.user.id, c.req.valid("param").id);
		return new Response(null, { status: 204 });
	});

const ownerApp = createApp();
// Path-scoped (not `use("*")`) so the owner guard never runs for the customer
// `GET /:id` route in customerDetailApp. With a wildcard guard here, requests
// to `/:id` would match ownerApp's middleware first and 403 the customer.
ownerApp.use(
	"/branch",
	authenticate,
	requireAuth(["owner", "manager"], { branchScope: true }),
);
ownerApp.use(
	"/:id/status",
	authenticate,
	requireAuth(["owner", "manager"], { branchScope: true }),
);
ownerApp
	.openapi(listByBranchRoute, async (c) => {
		return c.json(
			await c.var.ordersService.listByBranch(
				c.var.user.id,
				c.req.valid("query").branchId,
				c.var.scopedBranchIds,
			),
			200,
		);
	})
	.openapi(updateStatusRoute, async (c) => {
		const order = await c.var.ordersService.updateStatus(
			c.var.user.id,
			c.req.valid("param").id,
			c.req.valid("json").status,
			c.var.scopedBranchIds,
		);
		return c.json(order, 200);
	});

// Customer-owned order detail (GET /:id). Mounted LAST and in its own
// authenticate-only app: across `.route("/", ...)` merges (and within Hono's
// router) the first-registered match wins, so the parametric `/:id` must come
// AFTER ownerApp's static `/branch` — otherwise `/:id` shadows `/branch`.
const customerDetailApp = createApp();
customerDetailApp.use("*", authenticate);
customerDetailApp.openapi(getRoute, async (c) => {
	return c.json(
		await c.var.ordersService.get(
			c.var.user.id,
			c.req.valid("param").id,
			null, // no branch scope; customer path uses assertCustomerOwnsOrder
			/* asOwner */ false,
		),
		200,
	);
});

export const ordersApp = createApp()
	.route("/", customerApp)
	.route("/", ownerApp)
	.route("/", customerDetailApp);

export const installOrdersService: ServiceInstaller = (
	c,
	{
		ordersRepo,
		customerAddressesRepo,
		branchesRepo,
		productsRepo,
		authz,
		queue,
	},
) =>
	c.set(
		"ordersService",
		new OrdersService(
			ordersRepo,
			customerAddressesRepo,
			branchesRepo,
			productsRepo,
			authz,
			queue,
		),
	);
