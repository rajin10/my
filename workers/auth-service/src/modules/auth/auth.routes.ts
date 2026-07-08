import { createRoute } from "@hono/zod-openapi";
import {
	AuthTokensSchema,
	AuthUserSchema,
	ErrorSchema,
	ForgotPasswordBodySchema,
	GoogleAuthTokensSchema,
	GoogleCallbackBodySchema,
	GoogleIdTokenBodySchema,
	GoogleUrlQuerySchema,
	GoogleUrlResponseSchema,
	LoginBodySchema,
	MessageSchema,
	PushTokenBodySchema,
	RefreshBodySchema,
	RegisterBodySchema,
	ResetPasswordBodySchema,
} from "./auth.schemas";

const tag = ["Auth"];

export const refreshRoute = createRoute({
	method: "post",
	path: "/refresh",
	tags: tag,
	summary: "Refresh tokens",
	description:
		"Exchange a valid refresh token for a new access token (and rotated refresh token).",
	request: {
		body: {
			content: { "application/json": { schema: RefreshBodySchema } },
			required: true,
		},
	},
	responses: {
		200: {
			content: { "application/json": { schema: AuthTokensSchema } },
			description: "Tokens refreshed",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Invalid refresh token",
		},
	},
});

export const logoutRoute = createRoute({
	method: "post",
	path: "/logout",
	tags: tag,
	summary: "Logout",
	description: "Invalidate the current refresh token.",
	security: [{ bearerAuth: [] }],
	request: {
		body: {
			content: { "application/json": { schema: RefreshBodySchema } },
			required: true,
		},
	},
	responses: {
		200: {
			content: { "application/json": { schema: MessageSchema } },
			description: "Logged out",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Unauthorized",
		},
	},
});

export const meRoute = createRoute({
	method: "get",
	path: "/me",
	tags: tag,
	summary: "Current user",
	description: "Return the authenticated user's profile.",
	security: [{ bearerAuth: [] }],
	responses: {
		200: {
			content: { "application/json": { schema: AuthUserSchema } },
			description: "Current user",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Unauthorized",
		},
	},
});

export const googleTokenRoute = createRoute({
	method: "post",
	path: "/google/token",
	tags: tag,
	summary: "Sign in with Google (ID token)",
	description:
		"Verify a Google ID token obtained from the client-side OAuth flow and issue Talash access + refresh tokens.",
	request: {
		body: {
			content: { "application/json": { schema: GoogleIdTokenBodySchema } },
			required: true,
		},
	},
	responses: {
		200: {
			content: { "application/json": { schema: GoogleAuthTokensSchema } },
			description: "Authenticated",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Invalid Google token",
		},
		422: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Validation error",
		},
	},
});

export const googleUrlRoute = createRoute({
	method: "get",
	path: "/google",
	tags: tag,
	summary: "Get Google OAuth URL",
	description:
		"Generate a Google OAuth authorization URL. Redirect the user's browser to this URL to begin the sign-in flow.",
	request: {
		query: GoogleUrlQuerySchema,
	},
	responses: {
		200: {
			content: { "application/json": { schema: GoogleUrlResponseSchema } },
			description: "OAuth URL",
		},
		422: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Validation error",
		},
	},
});

export const googleCallbackRoute = createRoute({
	method: "post",
	path: "/google/callback",
	tags: tag,
	summary: "Handle Google OAuth callback",
	description:
		"Exchange the Google authorization code for Talash access + refresh tokens.",
	request: {
		body: {
			content: { "application/json": { schema: GoogleCallbackBodySchema } },
			required: true,
		},
	},
	responses: {
		200: {
			content: { "application/json": { schema: AuthTokensSchema } },
			description: "Authenticated",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Invalid state or code",
		},
		422: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Validation error",
		},
	},
});

export const registerRoute = createRoute({
	method: "post",
	path: "/register",
	tags: tag,
	summary: "Register with email and password",
	description:
		"Create a new account with email and password and issue Talash access + refresh tokens.",
	request: {
		body: {
			content: { "application/json": { schema: RegisterBodySchema } },
			required: true,
		},
	},
	responses: {
		200: {
			content: { "application/json": { schema: GoogleAuthTokensSchema } },
			description: "Registered and authenticated",
		},
		409: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Email already registered",
		},
		422: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Validation error",
		},
	},
});

export const loginRoute = createRoute({
	method: "post",
	path: "/login",
	tags: tag,
	summary: "Sign in with email and password",
	description:
		"Verify email/password credentials and issue Talash access + refresh tokens.",
	request: {
		body: {
			content: { "application/json": { schema: LoginBodySchema } },
			required: true,
		},
	},
	responses: {
		200: {
			content: { "application/json": { schema: AuthTokensSchema } },
			description: "Authenticated",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Invalid credentials",
		},
		422: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Validation error",
		},
	},
});

export const forgotPasswordRoute = createRoute({
	method: "post",
	path: "/forgot-password",
	tags: tag,
	summary: "Request a password reset email",
	description:
		"Send a password reset link to the email if an account exists. Always returns 200.",
	request: {
		body: {
			content: { "application/json": { schema: ForgotPasswordBodySchema } },
			required: true,
		},
	},
	responses: {
		200: {
			content: { "application/json": { schema: MessageSchema } },
			description: "Reset email queued (if account exists)",
		},
		422: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Validation error",
		},
	},
});

export const resetPasswordRoute = createRoute({
	method: "post",
	path: "/reset-password",
	tags: tag,
	summary: "Reset password with token",
	description: "Set a new password using the token from the reset email link.",
	request: {
		body: {
			content: { "application/json": { schema: ResetPasswordBodySchema } },
			required: true,
		},
	},
	responses: {
		200: {
			content: { "application/json": { schema: MessageSchema } },
			description: "Password updated",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Invalid or expired token",
		},
		422: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Validation error",
		},
	},
});

export const pushTokenRoute = createRoute({
	method: "post",
	path: "/push-token",
	tags: ["Auth"],
	summary: "Register push token",
	description: "Store an Expo push token for the authenticated user.",
	request: {
		body: {
			content: { "application/json": { schema: PushTokenBodySchema } },
			required: true,
		},
	},
	responses: {
		200: {
			content: { "application/json": { schema: MessageSchema } },
			description: "Token saved",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Unauthorized",
		},
	},
});
