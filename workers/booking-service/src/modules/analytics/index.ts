import { createRoute, z } from "@hono/zod-openapi";
import { AnalyticsRepository } from "@repo/core/src/database/repositories/analytics.repository";
import { createApp } from "../../core/create-app";
import { authenticate } from "../../middleware/auth";
import { requireAuth } from "../../middleware/auth-guard";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import { AnalyticsService } from "./analytics.service";

const RangeQuery = z.object({
	businessId: z.string(),
	range: z.enum(["7", "30", "90"]).default("30"),
});

const OverviewSchema = z
	.object({
		totalRevenue: z.number(),
		totalBookings: z.number(),
		avgBookingValue: z.number(),
		completedBookings: z.number(),
		pendingBookings: z.number(),
		cancelledBookings: z.number(),
		newCustomers: z.number(),
		returningCustomers: z.number(),
	})
	.openapi("AnalyticsOverview");

const RevenuePointSchema = z.object({
	date: z.string(),
	revenue: z.number(),
	bookings: z.number(),
});
const ServiceStatSchema = z.object({
	serviceId: z.string(),
	name: z.string(),
	count: z.number(),
	revenue: z.number(),
});
const PeakSlotSchema = z.object({
	day: z.string(),
	hour: z.string(),
	count: z.number(),
});

const overviewRoute = createRoute({
	method: "get",
	path: "/overview",
	tags: ["Analytics"],
	summary: "Analytics overview for a business",
	security: [{ bearerAuth: [] }],
	request: { query: RangeQuery },
	responses: {
		200: {
			content: { "application/json": { schema: OverviewSchema } },
			description: "OK",
		},
	},
});

const revenueRoute = createRoute({
	method: "get",
	path: "/revenue",
	tags: ["Analytics"],
	summary: "Daily revenue & booking counts",
	security: [{ bearerAuth: [] }],
	request: { query: RangeQuery },
	responses: {
		200: {
			content: { "application/json": { schema: z.array(RevenuePointSchema) } },
			description: "OK",
		},
	},
});

const servicesRoute = createRoute({
	method: "get",
	path: "/services",
	tags: ["Analytics"],
	summary: "Top services by booking count",
	security: [{ bearerAuth: [] }],
	request: { query: RangeQuery },
	responses: {
		200: {
			content: { "application/json": { schema: z.array(ServiceStatSchema) } },
			description: "OK",
		},
	},
});

const peakRoute = createRoute({
	method: "get",
	path: "/peak",
	tags: ["Analytics"],
	summary: "Peak booking hours heatmap",
	security: [{ bearerAuth: [] }],
	request: { query: RangeQuery },
	responses: {
		200: {
			content: { "application/json": { schema: z.array(PeakSlotSchema) } },
			description: "OK",
		},
	},
});

const ReviewStatsSchema = z
	.object({
		avgRating: z.number(),
		totalReviews: z.number(),
		ratingDistribution: z.array(
			z.object({ rating: z.number(), count: z.number() }),
		),
	})
	.openapi("ReviewStats");

const CouponStatsSchema = z
	.object({
		coupons: z.array(
			z.object({
				couponId: z.string(),
				code: z.string(),
				redemptions: z.number(),
				totalDiscount: z.number(),
			}),
		),
	})
	.openapi("CouponStats");

const StaffStatSchema = z
	.object({
		staff: z.array(
			z.object({
				teamMemberId: z.string(),
				name: z.string(),
				bookings: z.number(),
				revenue: z.number(),
			}),
		),
	})
	.openapi("StaffStats");

const EarningsSchema = z
	.object({
		total: z.number(),
		byStaff: z.array(
			z.object({
				teamMemberId: z.string().nullable(),
				name: z.string(),
				revenue: z.number(),
				bookings: z.number(),
			}),
		),
		byService: z.array(
			z.object({
				serviceId: z.string(),
				name: z.string(),
				revenue: z.number(),
				bookings: z.number(),
			}),
		),
		byBranch: z.array(
			z.object({
				branchId: z.string(),
				name: z.string(),
				revenue: z.number(),
				bookings: z.number(),
			}),
		),
		overTime: z.array(
			z.object({
				date: z.string(),
				revenue: z.number(),
				bookings: z.number(),
			}),
		),
	})
	.openapi("AnalyticsEarnings");

const reviewsRoute = createRoute({
	method: "get",
	path: "/reviews",
	tags: ["Analytics"],
	summary: "Review stats for a business",
	security: [{ bearerAuth: [] }],
	request: { query: RangeQuery },
	responses: {
		200: {
			content: { "application/json": { schema: ReviewStatsSchema } },
			description: "OK",
		},
	},
});

const couponsRoute = createRoute({
	method: "get",
	path: "/coupons",
	tags: ["Analytics"],
	summary: "Coupon redemption stats",
	security: [{ bearerAuth: [] }],
	request: { query: RangeQuery },
	responses: {
		200: {
			content: { "application/json": { schema: CouponStatsSchema } },
			description: "OK",
		},
	},
});

const staffRoute = createRoute({
	method: "get",
	path: "/staff",
	tags: ["Analytics"],
	summary: "Staff performance stats",
	security: [{ bearerAuth: [] }],
	request: { query: RangeQuery },
	responses: {
		200: {
			content: { "application/json": { schema: StaffStatSchema } },
			description: "OK",
		},
	},
});

const earningsRoute = createRoute({
	method: "get",
	path: "/earnings",
	tags: ["Analytics"],
	summary: "Reconciled earnings by staff, service, branch, and over time",
	security: [{ bearerAuth: [] }],
	request: { query: RangeQuery },
	responses: {
		200: {
			content: { "application/json": { schema: EarningsSchema } },
			description: "OK",
		},
	},
});

export const analyticsApp = createApp();
analyticsApp.use("*", authenticate, requireAuth(["owner"]));

analyticsApp
	.openapi(overviewRoute, async (c) => {
		const { businessId, range } = c.req.valid("query");
		const data = await c.var.analyticsService.overview(
			c.var.user.id,
			businessId,
			Number(range),
		);
		return c.json(data, 200);
	})
	.openapi(revenueRoute, async (c) => {
		const { businessId, range } = c.req.valid("query");
		const data = await c.var.analyticsService.revenue(
			c.var.user.id,
			businessId,
			Number(range),
		);
		return c.json(data, 200);
	})
	.openapi(servicesRoute, async (c) => {
		const { businessId, range } = c.req.valid("query");
		const data = await c.var.analyticsService.topServices(
			c.var.user.id,
			businessId,
			Number(range),
		);
		return c.json(data, 200);
	})
	.openapi(peakRoute, async (c) => {
		const { businessId, range } = c.req.valid("query");
		const data = await c.var.analyticsService.peakHours(
			c.var.user.id,
			businessId,
			Number(range),
		);
		return c.json(data, 200);
	})
	.openapi(reviewsRoute, async (c) => {
		const { businessId, range } = c.req.valid("query");
		const data = await c.var.analyticsService.reviewStats(
			c.var.user.id,
			businessId,
			Number(range),
		);
		return c.json(data, 200);
	})
	.openapi(couponsRoute, async (c) => {
		const { businessId, range } = c.req.valid("query");
		const data = await c.var.analyticsService.couponStats(
			c.var.user.id,
			businessId,
			Number(range),
		);
		return c.json(data, 200);
	})
	.openapi(staffRoute, async (c) => {
		const { businessId, range } = c.req.valid("query");
		const data = await c.var.analyticsService.staffStats(
			c.var.user.id,
			businessId,
			Number(range),
		);
		return c.json(data, 200);
	})
	.openapi(earningsRoute, async (c) => {
		const { businessId, range } = c.req.valid("query");
		const data = await c.var.analyticsService.earnings(
			c.var.user.id,
			businessId,
			Number(range),
		);
		return c.json(data, 200);
	});

export const installAnalyticsService: ServiceInstaller = (c, { db, authz }) =>
	c.set(
		"analyticsService",
		new AnalyticsService(new AnalyticsRepository(db), authz),
	);
