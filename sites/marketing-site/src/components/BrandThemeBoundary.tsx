import type { BrandPalette } from "@repo/api-client";
import type { CSSProperties, ReactNode } from "react";
import { paletteToVars } from "@/lib/theme-vars";

type Props = {
	/** `null` → no override → Talash defaults (the fallback contract). */
	palette: BrandPalette | null;
	children: ReactNode;
	className?: string;
};

/**
 * Web mirror of the mobile `ThemeProvider` boundary (#55, ADR-0002). Overrides
 * the themeable brand custom properties (`--color-primary`/`--color-accent`/
 * `--color-surface`) for a single-tenant subtree via runtime CSS variables on a
 * wrapper; descendants' `bg-primary`/`text-primary`/`bg-accent`/`bg-surface`
 * resolve the overridden values. Static roles (ink/line/status) and everything
 * outside the subtree are untouched.
 *
 * The wrapper is `display: contents` so it adds no layout box — the boundary is
 * purely a variable scope, not a container. Trusts its input; hex validity +
 * WCAG-AA contrast are enforced server-side at save (#59).
 */
export function BrandThemeBoundary({ palette, children, className }: Props) {
	// Render the wrapper unconditionally — `null` simply omits the brand vars
	// (Talash defaults). This keeps the element type stable across an async
	// `null → palette` resolve, so it's a style update, not a Fragment→div
	// remount of the venue subtree (which would re-skeleton + re-fetch).
	return (
		<div
			className={className}
			style={
				{
					display: "contents",
					...(palette ? paletteToVars(palette) : {}),
				} as CSSProperties
			}
		>
			{children}
		</div>
	);
}
