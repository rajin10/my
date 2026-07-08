import { vi } from "vitest";
import type { AuthorizationService } from "../../core/authorization";
import { createApp } from "../../core/create-app";
import { corsMiddleware } from "../../middleware/cors";
import { errorHandler, notFoundHandler } from "../../middleware/exceptions";
import { queryParserMiddleware } from "../../middleware/query-parser";
import { authApp } from "../../modules/auth";
import type { AuthService } from "../../modules/auth/auth.service";
import { branchesApp } from "../../modules/branches";
import type { BranchesService } from "../../modules/branches/branches.service";
import { businessesApp } from "../../modules/businesses";
import type { BusinessesService } from "../../modules/businesses/businesses.service";
import { demoRequestsApp } from "../../modules/demo-requests";
import type { DemoRequestsService } from "../../modules/demo-requests/demo-requests.service";
import { favouritesApp } from "../../modules/favourites";
import type { FavouritesService } from "../../modules/favourites/favourites.service";
import { notificationsApp } from "../../modules/notifications";
import type { NotificationsService } from "../../modules/notifications/notifications.service";
import { usersApp } from "../../modules/users";
import type { UsersService } from "../../modules/users/users.service";

export interface MockServices {
	authService?: Partial<AuthService>;
	usersService?: Partial<UsersService>;
	businessesService?: Partial<BusinessesService>;
	branchesService?: Partial<BranchesService>;
	notificationsService?: Partial<NotificationsService>;
	favouritesService?: Partial<FavouritesService>;
	demoRequestsService?: Partial<DemoRequestsService>;
	authz?: Partial<AuthorizationService>;
}

export function createTestApp(services: MockServices = {}) {
	const app = createApp({ strict: false });

	app.use("*", corsMiddleware);
	app.use("*", queryParserMiddleware);

	const defaultAuthz = {
		assertBusinessOwner: vi.fn().mockResolvedValue({
			id: "business-1",
			ownerId: "owner-1",
		}),
		assertBranchAccess: vi.fn().mockResolvedValue(undefined),
		assertBranchOwner: vi.fn().mockResolvedValue({
			id: "branch-1",
			businessId: "business-1",
		}),
	};

	app.use("*", async (c, next) => {
		// @ts-expect-error test-only injection
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

	app.get("/api/health", (c) => c.json({ ok: true }));
	app.route("/api/v1/auth", authApp);
	app.route("/api/v1/users", usersApp);
	app.route("/api/v1/businesses", businessesApp);
	app.route("/api/v1/branches", branchesApp);
	app.route("/api/v1/notifications", notificationsApp);
	app.route("/api/v1/favourites", favouritesApp);
	app.route("/api/v1/demo-requests", demoRequestsApp);

	app.notFound(notFoundHandler);
	app.onError(errorHandler);

	return app;
}
