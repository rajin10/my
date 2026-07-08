import { vi } from "vitest";
import type { AuthorizationService } from "../../core/authorization";
import { createApp } from "../../core/create-app";
import { corsMiddleware } from "../../middleware/cors";
import { errorHandler, notFoundHandler } from "../../middleware/exceptions";
import { queryParserMiddleware } from "../../middleware/query-parser";
import { analyticsApp } from "../../modules/analytics";
import type { AnalyticsService } from "../../modules/analytics/analytics.service";
import { bookingsApp } from "../../modules/bookings";
import type { BookingsService } from "../../modules/bookings/bookings.service";
import { campaignsApp } from "../../modules/campaigns";
import type { CampaignsService } from "../../modules/campaigns/campaigns.service";
import { couponsApp } from "../../modules/coupons";
import type { CouponsService } from "../../modules/coupons/coupons.service";
import { customersApp } from "../../modules/customers";
import type { CustomersService } from "../../modules/customers/customers.service";
import { reviewsApp } from "../../modules/reviews";
import type { ReviewsService } from "../../modules/reviews/reviews.service";
import { rewardsApp } from "../../modules/rewards";
import type { RewardsService } from "@repo/core/src/modules/rewards/rewards.service";
import { searchApp } from "../../modules/search";
import type { SearchService } from "../../modules/search/search.service";
import { servicesApp } from "../../modules/services";
import type { ServicesService } from "../../modules/services/services.service";
import { staffAvailabilityApp } from "../../modules/staff-availability";
import type { StaffAvailabilityService } from "../../modules/staff-availability/staff-availability.service";
import { teamApp } from "../../modules/team";
import type { TeamService } from "../../modules/team/team.service";
import type { AuthUser } from "../../types";

export interface MockServices {
	servicesService?: Partial<ServicesService>;
	bookingsService?: Partial<BookingsService>;
	teamService?: Partial<TeamService>;
	staffAvailabilityService?: Partial<StaffAvailabilityService>;
	couponsService?: Partial<CouponsService>;
	reviewsService?: Partial<ReviewsService>;
	rewardsService?: Partial<RewardsService>;
	analyticsService?: Partial<AnalyticsService>;
	campaignsService?: Partial<CampaignsService>;
	customersService?: Partial<CustomersService>;
	searchService?: Partial<SearchService>;
	authz?: Partial<AuthorizationService>;
}

export function createTestApp(services: MockServices = {}) {
	const app = createApp({ strict: false });

	app.use("*", corsMiddleware);
	app.use("*", queryParserMiddleware);

	app.get("/health", async (c) => {
		try {
			await c.env.TALASH_DB.prepare("SELECT 1").first();
			return c.json({ status: "ok", service: "booking-service", db: "ok" });
		} catch {
			return c.json(
				{ status: "error", service: "booking-service", db: "unavailable" },
				503,
			);
		}
	});

	const defaultAuthz = {
		resolveBranchScope: async (_user: AuthUser) => null,
		assertBusinessOwner: vi.fn().mockResolvedValue({
			id: "business-1",
			ownerId: "owner-1",
		}),
		assertBranchAccess: vi.fn().mockResolvedValue(undefined),
		assertServiceAccess: vi.fn().mockResolvedValue({
			id: "svc-1",
			branchId: "branch-1",
		}),
		assertBookingAccess: vi.fn().mockResolvedValue({
			id: "booking-1",
			branchId: "branch-1",
		}),
		assertCustomerOwnsBooking: vi.fn().mockResolvedValue({
			id: "booking-1",
			userId: "test-user-id",
		}),
		assertTeamMemberOwner: vi.fn().mockResolvedValue({
			id: "member-1",
			businessId: "business-1",
		}),
		assertTeamMemberAccess: vi.fn().mockResolvedValue({
			id: "member-1",
			businessId: "business-1",
			branchId: null,
		}),
		assertCouponOwner: vi.fn().mockResolvedValue({
			id: "coupon-1",
			businessId: "business-1",
		}),
		assertReviewOwner: vi.fn().mockResolvedValue({
			id: "review-1",
			businessId: "business-1",
		}),
	};

	app.use("*", async (c, next) => {
		// @ts-expect-error test-only AUTH_SERVICE stub
		c.env.AUTH_SERVICE ??= {
			fetch: async (_req: Request | string, init?: RequestInit) => {
				const bodyText =
					typeof init?.body === "string"
						? init.body
						: JSON.stringify(init?.body);
				const parsed = (bodyText ? JSON.parse(bodyText) : {}) as {
					branchScope?: boolean;
				};

				const authHeader =
					(init?.headers as Record<string, string> | undefined)
						?.Authorization ?? "";
				const token = authHeader.startsWith("Bearer ")
					? authHeader.slice(7)
					: "";
				const role = (() => {
					try {
						const [, payloadB64] = token.split(".");
						if (!payloadB64) return "manager";
						const payloadJson = Buffer.from(payloadB64, "base64url").toString(
							"utf8",
						);
						const payload = JSON.parse(payloadJson) as { role?: string };
						return payload.role ?? "manager";
					} catch {
						return "manager";
					}
				})();

				const scopedBranchIds =
					parsed.branchScope && role === "owner"
						? null
						: parsed.branchScope
							? ["branch-1"]
							: null;

				return new Response(JSON.stringify({ scopedBranchIds }), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			},
		};

		c.set("authz", {
			...defaultAuthz,
			...services.authz,
		} as AuthorizationService);
		c.set("scopedBranchIds", null);
		for (const [key, value] of Object.entries(services)) {
			if (key === "authz") continue;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			c.set(key as any, value);
		}
		await next();
	});

	app.route("/api/v1/services", servicesApp);
	app.route("/api/v1/bookings", bookingsApp);
	app.route("/api/v1/team", teamApp);
	app.route("/api/v1/team", staffAvailabilityApp);
	app.route("/api/v1/coupons", couponsApp);
	app.route("/api/v1/reviews", reviewsApp);
	app.route("/api/v1/rewards", rewardsApp);
	app.route("/api/v1/analytics", analyticsApp);
	app.route("/api/v1/campaigns", campaignsApp);
	app.route("/api/v1/customers", customersApp);
	app.route("/api/v1/search", searchApp);

	app.notFound(notFoundHandler);
	app.onError(errorHandler);

	return app;
}
