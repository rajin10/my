import { createApp } from "../core/create-app";
import { injectServices } from "../middleware/services";
import type { ServiceInstaller } from "../middleware/shared-deps";
import { branchesApp, installBranchesService } from "./branches";
import { businessesApp, installBusinessesService } from "./businesses";
import { demoRequestsApp, installDemoRequestsService } from "./demo-requests";
import { favouritesApp, installFavouritesService } from "./favourites";
import { installNotificationsService, notificationsApp } from "./notifications";
import { walkInDispatcherApp } from "./walk-in";

const apiRoutes = createApp();

const serviceInstallers: ServiceInstaller[] = [
	installBusinessesService,
	installBranchesService,
	installNotificationsService,
	installFavouritesService,
	installDemoRequestsService,
];

apiRoutes.use("*", injectServices(serviceInstallers));

apiRoutes.get("/health", (c) =>
	c.json({ ok: true, message: "API is running" }),
);

// Auth + users — `workers/auth-service`
apiRoutes.all("/v1/auth/*", (c) => c.env.AUTH_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/auth", (c) => c.env.AUTH_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/users/*", (c) => c.env.AUTH_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/users", (c) => c.env.AUTH_SERVICE.fetch(c.req.raw));

// Commerce — `workers/lpg-service`
apiRoutes.all("/v1/products/*", (c) => c.env.LPG_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/products", (c) => c.env.LPG_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/orders/*", (c) => c.env.LPG_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/orders", (c) => c.env.LPG_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/customer-addresses/*", (c) =>
	c.env.LPG_SERVICE.fetch(c.req.raw),
);
apiRoutes.all("/v1/customer-addresses", (c) =>
	c.env.LPG_SERVICE.fetch(c.req.raw),
);
apiRoutes.all("/v1/payments/*", (c) => c.env.LPG_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/payments", (c) => c.env.LPG_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/khata/*", (c) => c.env.LPG_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/khata", (c) => c.env.LPG_SERVICE.fetch(c.req.raw));

// Booking vertical — `workers/booking-service`
apiRoutes.all("/v1/services/*", (c) => c.env.BOOKING_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/services", (c) => c.env.BOOKING_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/bookings/*", (c) => c.env.BOOKING_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/bookings", (c) => c.env.BOOKING_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/team/*", (c) => c.env.BOOKING_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/team", (c) => c.env.BOOKING_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/coupons/*", (c) => c.env.BOOKING_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/coupons", (c) => c.env.BOOKING_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/reviews/*", (c) => c.env.BOOKING_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/reviews", (c) => c.env.BOOKING_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/rewards/*", (c) => c.env.BOOKING_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/rewards", (c) => c.env.BOOKING_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/analytics/*", (c) => c.env.BOOKING_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/analytics", (c) => c.env.BOOKING_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/campaigns/*", (c) => c.env.BOOKING_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/campaigns", (c) => c.env.BOOKING_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/customers/*", (c) => c.env.BOOKING_SERVICE.fetch(c.req.raw));
apiRoutes.all("/v1/customers", (c) => c.env.BOOKING_SERVICE.fetch(c.req.raw));

apiRoutes.all("/v1/search/*", (c) => {
	const url = new URL(c.req.url);
	const vertical = url.searchParams.get("vertical") ?? "booking";
	return (vertical === "commerce" ? c.env.LPG_SERVICE : c.env.BOOKING_SERVICE).fetch(
		c.req.raw,
	);
});
apiRoutes.all("/v1/search", (c) => {
	const url = new URL(c.req.url);
	const vertical = url.searchParams.get("vertical") ?? "booking";
	return (vertical === "commerce" ? c.env.LPG_SERVICE : c.env.BOOKING_SERVICE).fetch(
		c.req.raw,
	);
});

apiRoutes.route("/v1/businesses", businessesApp);
apiRoutes.route("/v1/branches", branchesApp);
apiRoutes.route("/v1/notifications", notificationsApp);
apiRoutes.route("/v1/favourites", favouritesApp);
apiRoutes.route("/v1/demo-requests", demoRequestsApp);
apiRoutes.route("/v1/walk-in", walkInDispatcherApp);

export default apiRoutes;
