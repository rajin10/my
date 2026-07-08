import { Text, View } from "react-native";

type Props = {
	message: string;
	tone?: "lan" | "offline";
};

const TONE_STYLES = {
	lan: { bg: "#FEF3C7", fg: "#92400E", border: "#FCD34D" },
	offline: { bg: "#FEE2E2", fg: "#991B1B", border: "#FCA5A5" },
} as const;

/** Amber when on shop LAN without internet; red when neither LAN nor internet. */
export function WalkInLanBanner({ message, tone = "lan" }: Props) {
	const colors = TONE_STYLES[tone];
	return (
		<View
			style={{
				backgroundColor: colors.bg,
				borderBottomWidth: 1,
				borderBottomColor: colors.border,
				paddingHorizontal: 16,
				paddingVertical: 10,
			}}
		>
			<Text style={{ color: colors.fg, fontSize: 13, fontWeight: "600" }}>
				{message}
			</Text>
		</View>
	);
}
