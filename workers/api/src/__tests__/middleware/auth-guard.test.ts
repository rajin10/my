import { OpenAPIHono } from "@hono/zod-openapi";
import { createMiddleware } from "hono/factory";
import { describe, expect, it } from "vitest";
import { authenticate } from "../../middleware/auth";
import { requireAuth } from "../../middleware/auth-guard";
import { errorHandler } from "../../middleware/exceptions";
import type { AppEnv, AuthUser } from "../../types/index";
import { authHeader, createTestToken, TEST_ENV } from "../helpers/auth";

/** Injects a stub AuthorizationService that delegates resolveBranchScope to a
 *  simple fake: owners → null, everyone else → ["branch-1"]. */
const injectStubAuthz = createMiddleware<AppEnv>(async (c, next) => {
	c.set("authz", {
		resolveBranchScope: async (user: AuthUser) =>
			user.role === "owner" ? null : ["branch-1"],
	} as AppEnv["Variables"]["authz"]);
	await next();
});

const injectStubAuthServiceBinding = createMiddleware<AppEnv>(
	async (c, next) => {
		// @ts-expect-error: test-only stub; AUTH_SERVICE is injected via wrangler in prod
		c.env.AUTH_SERVICE = {
			fetch: async (_req: Request | string, init?: RequestInit) => {
				const bodyText =
					typeof init?.body === "string"
						? init.body
						: JSON.stringify(init?.body);
				const parsed = (bodyText ? JSON.parse(bodyText) : {}) as {
					branchScope?: boolean;
				};

				// Mirror auth-service behavior for these tests:
				// branchScope -> owner => null; manager => ["branch-1"].
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
		await next();
	},
);

function makeApp(roles: string[], branchScope = false) {
	const app = new OpenAPIHono<AppEnv>({ strict: false });
	app.use("*", authenticate);
	app.use("*", injectStubAuthz);
	app.use("*", injectStubAuthServiceBinding);
	app.use(
		"*",
		requireAuth(roles, branchScope ? { branchScope: true } : undefined),
	);
	app.get("/test", (c) => {
		const scopedBranchIds = c.var.scopedBranchIds;
		return c.json({
			ok: true,
			scopedBranchIds:
				scopedBranchIds === undefined ? "not-set" : scopedBranchIds,
		});
	});
	app.onError(errorHandler);
	return app;
}

describe("requireAuth — role gate", () => {
	it("returns 401 when there is no Authorization header", async () => {
		const app = makeApp(["owner"]);
		const res = await app.request("/test", {}, TEST_ENV);
		expect(res.status).toBe(401);
	});

	it("returns 403 when the user role is not in the allowed list", async () => {
		const app = makeApp(["owner"]);
		const token = await createTestToken({ role: "manager" });
		const res = await app.request(
			"/test",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("returns 200 when the user role is in the allowed list", async () => {
		const app = makeApp(["owner", "manager"]);
		const token = await createTestToken({ role: "manager" });
		const res = await app.request(
			"/test",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
	});

	it("403 body has FORBIDDEN code and a message string", async () => {
		const app = makeApp(["owner"]);
		const token = await createTestToken({ role: "staff" });
		const res = await app.request(
			"/test",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		const body = (await res.json()) as { code: string; message: string };
		expect(body.code).toBe("FORBIDDEN");
		expect(typeof body.message).toBe("string");
		expect(body.message.length).toBeGreaterThan(0);
	});
});

describe("requireAuth — branchScope option (owner path)", () => {
	it("sets scopedBranchIds to null for the owner role", async () => {
		const app = makeApp(["owner", "manager"], true);
		const token = await createTestToken({ role: "owner" });
		const res = await app.request(
			"/test",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { scopedBranchIds: null | string[] };
		expect(body.scopedBranchIds).toBeNull();
	});

	it("sets scopedBranchIds to the resolved array for a manager role", async () => {
		const app = makeApp(["owner", "manager"], true);
		const token = await createTestToken({ role: "manager" });
		const res = await app.request(
			"/test",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { scopedBranchIds: null | string[] };
		expect(body.scopedBranchIds).toEqual(["branch-1"]);
	});
});
