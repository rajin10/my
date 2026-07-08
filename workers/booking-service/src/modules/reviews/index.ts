import { createRoute, z } from "@hono/zod-openapi";
import { createApp } from "../../core/create-app";
import { authenticate } from "../../middleware/auth";
import { requireAuth } from "../../middleware/auth-guard";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import { ReviewsService } from "./reviews.service";

const ReviewSchema = z
	.object({
		id: z.string(),
		userId: z.string(),
		businessId: z.string(),
		serviceId: z.string(),
		bookingId: z.string().nullable(),
		rating: z.number(),
		text: z.string(),
		status: z.enum(["Pending", "Published"]),
		createdAt: z.string(),
		updatedAt: z.string().nullable(),
	})
	.openapi("Review");

const MyReviewSchema = ReviewSchema.extend({
	businessName: z.string(),
	serviceName: z.string(),
}).openapi("MyReview");

const SubmitReviewBody = z
	.object({
		bookingId: z.string().min(1),
		rating: z.number().int().min(1).max(5),
		text: z.string().min(1),
	})
	.openapi("SubmitReviewBody");

const BusinessIdQuery = z.object({ businessId: z.string() });
const IdParam = z.object({ id: z.string() });
const ErrorSchema = z
	.object({ ok: z.literal(false), code: z.string(), message: z.string() })
	.openapi("Error");

const PaginationMetaSchema = z.object({
	page: z.number(),
	limit: z.number(),
	total: z.number(),
	totalPages: z.number(),
	hasNextPage: z.boolean(),
	hasPrevPage: z.boolean(),
});

const listPublishedRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["Reviews"],
	summary: "List published reviews for a business",
	request: { query: BusinessIdQuery },
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						data: z.array(ReviewSchema),
						query: PaginationMetaSchema,
					}),
				},
			},
			description: "OK",
		},
	},
});

const listPendingRoute = createRoute({
	method: "get",
	path: "/pending",
	tags: ["Reviews"],
	summary: "List pending reviews (owner only)",
	security: [{ bearerAuth: [] }],
	request: { query: BusinessIdQuery },
	responses: {
		200: {
			content: { "application/json": { schema: z.array(ReviewSchema) } },
			description: "OK",
		},
	},
});

const listMineRoute = createRoute({
	method: "get",
	path: "/mine",
	tags: ["Reviews"],
	summary: "List the authenticated user's own reviews",
	security: [{ bearerAuth: [] }],
	responses: {
		200: {
			content: { "application/json": { schema: z.array(MyReviewSchema) } },
			description: "OK",
		},
	},
});

const submitRoute = createRoute({
	method: "post",
	path: "/",
	tags: ["Reviews"],
	summary: "Submit a review",
	security: [{ bearerAuth: [] }],
	request: {
		body: {
			content: { "application/json": { schema: SubmitReviewBody } },
			required: true,
		},
	},
	responses: {
		201: {
			content: {
				"application/json": { schema: z.object({ data: ReviewSchema }) },
			},
			description: "Submitted (pending)",
		},
		422: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Validation error",
		},
	},
});

const approveRoute = createRoute({
	method: "patch",
	path: "/:id/approve",
	tags: ["Reviews"],
	summary: "Approve review",
	security: [{ bearerAuth: [] }],
	request: { params: IdParam },
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ data: ReviewSchema }) },
			},
			description: "Published",
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

const rejectRoute = createRoute({
	method: "patch",
	path: "/:id/reject",
	tags: ["Reviews"],
	summary: "Reject review",
	security: [{ bearerAuth: [] }],
	request: { params: IdParam },
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ data: ReviewSchema }) },
			},
			description: "Rejected (hidden)",
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

// Public: list published reviews
const publicApp = createApp().openapi(listPublishedRoute, async (c) => {
	const { businessId } = c.req.valid("query");
	const reviews = await c.var.reviewsService.listPublished(businessId);
	return c.json(
		{
			data: reviews,
			query: {
				page: 1,
				limit: reviews.length,
				total: reviews.length,
				totalPages: 1,
				hasNextPage: false,
				hasPrevPage: false,
			},
		},
		200,
	);
});

// Authenticated: submit review + list own reviews
const userApp = createApp();
userApp.use("*", authenticate);
userApp
	.openapi(listMineRoute, async (c) => {
		const reviews = await c.var.reviewsService.listMine(c.var.user.id);
		return c.json(reviews, 200);
	})
	.openapi(submitRoute, async (c) => {
		const body = c.req.valid("json");
		const review = await c.var.reviewsService.submit(c.var.user.id, body);
		return c.json({ data: review }, 201);
	});

// Owner-only: pending list + approve/reject
const ownerApp = createApp();
ownerApp.use("*", authenticate, requireAuth(["owner"]));
ownerApp
	.openapi(listPendingRoute, async (c) => {
		const { businessId } = c.req.valid("query");
		const reviews = await c.var.reviewsService.listPending(
			c.var.user.id,
			businessId,
		);
		return c.json(reviews, 200);
	})
	.openapi(approveRoute, async (c) => {
		const { id } = c.req.valid("param");
		const review = await c.var.reviewsService.approve(c.var.user.id, id);
		return c.json({ data: review }, 200);
	})
	.openapi(rejectRoute, async (c) => {
		const { id } = c.req.valid("param");
		const review = await c.var.reviewsService.reject(c.var.user.id, id);
		return c.json({ data: review }, 200);
	});

export const reviewsApp = createApp()
	.route("/", publicApp)
	.route("/", userApp)
	.route("/", ownerApp);

export const installReviewsService: ServiceInstaller = (
	c,
	{ reviewsRepo, bookingsRepo, branchesRepo, authz },
) =>
	c.set(
		"reviewsService",
		new ReviewsService(reviewsRepo, bookingsRepo, branchesRepo, authz),
	);
