import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError, ValidationError } from "../../../core/errors";
import { AuthService } from "../../../modules/auth/auth.service";
import { PasswordEmail } from "../../../modules/auth/password-email";
import { PasswordIdentity } from "../../../modules/auth/password-identity";

const mockRepo = {
	findUserById: vi.fn(),
	findCredentialsByUserId: vi.fn(),
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
		new PasswordEmail(undefined, undefined, true),
		undefined,
	);
}

const fakeUser = {
	id: "user-1",
	email: "user@example.com",
	name: "Test User",
	role: "user",
	googleId: "google-sub-123",
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("AuthService.getMeProfile", () => {
	it("returns auth method flags", async () => {
		mockRepo.findUserById.mockResolvedValue(fakeUser);
		mockRepo.findCredentialsByUserId.mockResolvedValue({
			passwordHash: "pbkdf2:100000:abc:def",
		});

		const profile = await makeService().getMeProfile("user-1");
		expect(profile).toEqual({
			id: "user-1",
			email: "user@example.com",
			name: "Test User",
			role: "user",
			photoUrl: null,
			authMethods: { password: true, google: true },
		});
	});

	it("returns null when user is missing", async () => {
		mockRepo.findUserById.mockResolvedValue(null);
		expect(await makeService().getMeProfile("missing")).toBeNull();
	});
});

describe("AuthService.verifyAccountAction", () => {
	const identity = new PasswordIdentity();

	it("accepts a valid password", async () => {
		const hash = await identity.hash("password123");
		mockRepo.findUserById.mockResolvedValue({ ...fakeUser, googleId: null });
		mockRepo.findCredentialsByUserId.mockResolvedValue({ passwordHash: hash });

		await expect(
			makeService().verifyAccountAction("user-1", {
				password: "password123",
			}),
		).resolves.toBeUndefined();
	});

	it("rejects a wrong password", async () => {
		const hash = await identity.hash("password123");
		mockRepo.findUserById.mockResolvedValue(fakeUser);
		mockRepo.findCredentialsByUserId.mockResolvedValue({ passwordHash: hash });

		await expect(
			makeService().verifyAccountAction("user-1", { password: "wrong" }),
		).rejects.toThrow(ValidationError);
	});

	it("rejects password verification when no password is set", async () => {
		mockRepo.findUserById.mockResolvedValue({ ...fakeUser, googleId: null });
		mockRepo.findCredentialsByUserId.mockResolvedValue(null);

		await expect(
			makeService().verifyAccountAction("user-1", { password: "secret" }),
		).rejects.toThrow(ValidationError);
	});

	it("rejects Google verification when Google is not linked", async () => {
		mockRepo.findUserById.mockResolvedValue({ ...fakeUser, googleId: null });

		await expect(
			makeService().verifyAccountAction("user-1", { idToken: "token" }),
		).rejects.toThrow(ValidationError);
	});

	it("throws when user is missing", async () => {
		mockRepo.findUserById.mockResolvedValue(null);
		await expect(
			makeService().verifyAccountAction("missing", { password: "x" }),
		).rejects.toThrow(NotFoundError);
	});
});
