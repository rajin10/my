import { Colors, DarkColors } from "@repo/tokens";
import { useColorScheme } from "react-native";

// Talash design tokens. Values live in the shared @repo/tokens package
// (single source of truth, kept in sync with theme.css). This file only
// re-exports them and adds the RN-only color-scheme hook.

export {
	Colors,
	type ColorToken,
	DarkColors,
	Radius,
	Shadow,
	type ToneKey,
	Tones,
} from "@repo/tokens";

export function useColors() {
	const scheme = useColorScheme();
	return scheme === "dark" ? DarkColors : Colors;
}
