import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedError } from "../../../core/errors";
import { authHeader, createTestToken, TEST_ENV } from "../../helpers/auth";
import { createTestApp } from "../../helpers/create-test-app";

const mockAuthService = {
	refresh: vi.fn(),
	logout: vi.fn(),
	getUser: vi.fn(),
	getMeProfile: vi.fn(),
	verifyAccountAction: vi.fn(),
	savePushToken: vi.fn(),
	getGoogleAuthUrl: vi.fn(),
	handleGoogleCallback: vi.fn(),
	googleSignIn: vi.fn(),
	register: vi.fn(),
	login: vi.fn(),
	forgotPassword: vi.fn(),
	resetPassword: vi.fn(),
};

const app = createTestApp({ authService: mockAuthService as never });

const fakeTokens = {
	user: {
		id: "user-1",
		email: "user@example.com",
		name: "Test User",
		role: "customer",
	},
	accessToken: "fake.access.token",
	refreshToken: "fake-refresh-token",
	expiresIn: 900,
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("POST /api/v1/auth/refresh", () => {
	it("returns 200 with new tokens", async () => {
		mockAuthService.refresh.mockResolvedValue(fakeTokens);
		const res = await app.request(
			"/api/v1/auth/refresh",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ refreshToken: "old-token" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.accessToken).toBeDefined();
	});

	it("returns 401 on invalid refresh token", async () => {
		mockAuthService.refresh.mockRejectedValue(
			new UnauthorizedError("Invalid refresh token."),
		);
		const res = await app.request(
			"/api/v1/auth/refresh",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ refreshToken: "bad-token" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});
});

describe("POST /api/v1/auth/logout", () => {
	it("returns 401 without token", async () => {
		const res = await app.request(
			"/api/v1/auth/logout",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ refreshToken: "token" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 200 with valid auth", async () => {
		mockAuthService.logout.mockResolvedValue(undefined);
		const token = await createTestToken();
		const res = await app.request(
			"/api/v1/auth/logout",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ refreshToken: "token" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
	});
});

describe("GET /api/v1/auth/me", () => {
	it("returns 401 without token", async () => {
		const res = await app.request("/api/v1/auth/me", {}, TEST_ENV);
		expect(res.status).toBe(401);
	});

	it("returns 200 with current user", async () => {
		mockAuthService.getMeProfile.mockResolvedValue({
			id: "user-1",
			email: "user@example.com",
			name: "Test User",
			role: "customer",
			photoUrl: null,
			authMethods: { password: true, google: false },
		});
		const token = await createTestToken({ userId: "user-1" });
		const res = await app.request(
			"/api/v1/auth/me",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.id).toBe("user-1");
	});

	it("returns 404 when user not found", async () => {
		mockAuthService.getMeProfile.mockResolvedValue(null);
		const token = await createTestToken({ userId: "missing" });
		const res = await app.request(
			"/api/v1/auth/me",
			{ headers: authHeader(token) },
			TEST_ENV,
		);
		expect(res.status).toBe(404);
	});
});

describe("POST /api/v1/auth/push-token", () => {
	it("returns 401 without token", async () => {
		const res = await app.request(
			"/api/v1/auth/push-token",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token: "ExponentPushToken[xxx]" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 200 on success", async () => {
		mockAuthService.savePushToken.mockResolvedValue(undefined);
		const token = await createTestToken();
		const res = await app.request(
			"/api/v1/auth/push-token",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ token: "ExponentPushToken[xxx]" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
	});
});

describe("GET /api/v1/auth/google", () => {
	it("returns 200 with OAuth URL", async () => {
		mockAuthService.getGoogleAuthUrl.mockResolvedValue({
			url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=test",
		});
		const res = await app.request(
			"/api/v1/auth/google?redirect_uri=https://talash.bd/auth/callback",
			{},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.url).toContain("accounts.google.com");
	});

	it("returns 422 when redirect_uri is missing", async () => {
		const res = await app.request("/api/v1/auth/google", {}, TEST_ENV);
		expect(res.status).toBe(422);
	});
});

describe("POST /api/v1/auth/google/token", () => {
	const fakeGoogleTokens = { ...fakeTokens, isNewUser: false };

	it("returns 200 with tokens on success", async () => {
		mockAuthService.googleSignIn.mockResolvedValue(fakeGoogleTokens);
		const res = await app.request(
			"/api/v1/auth/google/token",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ idToken: "valid.google.id.token" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.accessToken).toBeDefined();
		expect(body.isNewUser).toBe(false);
	});

	it("returns 200 with isNewUser true for new accounts", async () => {
		mockAuthService.googleSignIn.mockResolvedValue({
			...fakeGoogleTokens,
			isNewUser: true,
		});
		const res = await app.request(
			"/api/v1/auth/google/token",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ idToken: "valid.google.id.token" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.isNewUser).toBe(true);
	});

	it("returns 401 on invalid Google token", async () => {
		mockAuthService.googleSignIn.mockRejectedValue(
			new UnauthorizedError("Invalid Google ID token signature"),
		);
		const res = await app.request(
			"/api/v1/auth/google/token",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ idToken: "bad.token.here" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("returns 422 when idToken is missing", async () => {
		const res = await app.request(
			"/api/v1/auth/google/token",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(422);
	});
});

describe("POST /api/v1/auth/google/callback", () => {
	it("returns 200 with tokens on success", async () => {
		mockAuthService.handleGoogleCallback.mockResolvedValue(fakeTokens);
		const res = await app.request(
			"/api/v1/auth/google/callback",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					code: "google-auth-code",
					state: "random-state-nonce",
					redirect_uri: "https://talash.bd/auth/callback",
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.accessToken).toBeDefined();
	});

	it("returns 401 on invalid state", async () => {
		mockAuthService.handleGoogleCallback.mockRejectedValue(
			new UnauthorizedError("Invalid or expired OAuth state."),
		);
		const res = await app.request(
			"/api/v1/auth/google/callback",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					code: "bad-code",
					state: "bad-state",
					redirect_uri: "https://talash.bd/auth/callback",
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});
});

describe("POST /api/v1/auth/register", () => {
	it("returns 200 with tokens on success", async () => {
		mockAuthService.register.mockResolvedValue({
			...fakeTokens,
			isNewUser: true,
		});
		const res = await app.request(
			"/api/v1/auth/register",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: "new@example.com",
					password: "password123",
					name: "New User",
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.isNewUser).toBe(true);
		expect(body.accessToken).toBeDefined();
	});
});

describe("POST /api/v1/auth/login", () => {
	it("returns 200 with tokens on success", async () => {
		mockAuthService.login.mockResolvedValue(fakeTokens);
		const res = await app.request(
			"/api/v1/auth/login",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: "user@example.com",
					password: "password123",
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.accessToken).toBeDefined();
	});

	it("returns 401 on invalid credentials", async () => {
		mockAuthService.login.mockRejectedValue(
			new UnauthorizedError("Invalid email or password."),
		);
		const res = await app.request(
			"/api/v1/auth/login",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: "user@example.com",
					password: "wrong",
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});
});

describe("POST /api/v1/auth/forgot-password", () => {
	it("returns 200 with generic message", async () => {
		mockAuthService.forgotPassword.mockResolvedValue({
			message: "If an account exists, a reset link has been sent.",
		});
		const res = await app.request(
			"/api/v1/auth/forgot-password",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: "user@example.com",
					reset_uri: "http://localhost:3000/auth/reset-password",
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
	});
});

describe("POST /api/v1/auth/reset-password", () => {
	it("returns 200 on success", async () => {
		mockAuthService.resetPassword.mockResolvedValue({
			message: "Password updated.",
		});
		const res = await app.request(
			"/api/v1/auth/reset-password",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					token: "reset-token",
					password: "newpassword123",
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
	});

	it("returns 401 on invalid token", async () => {
		mockAuthService.resetPassword.mockRejectedValue(
			new UnauthorizedError("Invalid or expired reset token."),
		);
		const res = await app.request(
			"/api/v1/auth/reset-password",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					token: "bad-token",
					password: "newpassword123",
				}),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});
});
