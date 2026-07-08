import { getDB, sql } from "@repo/core/src/database/client";
import { Scalar } from "@scalar/hono-api-reference";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { createApp } from "./core/create-app";
import { corsMiddleware } from "./middleware/cors";
import { errorHandler, notFoundHandler } from "./middleware/exceptions";
import { queryParserMiddleware } from "./middleware/query-parser";
import { requestTimeout } from "./middleware/timeout";
import apiRoutes from "./modules/routes";

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

// Health check — lightweight D1 probe, excluded from the 15 s timeout
app.get("/health", async (c) => {
	try {
		const db = getDB();
		await db.run(sql`SELECT 1`);
		return c.json({ status: "ok", db: "ok" });
	} catch {
		return c.json({ status: "degraded", db: "error" }, 503);
	}
});

// Routes
app.route("/api", apiRoutes);

// OpenAPI spec + Scalar API reference
app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
	type: "http",
	scheme: "bearer",
	bearerFormat: "JWT",
});

app.doc("/api/docs/openapi.json", {
	openapi: "3.1.0",
	info: { title: "Talash API", version: "1.0.0" },
});

app.get(
	"/api/docs",
	Scalar({
		url: "/api/docs/openapi.json",
		pageTitle: "Talash API",
	}),
);

// Error and not-found handlers
app.notFound(notFoundHandler);
app.onError(errorHandler);

export default app;
