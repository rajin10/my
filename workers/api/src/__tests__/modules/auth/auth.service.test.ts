import { beforeEach, describe, expect, it, vi } from "vitest";
import { InternalError, UnauthorizedError } from "../../../core/errors";
import { AuthService } from "../../../modules/auth/auth.service";

const mockRepo = {
	findOrCreateUserByGoogle: vi.fn(),
	findRefreshToken: vi.fn(),
	deleteRefreshToken: vi.fn(),
	findUserById: vi.fn(),
	createRefreshToken: vi.fn(),
	savePushToken: vi.fn(),
};

const mockKv = {
	delete: vi.fn(),
	get: vi.fn(),
	put: vi.fn(),
} as unknown as KVNamespace;

function makeService() {
	return new AuthService(
		mockRepo as never,
		mockKv,
		"test-jwt-secret",
		"test-google-client-id",
		"test-google-client-secret",
	);
}

function makeServiceWithGoogleConfig(googleClientId: string) {
	return new AuthService(
		mockRepo as never,
		mockKv,
		"test-jwt-secret",
		googleClientId,
		"test-google-client-secret",
	);
}

const fakeUser = {
	id: "user-1",
	email: "user@example.com",
	name: "Test User",
	role: "customer",
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("AuthService.refresh", () => {
	it("returns new tokens on valid refresh token", async () => {
		mockRepo.findRefreshToken.mockResolvedValue({
			userId: "user-1",
			expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
		});
		mockRepo.deleteRefreshToken.mockResolvedValue(undefined);
		mockRepo.findUserById.mockResolvedValue(fakeUser);
		mockRepo.createRefreshToken.mockResolvedValue(undefined);

		const svc = makeService();
		const result = await svc.refresh("old-token");
		expect(result.user.id).toBe("user-1");
		expect(result.accessToken).toBeDefined();
		expect(mockRepo.deleteRefreshToken).toHaveBeenCalledWith(
			"old-token",
			"user-1",
		);
	});

	it("throws UnauthorizedError when token not found", async () => {
		mockRepo.findRefreshToken.mockResolvedValue(null);
		const svc = makeService();
		await expect(svc.refresh("bad-token")).rejects.toThrow(UnauthorizedError);
	});

	it("throws UnauthorizedError when token is expired", async () => {
		mockRepo.findRefreshToken.mockResolvedValue({
			userId: "user-1",
			expiresAt: new Date(Date.now() - 1000).toISOString(),
		});
		mockRepo.deleteRefreshToken.mockResolvedValue(undefined);
		const svc = makeService();
		await expect(svc.refresh("expired-token")).rejects.toThrow(
			UnauthorizedError,
		);
	});

	it("throws UnauthorizedError when user no longer exists", async () => {
		mockRepo.findRefreshToken.mockResolvedValue({
			userId: "ghost-user",
			expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
		});
		mockRepo.deleteRefreshToken.mockResolvedValue(undefined);
		mockRepo.findUserById.mockResolvedValue(null);
		const svc = makeService();
		await expect(svc.refresh("valid-token")).rejects.toThrow(UnauthorizedError);
	});
});

describe("AuthService.logout", () => {
	it("deletes the refresh token scoped to the authenticated user", async () => {
		mockRepo.deleteRefreshToken.mockResolvedValue(undefined);
		const svc = makeService();
		await svc.logout("some-token", "user-1");
		expect(mockRepo.deleteRefreshToken).toHaveBeenCalledWith(
			"some-token",
			"user-1",
		);
	});
});

describe("AuthService.getUser", () => {
	it("returns user from repository", async () => {
		mockRepo.findUserById.mockResolvedValue(fakeUser);
		const svc = makeService();
		const result = await svc.getUser("user-1");
		expect(result).toEqual(fakeUser);
	});

	it("returns null when user not found", async () => {
		mockRepo.findUserById.mockResolvedValue(null);
		const svc = makeService();
		const result = await svc.getUser("missing");
		expect(result).toBeNull();
	});
});

describe("AuthService.googleSignIn", () => {
	const svc = makeService();

	it("throws UnauthorizedError when idToken has wrong number of parts", async () => {
		await expect(svc.googleSignIn("not.a.valid.jwt")).rejects.toThrow(
			"Invalid Google ID token format",
		);
	});

	it("throws UnauthorizedError when idToken has only two parts", async () => {
		await expect(svc.googleSignIn("header.payload")).rejects.toThrow(
			"Invalid Google ID token format",
		);
	});

	it("throws UnauthorizedError when token is expired", async () => {
		// Build a minimally-valid JWT structure with an expired exp
		const header = btoa(JSON.stringify({ alg: "RS256", kid: "key1" }));
		const payload = btoa(
			JSON.stringify({
				iss: "accounts.google.com",
				sub: "google-123",
				aud: "test-google-client-id",
				exp: Math.floor(Date.now() / 1000) - 3600,
				email: "user@example.com",
				name: "Test User",
			}),
		);
		await expect(svc.googleSignIn(`${header}.${payload}.sig`)).rejects.toThrow(
			"Google ID token expired",
		);
	});

	it("throws UnauthorizedError when issuer is invalid", async () => {
		const header = btoa(JSON.stringify({ alg: "RS256", kid: "key1" }));
		const payload = btoa(
			JSON.stringify({
				iss: "evil.example.com",
				sub: "google-123",
				aud: "test-google-client-id",
				exp: Math.floor(Date.now() / 1000) + 3600,
			}),
		);
		await expect(svc.googleSignIn(`${header}.${payload}.sig`)).rejects.toThrow(
			"Invalid Google token issuer",
		);
	});

	it("throws UnauthorizedError when audience is not in the allowed list", async () => {
		const header = btoa(JSON.stringify({ alg: "RS256", kid: "key1" }));
		const payload = btoa(
			JSON.stringify({
				iss: "accounts.google.com",
				sub: "google-123",
				aud: "other-client-id.apps.googleusercontent.com",
				exp: Math.floor(Date.now() / 1000) + 3600,
			}),
		);
		await expect(svc.googleSignIn(`${header}.${payload}.sig`)).rejects.toThrow(
			"Invalid Google token audience",
		);
	});

	it("throws InternalError when Google client id is not configured", async () => {
		const misconfiguredSvc = makeServiceWithGoogleConfig("");
		const header = btoa(JSON.stringify({ alg: "RS256", kid: "key1" }));
		const payload = btoa(
			JSON.stringify({
				iss: "accounts.google.com",
				sub: "google-123",
				aud: "test-google-client-id",
				exp: Math.floor(Date.now() / 1000) + 3600,
			}),
		);

		await expect(
			misconfiguredSvc.googleSignIn(`${header}.${payload}.sig`),
		).rejects.toThrow(InternalError);
	});
});
