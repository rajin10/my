import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/stores/auth-store";

const me = vi.fn();
const getAccessToken = vi.fn();
const clearTokens = vi.fn();
const syncAuthDisplayCookie = vi.fn();
const clearAuthCookies = vi.fn();

vi.mock("@repo/api-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@repo/api-client")>();
	return {
		...actual,
		syncAuthDisplayCookie: (...args: unknown[]) =>
			syncAuthDisplayCookie(...args),
		clearAuthCookies: () => clearAuthCookies(),
	};
});

vi.mock("@/lib/api", () => ({
	api: { auth: { me: () => me() } },
	tokenStore: {
		getAccessToken: () => getAccessToken(),
		clearTokens: () => clearTokens(),
	},
}));

import { bootstrapAuthSession } from "../auth-bootstrap";

beforeEach(() => {
	localStorage.clear();
	useAuthStore.setState({ user: null, status: "unknown" });
	me.mockReset();
	getAccessToken.mockReset();
	clearTokens.mockReset();
	syncAuthDisplayCookie.mockReset();
	clearAuthCookies.mockReset();
	vi.stubGlobal("window", {
		location: { pathname: "/" },
	});
});

describe("bootstrapAuthSession", () => {
	it("with no token, settles to unauthenticated and never calls me()", async () => {
		getAccessToken.mockReturnValue(null);
		await bootstrapAuthSession();
		expect(useAuthStore.getState().status).toBe("unauthenticated");
		expect(clearAuthCookies).toHaveBeenCalled();
		expect(me).not.toHaveBeenCalled();
	});

	it("with no token on /auth/callback, stays unknown for the OAuth exchange", async () => {
		vi.stubGlobal("window", {
			location: { pathname: "/auth/callback" },
		});
		getAccessToken.mockReturnValue(null);
		await bootstrapAuthSession();
		expect(useAuthStore.getState().status).toBe("unknown");
		expect(me).not.toHaveBeenCalled();
	});

	it("with a token, calls me() and becomes authenticated", async () => {
		getAccessToken.mockReturnValue("access-123");
		me.mockResolvedValue({
			id: "u1",
			email: null,
			name: "Sara",
			role: "user",
		});
		await bootstrapAuthSession();
		expect(useAuthStore.getState().status).toBe("authenticated");
		expect(useAuthStore.getState().user?.name).toBe("Sara");
		expect(syncAuthDisplayCookie).toHaveBeenCalled();
	});
});
