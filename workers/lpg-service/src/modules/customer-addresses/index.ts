import { createRoute, z } from "@hono/zod-openapi";
import { createApp } from "../../core/create-app";
import { authenticate } from "../../middleware/auth";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import { CustomerAddressesService } from "./customer-addresses.service";

const ErrorSchema = z
	.object({ ok: z.literal(false), code: z.string(), message: z.string() })
	.openapi("Error");

const IdParam = z.object({ id: z.string() });

const AddressBody = z
	.object({
		label: z.string().optional(),
		line: z.string().min(1),
		area: z.string().optional(),
		city: z.string().optional(),
		lat: z.number().optional(),
		lng: z.number().optional(),
		isDefault: z.boolean().optional(),
	})
	.openapi("CustomerAddressBody");

const UpdateAddressBody = AddressBody.partial()
	.refine((v) => Object.keys(v).length > 0, {
		message: "At least one field required",
	})
	.openapi("UpdateCustomerAddressBody");

const listRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["CustomerAddresses"],
	summary: "List my addresses",
	security: [{ bearerAuth: [] }],
	responses: {
		200: {
			content: { "application/json": { schema: z.array(z.any()) } },
			description: "OK",
		},
	},
});

const createAddressRoute = createRoute({
	method: "post",
	path: "/",
	tags: ["CustomerAddresses"],
	summary: "Create an address",
	security: [{ bearerAuth: [] }],
	request: {
		body: {
			content: { "application/json": { schema: AddressBody } },
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

const updateRoute = createRoute({
	method: "patch",
	path: "/:id",
	tags: ["CustomerAddresses"],
	summary: "Update an address",
	security: [{ bearerAuth: [] }],
	request: {
		params: IdParam,
		body: {
			content: { "application/json": { schema: UpdateAddressBody } },
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
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not found",
		},
	},
});

const deleteRoute = createRoute({
	method: "delete",
	path: "/:id",
	tags: ["CustomerAddresses"],
	summary: "Delete an address",
	security: [{ bearerAuth: [] }],
	request: { params: IdParam },
	responses: {
		200: {
			content: { "application/json": { schema: z.any() } },
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

const customerApp = createApp();
customerApp.use("*", authenticate);
customerApp
	.openapi(listRoute, async (c) => {
		return c.json(
			await c.var.customerAddressesService.listMine(c.var.user.id),
			200,
		);
	})
	.openapi(createAddressRoute, async (c) => {
		return c.json(
			await c.var.customerAddressesService.create(
				c.var.user.id,
				c.req.valid("json"),
			),
			201,
		);
	})
	.openapi(updateRoute, async (c) => {
		return c.json(
			await c.var.customerAddressesService.update(
				c.var.user.id,
				c.req.valid("param").id,
				c.req.valid("json"),
			),
			200,
		);
	})
	.openapi(deleteRoute, async (c) => {
		return c.json(
			await c.var.customerAddressesService.remove(
				c.var.user.id,
				c.req.valid("param").id,
			),
			200,
		);
	});

export const customerAddressesApp = createApp().route("/", customerApp);

export const installCustomerAddressesService: ServiceInstaller = (
	c,
	{ customerAddressesRepo, authz },
) =>
	c.set(
		"customerAddressesService",
		new CustomerAddressesService(customerAddressesRepo, authz),
	);
