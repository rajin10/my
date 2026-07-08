import { createRoute, z } from "@hono/zod-openapi";
import { createApp } from "../../core/create-app";
import { authenticate } from "../../middleware/auth";
import { requireAuth } from "../../middleware/auth-guard";
import { rateLimit } from "../../middleware/rate-limit";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import { CouponsService } from "./coupons.service";

const CouponSchema = z
	.object({
		id: z.string(),
		businessId: z.string(),
		code: z.string(),
		type: z.enum(["Percentage", "Fixed"]),
		value: z.number(),
		usedCount: z.number(),
		maxUses: z.number(),
		status: z.enum(["Active", "Expired"]),
		expiresAt: z.string(),
		createdAt: z.string(),
		updatedAt: z.string().nullable(),
	})
	.openapi("Coupon");

const PaginatedCoupons = z
	.object({
		data: z.array(CouponSchema),
		query: z.object({
			page: z.number(),
			limit: z.number(),
			total: z.number(),
			totalPages: z.number(),
			hasNextPage: z.boolean(),
			hasPrevPage: z.boolean(),
		}),
	})
	.openapi("PaginatedCoupons");

const CreateCouponBody = z
	.object({
		businessId: z.string(),
		code: z.string().min(3).max(20).toUpperCase(),
		type: z.enum(["Percentage", "Fixed"]),
		value: z.number().int().positive(),
		maxUses: z.number().int().positive(),
		expiresAt: z.string().openapi({ example: "2026-12-31T23:59:59" }),
	})
	.openapi("CreateCouponBody");

const ValidateBody = z
	.object({
		code: z.string(),
		businessId: z.string(),
		price: z.number().int().positive(),
	})
	.openapi("ValidateCouponBody");

const ValidateResult = z
	.object({
		couponId: z.string(),
		code: z.string(),
		discount: z.number(),
	})
	.openapi("ValidateCouponResult");

const IdParam = z.object({ id: z.string() });
const ErrorSchema = z
	.object({ ok: z.literal(false), code: z.string(), message: z.string() })
	.openapi("Error");

const listRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["Coupons"],
	summary: "List coupons for a business",
	security: [{ bearerAuth: [] }],
	request: {
		query: z.object({
			businessId: z.string(),
			page: z.coerce.number().default(1).optional(),
			limit: z.coerce.number().default(10).optional(),
		}),
	},
	responses: {
		200: {
			content: { "application/json": { schema: PaginatedCoupons } },
			description: "OK",
		},
	},
});

const getRoute = createRoute({
	method: "get",
	path: "/:id",
	tags: ["Coupons"],
	summary: "Get coupon",
	security: [{ bearerAuth: [] }],
	request: { params: IdParam },
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ data: CouponSchema }) },
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
	tags: ["Coupons"],
	summary: "Create coupon",
	security: [{ bearerAuth: [] }],
	request: {
		body: {
			content: { "application/json": { schema: CreateCouponBody } },
			required: true,
		},
	},
	responses: {
		201: {
			content: {
				"application/json": { schema: z.object({ data: CouponSchema }) },
			},
			description: "Created",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
	},
});

const deleteRoute = createRoute({
	method: "delete",
	path: "/:id",
	tags: ["Coupons"],
	summary: "Delete coupon",
	security: [{ bearerAuth: [] }],
	request: { params: IdParam },
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ data: CouponSchema }) },
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

const validateRoute = createRoute({
	method: "post",
	path: "/validate",
	tags: ["Coupons"],
	summary: "Validate a coupon code",
	request: {
		body: {
			content: { "application/json": { schema: ValidateBody } },
			required: true,
		},
	},
	responses: {
		200: {
			content: { "application/json": { schema: ValidateResult } },
			description: "Valid coupon + computed discount",
		},
		422: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Invalid or expired code",
		},
	},
});

// Public: validate. Rate-limited per IP — this endpoint reveals whether a code
// is valid for a given business, so an open limiter would allow code enumeration.
const publicApp = createApp();
publicApp.use("/validate", rateLimit({ limit: 30, windowSecs: 60 }));
publicApp.openapi(validateRoute, async (c) => {
	const { code, businessId, price } = c.req.valid("json");
	const result = await c.var.couponsService.validate(code, businessId, price);
	return c.json(result, 200);
});

// Owner-only: CRUD
const privateApp = createApp();
privateApp.use("*", authenticate, requireAuth(["owner"]));
privateApp
	.openapi(listRoute, async (c) => {
		const { businessId, ...query } = c.req.valid("query");
		const result = await c.var.couponsService.listByBusiness(
			c.var.user.id,
			businessId,
			query,
		);
		return c.json(result, 200);
	})
	.openapi(getRoute, async (c) => {
		const { id } = c.req.valid("param");
		const coupon = await c.var.couponsService.get(c.var.user.id, id);
		return c.json({ data: coupon }, 200);
	})
	.openapi(createRoute_, async (c) => {
		const { businessId, ...data } = c.req.valid("json");
		const coupon = await c.var.couponsService.create(
			c.var.user.id,
			businessId,
			data,
		);
		return c.json({ data: coupon }, 201);
	})
	.openapi(deleteRoute, async (c) => {
		const { id } = c.req.valid("param");
		const coupon = await c.var.couponsService.delete(c.var.user.id, id);
		return c.json({ data: coupon }, 200);
	});

export const couponsApp = createApp()
	.route("/", publicApp)
	.route("/", privateApp);

export const installCouponsService: ServiceInstaller = (
	c,
	{ couponsRepo, authz },
) => c.set("couponsService", new CouponsService(couponsRepo, authz));
