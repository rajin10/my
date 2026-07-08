import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { createApp } from "./core/create-app";
import { corsMiddleware } from "./middleware/cors";
import { errorHandler, notFoundHandler } from "./middleware/exceptions";
import { queryParserMiddleware } from "./middleware/query-parser";
import { injectServices } from "./middleware/services";
import { requestTimeout } from "./middleware/timeout";
import { analyticsApp, installAnalyticsService } from "./modules/analytics";
import { bookingsApp, installBookingsService } from "./modules/bookings";
import { campaignsApp, installCampaignsService } from "./modules/campaigns";
import { couponsApp, installCouponsService } from "./modules/coupons";
import { customersApp, installCustomersService } from "./modules/customers";
import { installReviewsService, reviewsApp } from "./modules/reviews";
import { installRewardsService, rewardsApp } from "./modules/rewards";
import { installServicesService, servicesApp } from "./modules/services";
import {
	installStaffAvailabilityService,
	staffAvailabilityApp,
} from "./modules/staff-availability";
import { installSearchService, searchApp } from "./modules/search";
import { installTeamService, teamApp } from "./modules/team";
import { installWalkInService, walkInApp } from "./modules/walk-in";

const app = createApp({ strict: false });

app.use("*", requestId());
app.use("*", logger());
app.use(
	"*",
	secureHeaders({
		crossOriginResourcePolicy: "cross-origin",
	}),
);
app.use("*", corsMiddleware);
app.use("*", queryParserMiddleware);
app.use("/api/*", requestTimeout(15_000));

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

const serviceInstallers = [
	installServicesService,
	installBookingsService,
	installTeamService,
	installStaffAvailabilityService,
	installCouponsService,
	installReviewsService,
	installRewardsService,
	installAnalyticsService,
	installCampaignsService,
	installCustomersService,
	installSearchService,
	installWalkInService,
];

app.use("*", injectServices(serviceInstallers));

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
app.route("/api/v1/walk-in", walkInApp);

app.notFound(notFoundHandler);
app.onError(errorHandler);

export default app;
