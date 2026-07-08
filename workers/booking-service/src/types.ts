import type { RequestIdVariables } from "hono/request-id";
import type { AuthorizationService } from "./core/authorization";
import type { AnalyticsService } from "./modules/analytics/analytics.service";
import type { BookingsService } from "./modules/bookings/bookings.service";
import type { CampaignsService } from "./modules/campaigns/campaigns.service";
import type { CouponsService } from "./modules/coupons/coupons.service";
import type { CustomersService } from "./modules/customers/customers.service";
import type { ReviewsService } from "./modules/reviews/reviews.service";
import type { SearchService } from "./modules/search/search.service";
import type { ServicesService } from "./modules/services/services.service";
import type { StaffAvailabilityService } from "./modules/staff-availability/staff-availability.service";
import type { TeamService } from "./modules/team/team.service";
import type { WalkInService } from "./modules/walk-in/walk-in.service";
import type { RewardsService } from "@repo/core/src/modules/rewards/rewards.service";

export interface AuthUser {
	id: string;
	email: string | null;
	name: string;
	role: string;
}

export type AppContext = {
	Bindings: CloudflareBindings;

	Variables: RequestIdVariables & {
		parsedQuery: Record<string, unknown>;
		user?: AuthUser;
		scopedBranchIds: string[] | null;
		authz: AuthorizationService;
		servicesService: ServicesService;
		bookingsService: BookingsService;
		teamService: TeamService;
		staffAvailabilityService: StaffAvailabilityService;
		couponsService: CouponsService;
		reviewsService: ReviewsService;
		rewardsService: RewardsService;
		analyticsService: AnalyticsService;
		campaignsService: CampaignsService;
		customersService: CustomersService;
		searchService: SearchService;
		walkInService: WalkInService;
	};
};

export type AppEnv = AppContext;
