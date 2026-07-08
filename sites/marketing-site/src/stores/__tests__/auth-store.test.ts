import type { AuthUser } from "@repo/api-client";
import { webTokenStore } from "@repo/api-client";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "../auth-store";

const USER: AuthUser = {
	id: "u1",
	email: "sara@example.com",
	name: "Sara Khan",
	role: "user",
	authMethods: { password: true, google: false },
};

beforeEach(() => {
	// Reset the singleton store + persisted state between tests.
	localStorage.clear();
	useAuthStore.setState({ user: null, status: "unknown" });
});

describe("auth-store", () => {
	it("starts in the unknown state with no user", () => {
		const s = useAuthStore.getState();
		expect(s.user).toBeNull();
		expect(s.status).toBe("unknown");
	});

	it("setUser marks the session authenticated", () => {
		useAuthStore.getState().setUser(USER);
		const s = useAuthStore.getState();
		expect(s.user).toEqual(USER);
		expect(s.status).toBe("authenticated");
	});

	it("signOut clears the user, marks unauthenticated, and clears tokens", async () => {
		await webTokenStore.setTokens("access-123", "refresh-123");
		useAuthStore.getState().setUser(USER);

		useAuthStore.getState().signOut();

		const s = useAuthStore.getState();
		expect(s.user).toBeNull();
		expect(s.status).toBe("unauthenticated");
		expect(webTokenStore.getAccessToken()).toBeNull();
	});
});
