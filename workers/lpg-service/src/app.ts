import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { createApp } from "./core/create-app";
import { corsMiddleware } from "./middleware/cors";
import { errorHandler, notFoundHandler } from "./middleware/exceptions";
import { queryParserMiddleware } from "./middleware/query-parser";
import { injectServices } from "./middleware/services";
import { requestTimeout } from "./middleware/timeout";
import {
	customerAddressesApp,
	installCustomerAddressesService,
} from "./modules/customer-addresses";
import { installKhataService, khataApp } from "./modules/khata";
import { installOrdersService, ordersApp } from "./modules/orders";
import { installPaymentsService, paymentsApp } from "./modules/payments";
import { installProductsService, productsApp } from "./modules/products";
import { installSearchService, searchApp } from "./modules/search";
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
		return c.json({ status: "ok", db: "ok" });
	} catch {
		return c.json({ status: "error", db: "unavailable" }, 503);
	}
});

const serviceInstallers = [
	installProductsService,
	installOrdersService,
	installCustomerAddressesService,
	installPaymentsService,
	installKhataService,
	installSearchService,
	installWalkInService,
];

app.use("*", injectServices(serviceInstallers));

app.route("/api/v1/products", productsApp);
app.route("/api/v1/orders", ordersApp);
app.route("/api/v1/customer-addresses", customerAddressesApp);
app.route("/api/v1/payments", paymentsApp);
app.route("/api/v1/khata", khataApp);
app.route("/api/v1/search", searchApp);
app.route("/api/v1/walk-in", walkInApp);

app.notFound(notFoundHandler);
app.onError(errorHandler);

export default app;
