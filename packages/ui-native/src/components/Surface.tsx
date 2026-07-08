import { Colors, Radius, Shadow } from "@repo/tokens";
import { View, type ViewProps } from "react-native";

export type SurfaceProps = ViewProps & {
	/** Card-like elevation. Defaults to `none`. */
	elevation?: "none" | "sm" | "md";
};

/**
 * Smoke-test component for `@repo/ui-native` (issue #62).
 *
 * A minimal token-consuming surface: it reads the shared semantic `surface`
 * colour and `radius`/`shadow` scales from `@repo/tokens` and applies them as
 * inline styles — deliberately NOT via NativeWind `className`, since
 * cross-package class scanning is out of scope until #63/#64.
 *
 * This is the end-to-end thread the package needs (package → tokens → app
 * import → render); richer shared components arrive with #63.
 */
export function Surface({ elevation = "none", style, ...rest }: SurfaceProps) {
	return (
		<View
			style={[
				{
					backgroundColor: Colors.surface,
					borderRadius: Radius.md,
				},
				elevation === "sm" && Shadow.sm,
				elevation === "md" && Shadow.md,
				style,
			]}
			{...rest}
		/>
	);
}
