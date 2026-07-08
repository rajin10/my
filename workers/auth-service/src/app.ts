import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { createApp } from "./core/create-app";
import { internalApp } from "./internal/authorise";
import { corsMiddleware } from "./middleware/cors";
import { errorHandler, notFoundHandler } from "./middleware/exceptions";
import { queryParserMiddleware } from "./middleware/query-parser";
import { injectServices } from "./middleware/services";
import { requestTimeout } from "./middleware/timeout";
import { authApp, installAuthService } from "./modules/auth";
import { installUsersService, usersApp } from "./modules/users";

const app = createApp({ strict: false });

// Global middleware
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

// Health check — lightweight worker probe
app.get("/health", (c) => c.json({ status: "ok" }));

// Placeholder routes (auth-service work will mount here)
app.get("/api/health", (c) => c.json({ ok: true }));

app.use("*", injectServices([installAuthService, installUsersService]));
app.route("/api/v1/auth", authApp);
app.route("/api/v1/users", usersApp);
app.route("/internal", internalApp);

// Error and not-found handlers
app.notFound(notFoundHandler);
app.onError(errorHandler);

export default app;
