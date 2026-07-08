import { vi } from "vitest";

vi.mock("@repo/core/src/database/client", () => ({
	getDB: vi.fn(() => ({})),
}));

vi.mock("@repo/core/src/database/repositories/auth.repository", () => {
	class EmailAlreadyRegisteredError extends Error {}
	class GoogleAccountExistsError extends Error {}

	class AuthRepository {
		// refresh flow
		async findRefreshToken() {
			return null;
		}
		// required by rotate() when expiring token; no-op for this test
		async deleteRefreshToken() {}
		// account delete proof path calls these; keep them as stubs
		async findUserById() {
			return null;
		}
		async findCredentialsByUserId() {
			return null;
		}
	}

	return {
		AuthRepository,
		EmailAlreadyRegisteredError,
		GoogleAccountExistsError,
	};
});

vi.mock("@repo/core/src/database/repositories/users.repository", () => {
	class UsersRepository {
		async findOne() {
			return { data: null };
		}
	}
	return { UsersRepository };
});
