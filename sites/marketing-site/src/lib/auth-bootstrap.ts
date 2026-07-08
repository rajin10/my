import { clearAuthCookies, syncAuthDisplayCookie } from "@repo/api-client";
import { api, tokenStore } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

let hydratePromise: Promise<void> | null = null;

/** Single-flight persist rehydrate — avoids callback vs AuthProvider races. */
export function ensureAuthHydrated(): Promise<void> {
	if (!hydratePromise) {
		hydratePromise = useAuthStore.persist.rehydrate() as Promise<void>;
	}
	return hydratePromise;
}

function isAuthCallbackPath(): boolean {
	return (
		typeof window !== "undefined" &&
		window.location.pathname === "/auth/callback"
	);
}

/**
 * Reconcile zustand auth state with the live token (ADR 0001).
 * Called on app boot and after OAuth callback before a hard navigation.
 */
export async function bootstrapAuthSession(): Promise<void> {
	await ensureAuthHydrated();

	const token = tokenStore.getAccessToken();
	if (!token) {
		// /auth/callback sets tokens moments after mount — do not flash logged-out.
		if (isAuthCallbackPath()) return;

		clearAuthCookies();
		useAuthStore.setState({ user: null, status: "unauthenticated" });
		return;
	}

	if (useAuthStore.getState().user) {
		useAuthStore.setState({ status: "authenticated" });
	}

	try {
		const user = await api.auth.me();
		useAuthStore.getState().setUser(user);
		syncAuthDisplayCookie(user);
	} catch {
		clearAuthCookies();
		tokenStore.clearTokens();
		useAuthStore.setState({ user: null, status: "unauthenticated" });
	}
}
