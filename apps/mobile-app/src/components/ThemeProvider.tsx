import { VariableContextProvider } from "nativewind";
import type { ReactNode } from "react";
import { type BrandPalette, paletteToVars } from "../lib/theme-vars";

interface Props {
	// null → no override → Talash defaults (the fallback contract #60/#61 rely on).
	palette: BrandPalette | null;
	children: ReactNode;
}

// Boundary that overrides the themeable brand custom properties for a single-tenant
// subtree (ADR-0002). `VariableContextProvider` is NativeWind v5's var-cascade
// primitive — how custom properties are scoped to a subtree — NOT a hand-rolled
// palette-exposing JS context (the spec's "no React context" rules out the latter:
// adding our own context for gradients/status bar to read the active palette).
// Descendant `bg-primary`/`bg-accent`/`bg-surface` resolve the overridden values;
// everything outside the subtree and all static roles (ink, line, status) inside it
// are untouched. Trusts its input — hex validity is enforced server-side at save
// (#59), never here.
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
