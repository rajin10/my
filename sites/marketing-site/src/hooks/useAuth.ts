"use client";
import { useCallback } from "react";
import { api } from "@/lib/api";
import { useAuthInitial } from "@/lib/auth-initial";
import { type AuthStatus, useAuthStore } from "@/stores/auth-store";

export function useAuth(): {
	user: ReturnType<typeof useAuthStore.getState>["user"];
	status: AuthStatus;
	isLoading: boolean;
	signOut: () => Promise<void>;
} {
	const initial = useAuthInitial();
	const storeUser = useAuthStore((s) => s.user);
	const storeStatus = useAuthStore((s) => s.status);

	const user = storeUser ?? initial.user;
	const status: AuthStatus =
		storeStatus !== "unknown"
			? storeStatus
			: initial.hasSession
				? "authenticated"
				: "unauthenticated";

	// Best-effort server logout, then clear local state and hard-reset to home.
	// The hard navigation matches prior behaviour and guarantees a clean slate;
	// AuthProvider's subscription also clears the query cache on the transition.
	const signOut = useCallback(async () => {
		try {
			await api.auth.logout();
		} catch {
			/* ignore — local clear below is what matters */
		}
		useAuthStore.getState().signOut();
		if (typeof window !== "undefined") window.location.href = "/";
	}, []);

	return {
		user,
		status,
		isLoading: storeStatus === "unknown" && !initial.hasSession,
		signOut,
	};
}
