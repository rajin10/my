import { sign } from "hono/jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedError } from "../../../core/errors";
import { SessionTokens } from "../../../modules/auth/session-tokens";

const SECRET = "test-jwt-secret";

const mockRepo = {
	createRefreshToken: vi.fn(),
	findRefreshToken: vi.fn(),
	deleteRefreshToken: vi.fn(),
	findUserById: vi.fn(),
};

function makeSessionTokens() {
	return new SessionTokens(mockRepo as never, SECRET);
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

describe("SessionTokens.issue → verify round-trip", () => {
	it("issues an access token that verify accepts and maps to AuthUser", async () => {
		mockRepo.createRefreshToken.mockResolvedValue(undefined);
		const tokens = makeSessionTokens();

		const issued = await tokens.issue(fakeUser);

		expect(issued.accessToken).toBeDefined();
		expect(issued.refreshToken).toBeDefined();
		expect(issued.expiresIn).toBe(60 * 15); // 15 min access TTL

		const authUser = await SessionTokens.verify(issued.accessToken, SECRET);
		expect(authUser).toEqual({
			id: fakeUser.id,
			email: fakeUser.email,
			name: fakeUser.name,
			role: fakeUser.role,
		});
	});

	it("persists a refresh token with a 30-day expiry", async () => {
		mockRepo.createRefreshToken.mockResolvedValue(undefined);
		const tokens = makeSessionTokens();

		const before = Date.now();
		const issued = await tokens.issue(fakeUser, { deviceId: "d-1" });

		expect(mockRepo.createRefreshToken).toHaveBeenCalledOnce();
		const [userId, refreshToken, expiresAt, device] =
			mockRepo.createRefreshToken.mock.calls[0]!;
		expect(userId).toBe(fakeUser.id);
		expect(refreshToken).toBe(issued.refreshToken);
		expect(device).toEqual({ deviceId: "d-1" });

		const expiryMs = new Date(expiresAt as string).getTime();
		const thirtyDaysMs = 60 * 60 * 24 * 30 * 1000;
		// Allow a small skew window around the 30-day mark
		expect(expiryMs - before).toBeGreaterThan(thirtyDaysMs - 5_000);
		expect(expiryMs - before).toBeLessThan(thirtyDaysMs + 5_000);
	});
});

describe("SessionTokens.verify rejects bad tokens", () => {
	it("rejects an expired access token", async () => {
		// Hand-sign a payload whose exp is in the past
		const expired = await sign(
			{
				sub: fakeUser.id,
				email: fakeUser.email,
				name: fakeUser.name,
				role: fakeUser.role,
				exp: Math.floor(Date.now() / 1000) - 60,
			},
			SECRET,
		);

		await expect(SessionTokens.verify(expired, SECRET)).rejects.toThrow(
			UnauthorizedError,
		);
		await expect(SessionTokens.verify(expired, SECRET)).rejects.toThrow(
			"Invalid or expired token.",
		);
	});

	it("rejects a token signed with the wrong secret", async () => {
		const token = await sign(
			{
				sub: fakeUser.id,
				email: fakeUser.email,
				name: fakeUser.name,
				role: fakeUser.role,
				exp: Math.floor(Date.now() / 1000) + 3600,
			},
			"a-different-secret",
		);

		await expect(SessionTokens.verify(token, SECRET)).rejects.toThrow(
			UnauthorizedError,
		);
	});

	it("rejects a malformed token", async () => {
		await expect(SessionTokens.verify("not-a-jwt", SECRET)).rejects.toThrow(
			UnauthorizedError,
		);
	});
});

describe("SessionTokens.rotate", () => {
	it("issues a new refresh token then invalidates the old one", async () => {
		mockRepo.findRefreshToken.mockResolvedValue({
			userId: fakeUser.id,
			expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
			deviceId: "d-1",
			deviceName: "Phone",
		});
		mockRepo.findUserById.mockResolvedValue(fakeUser);
		mockRepo.createRefreshToken.mockResolvedValue(undefined);
		mockRepo.deleteRefreshToken.mockResolvedValue(undefined);

		const tokens = makeSessionTokens();
		const result = await tokens.rotate("old-token");

		// A brand-new refresh token is returned, different from the old one
		expect(result.refreshToken).toBeDefined();
		expect(result.refreshToken).not.toBe("old-token");
		expect(result.user.id).toBe(fakeUser.id);

		// The old token is deleted, scoped to the owning user
		expect(mockRepo.deleteRefreshToken).toHaveBeenCalledWith(
			"old-token",
			fakeUser.id,
		);

		// Trade-off contract: new token is created BEFORE the old one is deleted
		const createOrder =
			mockRepo.createRefreshToken.mock.invocationCallOrder[0]!;
		const deleteOrder =
			mockRepo.deleteRefreshToken.mock.invocationCallOrder[0]!;
		expect(createOrder).toBeLessThan(deleteOrder);
	});

	it("carries the stored device info forward when none is supplied", async () => {
		mockRepo.findRefreshToken.mockResolvedValue({
			userId: fakeUser.id,
			expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
			deviceId: "stored-device",
			deviceName: "Stored Phone",
		});
		mockRepo.findUserById.mockResolvedValue(fakeUser);
		mockRepo.createRefreshToken.mockResolvedValue(undefined);
		mockRepo.deleteRefreshToken.mockResolvedValue(undefined);

		const tokens = makeSessionTokens();
		await tokens.rotate("old-token");

		const device = mockRepo.createRefreshToken.mock.calls[0]?.[3];
		expect(device).toEqual({
			deviceId: "stored-device",
			deviceName: "Stored Phone",
		});
	});

	it("throws when the refresh token is not found", async () => {
		mockRepo.findRefreshToken.mockResolvedValue(null);
		const tokens = makeSessionTokens();
		await expect(tokens.rotate("bad-token")).rejects.toThrow(UnauthorizedError);
		expect(mockRepo.createRefreshToken).not.toHaveBeenCalled();
	});

	it("throws and deletes the token when it is expired", async () => {
		mockRepo.findRefreshToken.mockResolvedValue({
			userId: fakeUser.id,
			expiresAt: new Date(Date.now() - 1000).toISOString(),
		});
		mockRepo.deleteRefreshToken.mockResolvedValue(undefined);
		const tokens = makeSessionTokens();
		await expect(tokens.rotate("expired-token")).rejects.toThrow(
			UnauthorizedError,
		);
		expect(mockRepo.deleteRefreshToken).toHaveBeenCalledWith(
			"expired-token",
			fakeUser.id,
		);
		expect(mockRepo.createRefreshToken).not.toHaveBeenCalled();
	});

	it("throws when the user no longer exists", async () => {
		mockRepo.findRefreshToken.mockResolvedValue({
			userId: "ghost-user",
			expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
		});
		mockRepo.findUserById.mockResolvedValue(null);
		const tokens = makeSessionTokens();
		await expect(tokens.rotate("valid-token")).rejects.toThrow(
			UnauthorizedError,
		);
		expect(mockRepo.createRefreshToken).not.toHaveBeenCalled();
	});
});
