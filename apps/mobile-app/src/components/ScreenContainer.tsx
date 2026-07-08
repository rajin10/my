import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { useLayout } from "../hooks/useLayout";

interface Props {
	children: ReactNode;
	style?: ViewStyle;
}

export function ScreenContainer({ children, style }: Props) {
	const { isTablet, contentWidth } = useLayout();
	if (!isTablet) {
		return <View style={[{ flex: 1 }, style]}>{children}</View>;
	}
	return (
		<View style={{ flex: 1, alignItems: "center" }}>
			<View style={[{ flex: 1, width: contentWidth }, style]}>{children}</View>
		</View>
	);
}
