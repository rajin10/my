import { AuthRepository } from "@repo/core/src/database/repositories/auth.repository";
import { createApp } from "../../core/create-app";
import { NotFoundError } from "../../core/errors";
import { authenticate } from "../../middleware/auth";
import { rateLimit, rateLimitWhen } from "../../middleware/rate-limit";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import {
	forgotPasswordRoute,
	googleCallbackRoute,
	googleTokenRoute,
	googleUrlRoute,
	loginRoute,
	logoutRoute,
	meRoute,
	pushTokenRoute,
	refreshRoute,
	registerRoute,
	resetPasswordRoute,
} from "./auth.routes";
import { AuthService } from "./auth.service";
import { assertAuthSecrets } from "./auth-env";
import { PasswordEmail } from "./password-email";

export const authApp = createApp();

// Public rate limits — applied before injectServices so KV is available
authApp.use("/refresh", rateLimit({ limit: 30, windowSecs: 60 }));
authApp.use("/register", rateLimit({ limit: 10, windowSecs: 60 }));
authApp.use("/login", rateLimit({ limit: 20, windowSecs: 60 }));
authApp.use("/forgot-password", rateLimit({ limit: 5, windowSecs: 60 }));
authApp.use("/reset-password", rateLimit({ limit: 10, windowSecs: 60 }));
// Cap OAuth URL generation (KV state-nonce writes). Callback is not IP-limited —
// one-time state + Google's one-time code guard the exchange.
authApp.use(
	"/google",
	rateLimitWhen(
		(c) =>
			c.req.method === "GET" &&
			(c.req.path === "/google" || /\/auth\/google$/.test(c.req.path)),
		{ limit: 30, windowSecs: 60 },
	),
);

// Protect specific paths before registering their route handlers
authApp.use("/logout", authenticate);
authApp.use("/me", authenticate);
authApp.use("/push-token", authenticate);

authApp
	.openapi(refreshRoute, async (c) => {
		const { refreshToken } = c.req.valid("json");
		const device = {
			deviceId: c.req.header("X-Device-ID") ?? undefined,
			deviceName: c.req.header("X-Device-Name") ?? undefined,
		};
		const result = await c.var.authService.refresh(refreshToken, device);
		return c.json(result, 200);
	})

	.openapi(logoutRoute, async (c) => {
		const { refreshToken } = c.req.valid("json");
		await c.var.authService.logout(refreshToken, c.var.user.id);
		return c.json({ message: "Logged out" }, 200);
	})

	.openapi(meRoute, async (c) => {
		const profile = await c.var.authService.getMeProfile(c.var.user.id);
		if (!profile) throw new NotFoundError("User not found");
		return c.json(profile, 200);
	})

	.openapi(pushTokenRoute, async (c) => {
		const { token } = c.req.valid("json");
		await c.var.authService.savePushToken(c.var.user.id, token);
		return c.json({ message: "Push token saved" }, 200);
	});

// Google OAuth routes
authApp.use("/google/token", rateLimit({ limit: 20, windowSecs: 60 }));

authApp
	.openapi(googleTokenRoute, async (c) => {
		const { idToken, source } = c.req.valid("json");
		const result = await c.var.authService.googleSignIn(idToken, source);
		return c.json(result, 200);
	})

	.openapi(googleUrlRoute, async (c) => {
		const { redirect_uri, source } = c.req.valid("query");
		const result = await c.var.authService.getGoogleAuthUrl(
			redirect_uri,
			source,
		);
		return c.json(result, 200);
	})

	.openapi(googleCallbackRoute, async (c) => {
		const { code, state } = c.req.valid("json");
		const result = await c.var.authService.handleGoogleCallback(code, state);
		return c.json(result, 200);
	})

	.openapi(registerRoute, async (c) => {
		const { email, password, name, source } = c.req.valid("json");
		const result = await c.var.authService.register(
			email,
			password,
			name,
			source,
		);
		return c.json(result, 200);
	})

	.openapi(loginRoute, async (c) => {
		const { email, password, source } = c.req.valid("json");
		const result = await c.var.authService.login(email, password, source);
		return c.json(result, 200);
	})

	.openapi(forgotPasswordRoute, async (c) => {
		const { email, reset_uri, source } = c.req.valid("json");
		const result = await c.var.authService.forgotPassword(
			email,
			reset_uri,
			source,
		);
		return c.json(result, 200);
	})

	.openapi(resetPasswordRoute, async (c) => {
		const { token, password } = c.req.valid("json");
		const result = await c.var.authService.resetPassword(token, password);
		return c.json(result, 200);
	});

// Session management routes (require auth)
authApp.use("/sessions", authenticate);
authApp.use("/sessions/*", authenticate);

authApp
	.get("/sessions", async (c) => {
		const sessions = await c.var.authService.listSessions(c.var.user.id);
		return c.json(sessions, 200);
	})
	.delete("/sessions/:id", async (c) => {
		const { id } = c.req.param();
		const ok = await c.var.authService.revokeSession(c.var.user.id, id);
		if (!ok)
			return c.json(
				{ ok: false, code: "NOT_FOUND", message: "Session not found" },
				404,
			);
		return c.json({ message: "Session revoked" }, 200);
	});

export const installAuthService: ServiceInstaller = (c, { db, kv, env }) => {
	assertAuthSecrets(env);

	const isLocal =
		env.ENVIRONMENT === "development" || env.ENVIRONMENT === "local";
	const sendEmail = env.TALASH_EMAIL
		? (message: { from: string; to: string; subject: string; text: string }) =>
				env.TALASH_EMAIL?.send(message)
		: undefined;

	return c.set(
		"authService",
		new AuthService(
			new AuthRepository(db),
			kv!,
			env.JWT_SECRET,
			env.GOOGLE_CLIENT_ID,
			env.GOOGLE_CLIENT_SECRET,
			new PasswordEmail(sendEmail, env.EMAIL_FROM, isLocal),
			env.ALLOWED_RESET_URIS,
		),
	);
};
