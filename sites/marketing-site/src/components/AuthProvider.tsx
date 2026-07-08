"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { bootstrapAuthSession } from "@/lib/auth-bootstrap";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Owns auth bootstrap and the logout cache-purge. Must render inside
 * QueryClientProvider. See ADR 0001.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
	const queryClient = useQueryClient();

	// Bootstrap once on mount: rehydrate display cache, then reconcile with the
	// token (the sole credential) and revalidate via me().
	useEffect(() => {
		let cancelled = false;

		(async () => {
			await bootstrapAuthSession();
			// OAuth callback finishes with a hard navigation; ignore late async if
			// this effect was torn down during that transition.
			if (cancelled) return;
		})();

		return () => {
			cancelled = true;
		};
	}, []);

	// Purge the query cache whenever the session ends, so one user's cached data
	// (bookings, rewards, …) can't leak to the next on a shared browser.
	useEffect(() => {
		const unsub = useAuthStore.subscribe((state, prev) => {
			if (
				prev.status !== "unauthenticated" &&
				state.status === "unauthenticated"
			) {
				queryClient.clear();
			}
		});
		return unsub;
	}, [queryClient]);

	return <>{children}</>;
}
