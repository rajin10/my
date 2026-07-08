import type { BrandPalette } from "@repo/api-client";
import { VariableContextProvider } from "nativewind";
import type { ReactNode } from "react";
import { useBrandPalette } from "../hooks/useOwnerData";
import { paletteToVars } from "../lib/theme-vars";

interface Props {
	// null → no override → Talash defaults (single-tenant owner app with no palette set).
	palette: BrandPalette | null;
	children: ReactNode;
}

// Boundary that overrides the themeable brand custom properties for the owner's
// single-tenant surface (ADR-0002). `VariableContextProvider` is NativeWind v5's
// var-cascade primitive — how custom properties are scoped to a subtree — NOT a
// hand-rolled palette-exposing JS context. Descendant `bg-primary`/`bg-accent`/
// `bg-surface` resolve the overridden values; static roles (ink, line, status) hold.
// Trusts its input — hex validity is enforced server-side at save (#59), never here.
export function ThemeProvider({ palette, children }: Props) {
	if (!palette) {
		return <>{children}</>;
	}
	return (
		<VariableContextProvider value={paletteToVars(palette)}>
			{children}
		</VariableContextProvider>
	);
}

// App-root boundary: reads the owner's saved palette and themes the whole
// single-tenant surface. Mount inside `AppProvider` (which populates the
// `["business", "owner"]` cache `useBrandPalette` reads). No palette → defaults.
export function ThemeBoundary({ children }: { children: ReactNode }) {
	const palette = useBrandPalette();
	return <ThemeProvider palette={palette}>{children}</ThemeProvider>;
}
