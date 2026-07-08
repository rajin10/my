"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import type { AuthInitialState } from "@repo/api-client";
import { ColorSchemeProvider } from "@repo/ui";
import { QueryClientProvider } from "@tanstack/react-query";
import { useRef } from "react";
import { AuthInitialProvider } from "../lib/auth-initial";
import { makeQueryClient } from "../lib/query-client";
import { AuthProvider } from "./AuthProvider";

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export function Providers({
	children,
	initialAuth,
}: {
	children: React.ReactNode;
	initialAuth: AuthInitialState;
}) {
	const clientRef = useRef<ReturnType<typeof makeQueryClient> | null>(null);
	if (!clientRef.current) clientRef.current = makeQueryClient();

	const tree = (
		<QueryClientProvider client={clientRef.current}>
			<ColorSchemeProvider>
				<AuthInitialProvider value={initialAuth}>
					<AuthProvider>{children}</AuthProvider>
				</AuthInitialProvider>
			</ColorSchemeProvider>
		</QueryClientProvider>
	);

	if (!googleClientId) return tree;

	return (
		<GoogleOAuthProvider clientId={googleClientId}>{tree}</GoogleOAuthProvider>
	);
}
