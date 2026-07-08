import type { AuthUser } from "@repo/api-client";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthInitialProvider } from "@/lib/auth-initial";
import { useAuthStore } from "@/stores/auth-store";
import { useAuth } from "../useAuth";

vi.mock("@/lib/api", () => ({
	api: { auth: { logout: vi.fn().mockResolvedValue(undefined) } },
	tokenStore: { clearTokens: vi.fn() },
}));

const USER: AuthUser = {
	id: "u1",
	email: null,
	name: "Sara",
	role: "user",
	authMethods: { password: false, google: true },
};

function wrapper(initialAuth = { hasSession: false, user: null }) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return (
			<AuthInitialProvider value={initialAuth}>{children}</AuthInitialProvider>
		);
	};
}

beforeEach(() => {
	localStorage.clear();
	useAuthStore.setState({ user: null, status: "unknown" });
});

describe("useAuth", () => {
	it("reports loading while status is unknown", () => {
		const { result } = renderHook(() => useAuth(), { wrapper: wrapper() });
		expect(result.current.isLoading).toBe(true);
		expect(result.current.user).toBeNull();
	});

	it("exposes the user and status once authenticated", () => {
		useAuthStore.getState().setUser(USER);
		const { result } = renderHook(() => useAuth(), { wrapper: wrapper() });
		expect(result.current.user).toEqual(USER);
		expect(result.current.status).toBe("authenticated");
		expect(result.current.isLoading).toBe(false);
	});

	it("is not loading when unauthenticated", () => {
		useAuthStore.setState({ user: null, status: "unauthenticated" });
		const { result } = renderHook(() => useAuth(), { wrapper: wrapper() });
		expect(result.current.isLoading).toBe(false);
	});

	it("uses SSR session hint while the store is still unknown", () => {
		const { result } = renderHook(() => useAuth(), {
			wrapper: wrapper({ hasSession: true, user: USER }),
		});
		expect(result.current.status).toBe("authenticated");
		expect(result.current.user).toEqual(USER);
		expect(result.current.isLoading).toBe(false);
	});
});
