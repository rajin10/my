import { z } from "@hono/zod-openapi";
import { SignInSource } from "./sign-in-source";

const SignInSourceSchema = z.nativeEnum(SignInSource).optional().openapi({
	description:
		"Origin of the sign-in. Decides which account role is provisioned: marketing-site / mobile-app -> user, business-app -> owner. Defaults to mobile-app (user).",
	example: "mobile-app",
});

export const RefreshBodySchema = z
	.object({
		refreshToken: z
			.string()
			.min(1)
			.openapi({ description: "Refresh token from a previous verify call" }),
	})
	.openapi("RefreshBody");

// ---- Response schemas ----

export const AuthMethodsSchema = z
	.object({
		password: z.boolean().openapi({
			description: "Whether the account has an email/password credential",
		}),
		google: z.boolean().openapi({
			description: "Whether the account is linked to Google sign-in",
		}),
	})
	.openapi("AuthMethods");

export const AuthUserSchema = z
	.object({
		id: z.string().openapi({ example: "01930000-0000-0000-0000-000000000000" }),
		email: z.string().nullable().openapi({ example: "user@example.com" }),
		name: z.string().openapi({ example: "Sara Khan" }),
		role: z.string().openapi({ example: "user" }),
		photoUrl: z.string().nullable().optional(),
		authMethods: AuthMethodsSchema.optional(),
	})
	.openapi("AuthUser");

export const AuthTokensSchema = z
	.object({
		user: AuthUserSchema,
		accessToken: z.string(),
		refreshToken: z.string(),
		expiresIn: z
			.number()
			.openapi({ description: "Access token lifetime in seconds" }),
	})
	.openapi("AuthTokens");

export const MessageSchema = z
	.object({ message: z.string() })
	.openapi("Message");

export const ErrorSchema = z
	.object({
		ok: z.literal(false),
		code: z.string().openapi({ example: "UNAUTHORIZED" }),
		message: z.string().openapi({ example: "Invalid OTP code" }),
	})
	.openapi("Error");

export const PushTokenBodySchema = z
	.object({
		token: z
			.string()
			.min(1)
			.openapi({ example: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" }),
	})
	.openapi("PushTokenBody");

export const GoogleIdTokenBodySchema = z
	.object({
		idToken: z.string().min(1).openapi({
			description: "Google ID token obtained from the client-side OAuth flow",
		}),
		source: SignInSourceSchema,
	})
	.openapi("GoogleIdTokenBody");

export const GoogleAuthTokensSchema = AuthTokensSchema.extend({
	isNewUser: z.boolean().openapi({
		description: "True when the Google account was just created in Talash",
	}),
}).openapi("GoogleAuthTokens");

export const GoogleUrlQuerySchema = z
	.object({
		redirect_uri: z
			.string()
			.url()
			.openapi({ example: "https://talash.mahannankhan.info/auth/callback" }),
		source: SignInSourceSchema,
	})
	.openapi("GoogleUrlQuery");

export const GoogleUrlResponseSchema = z
	.object({ url: z.string().url() })
	.openapi("GoogleUrlResponse");

export const GoogleCallbackBodySchema = z
	.object({
		code: z
			.string()
			.min(1)
			.openapi({ description: "Authorization code from Google" }),
		state: z
			.string()
			.min(1)
			.openapi({ description: "State nonce returned by Google" }),
		redirect_uri: z.string().url().openapi({
			description: "Must match the redirect_uri used to initiate the flow",
		}),
	})
	.openapi("GoogleCallbackBody");

export const RegisterBodySchema = z
	.object({
		email: z.string().email().openapi({ example: "user@example.com" }),
		password: z
			.string()
			.min(8)
			.openapi({ example: "password123", description: "Minimum 8 characters" }),
		name: z.string().min(1).openapi({ example: "Sara Khan" }),
		source: SignInSourceSchema,
	})
	.openapi("RegisterBody");

export const LoginBodySchema = z
	.object({
		email: z.string().email().openapi({ example: "user@example.com" }),
		password: z.string().min(1).openapi({ example: "password123" }),
		source: SignInSourceSchema,
	})
	.openapi("LoginBody");

export const ForgotPasswordBodySchema = z
	.object({
		email: z.string().email().openapi({ example: "user@example.com" }),
		reset_uri: z.string().min(1).openapi({
			example: "https://talash.mahannankhan.info/auth/reset-password",
			description:
				"Client-specific reset page URI; must match ALLOWED_RESET_URIS",
		}),
		source: SignInSourceSchema,
	})
	.openapi("ForgotPasswordBody");

export const ResetPasswordBodySchema = z
	.object({
		token: z
			.string()
			.min(1)
			.openapi({ description: "Reset token from email link" }),
		password: z.string().min(8).openapi({
			example: "newpassword123",
			description: "Minimum 8 characters",
		}),
	})
	.openapi("ResetPasswordBody");
