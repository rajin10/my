import type { AuthUser } from "@repo/api-client";
import { webTokenStore } from "@repo/api-client";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export type AuthStatus = "unknown" | "authenticated" | "unauthenticated";

export interface AuthState {
	/** Display cache. Never trusted without a live token (see ADR 0001). */
	user: AuthUser | null;
	status: AuthStatus;
	/** Mark the session authenticated with a confirmed/optimistic user. */
	setUser: (user: AuthUser) => void;
	/** Clear credential + identity. Pure: no React, no navigation, no cache. */
	signOut: () => void;
}

export const useAuthStore = create<AuthState>()(
	devtools(
		persist(
			(set) => ({
				user: null,
				status: "unknown",
				setUser: (user) => set({ user, status: "authenticated" }),
				signOut: () => {
					webTokenStore.clearTokens();
					set({ user: null, status: "unauthenticated" });
				},
			}),
			{
				name: "talash-auth",
				// Persist only the display cache; status is recomputed on boot.
				partialize: (s) => ({ user: s.user }),
				// Next.js: do not auto-hydrate during render. AuthProvider rehydrates
				// in an effect so the server and first client render both show `unknown`.
				skipHydration: true,
			},
		),
		{ name: "auth-store", enabled: process.env.NODE_ENV === "development" },
	),
);
