import type { ApiClient } from "../client";
import type {
	AuthTokens,
	AuthUser,
	GoogleAuthResponse,
	SignInSource,
} from "../types";

export interface SessionInfo {
	id: string;
	deviceId: string | null;
	deviceName: string | null;
	createdAt: string;
	lastUsedAt: string;
	expiresAt: string;
}

export function createAuthEndpoints(client: ApiClient) {
	return {
		googleSignIn: (body: { idToken: string; source?: SignInSource }) =>
			client.post<GoogleAuthResponse>("/api/v1/auth/google/token", body),

		refresh: (body: { refreshToken: string }) =>
			client.post<{ accessToken: string; refreshToken: string }>(
				"/api/v1/auth/refresh",
				body,
			),

		logout: () => client.post<{ message: string }>("/api/v1/auth/logout", {}),

		me: () => client.get<AuthUser>("/api/v1/auth/me"),

		registerPushToken: (token: string) =>
			client.post<{ message: string }>("/api/v1/auth/push-token", { token }),

		getGoogleUrl: (redirectUri: string, source?: SignInSource) =>
			client.get<{ url: string }>(
				`/api/v1/auth/google?redirect_uri=${encodeURIComponent(redirectUri)}${
					source ? `&source=${source}` : ""
				}`,
			),

		googleCallback: (body: {
			code: string;
			state: string;
			redirect_uri: string;
		}) => client.post<AuthTokens>("/api/v1/auth/google/callback", body),

		register: (body: {
			email: string;
			password: string;
			name: string;
			source?: SignInSource;
		}) => client.post<GoogleAuthResponse>("/api/v1/auth/register", body),

		login: (body: { email: string; password: string; source?: SignInSource }) =>
			client.post<AuthTokens>("/api/v1/auth/login", body),

		forgotPassword: (body: {
			email: string;
			reset_uri: string;
			source?: SignInSource;
		}) =>
			client.post<{ message: string }>("/api/v1/auth/forgot-password", body),

		resetPassword: (body: { token: string; password: string }) =>
			client.post<{ message: string }>("/api/v1/auth/reset-password", body),

		listSessions: () => client.get<SessionInfo[]>("/api/v1/auth/sessions"),

		revokeSession: (id: string) =>
			client.delete<{ message: string }>(`/api/v1/auth/sessions/${id}`),
	};
}
