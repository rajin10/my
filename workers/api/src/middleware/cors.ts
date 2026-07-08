import { cors } from "hono/cors";

const defaultAllowedOrigins = [
	"http://localhost:8787",
	"http://localhost:5173",
	"http://localhost:5174",
	"http://localhost:3000",
	"http://localhost:3001",
	"https://talash.mahannankhan.info",
	"https://business.mahannankhan.info",
	"https://talash-marketing-site-staging.rajinhasan-app.workers.dev",
	"https://talash-business-dashboard-staging.rajinhasan-app.workers.dev",
];

function parseAllowedOrigins(value: string | undefined): string[] {
	if (!value?.trim()) {
		return [];
	}
	return value.split(",").map((origin) => origin.trim());
}

function getAllowedOrigins(env: CloudflareBindings): Set<string> {
	return new Set([
		...defaultAllowedOrigins,
		...parseAllowedOrigins(env.ALLOWED_ORIGINS),
	]);
}

export const corsMiddleware = cors({
	origin: (origin, c) => {
		if (
			origin.endsWith(".googleapis.com") ||
			origin.endsWith(".google.com")
		) {
			return origin; // Dynamically echo back the permitted origin
		}

		const allowed = getAllowedOrigins(c.env as CloudflareBindings);
		return allowed.has(origin) ? origin : null;
	},
	credentials: true,
	allowHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
	allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
});
