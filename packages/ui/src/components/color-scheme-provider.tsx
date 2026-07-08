"use client";

import { ThemeProvider } from "next-themes";

export function ColorSchemeProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<ThemeProvider
			attribute="class"
			defaultTheme="system"
			enableSystem
			disableTransitionOnChange
			storageKey="talash-theme"
		>
			{children}
		</ThemeProvider>
	);
}
