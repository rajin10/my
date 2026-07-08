"use client";
import { authCallbackErrorParam } from "@repo/api-client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { api, tokenStore } from "@/lib/api";
import { bootstrapAuthSession, ensureAuthHydrated } from "@/lib/auth-bootstrap";

export default function AuthCallbackPage() {
	const router = useRouter();
	const ran = useRef(false);

	useEffect(() => {
		if (ran.current) return;
		ran.current = true;

		(async () => {
			await ensureAuthHydrated();

			const params = new URLSearchParams(window.location.search);
			const code = params.get("code");
			const state = params.get("state");

			if (!code || !state) {
				router.replace("/login?error=missing_params");
				return;
			}

			const redirectUri = `${window.location.origin}/auth/callback`;
			const next = sessionStorage.getItem("auth_next") ?? "/";
			sessionStorage.removeItem("auth_next");

			try {
				const tokens = await api.auth.googleCallback({
					code,
					state,
					redirect_uri: redirectUri,
				});
				await tokenStore.setTokens(tokens.accessToken, tokens.refreshToken);
				await bootstrapAuthSession();
				// Hard navigation so AuthProvider bootstraps with tokens already set
				// (client-side router.replace left the header on "Sign in").
				window.location.replace(next);
			} catch (error) {
				router.replace(`/login?error=${authCallbackErrorParam(error)}`);
			}
		})();
	}, [router]);

	return (
		<div className="min-h-screen flex items-center justify-center bg-paper">
			<div className="flex flex-col items-center gap-3">
				<div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
				<p className="font-sans text-sm text-ink-500">Signing you in…</p>
			</div>
		</div>
	);
}
