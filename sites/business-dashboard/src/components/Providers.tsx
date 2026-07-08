"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { ColorSchemeProvider } from "@repo/ui";
import { QueryClientProvider } from "@tanstack/react-query";
import { useRef } from "react";
import { makeQueryClient } from "../lib/query-client";

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export function Providers({ children }: { children: React.ReactNode }) {
	const clientRef = useRef<ReturnType<typeof makeQueryClient> | null>(null);
	if (!clientRef.current) clientRef.current = makeQueryClient();

	const tree = (
		<QueryClientProvider client={clientRef.current}>
			<ColorSchemeProvider>{children}</ColorSchemeProvider>
		</QueryClientProvider>
	);

	if (!googleClientId) return tree;

	return (
		<GoogleOAuthProvider clientId={googleClientId}>{tree}</GoogleOAuthProvider>
	);
}
