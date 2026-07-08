import { Colors } from "@repo/tokens";
import { Icon } from "@repo/ui-native";
import { useEffect, useRef } from "react";
import { Animated, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHasCachedQueries } from "./use-has-cached-queries";
import { useNetworkStatus } from "./use-network-status";

export function OfflineBanner() {
	const { isOnline } = useNetworkStatus();
	const hasCache = useHasCachedQueries();
	const translateY = useRef(new Animated.Value(-60)).current;
	const insets = useSafeAreaInsets();

	useEffect(() => {
		Animated.spring(translateY, {
			toValue: isOnline ? -60 : 0,
			useNativeDriver: true,
			tension: 80,
			friction: 12,
		}).start();
	}, [isOnline, translateY]);

	if (isOnline) return null;

	const showingSavedData = hasCache;
	const backgroundColor = showingSavedData ? Colors.pending : Colors.danger;
	const message = showingSavedData
		? "You're offline — showing saved data"
		: "No internet connection";

	return (
		<Animated.View
			style={{
				position: "absolute",
				top: insets.top,
				left: 0,
				right: 0,
				zIndex: 9999,
				transform: [{ translateY }],
				backgroundColor,
				flexDirection: "row",
				alignItems: "center",
				justifyContent: "center",
				gap: 8,
				paddingVertical: 10,
				paddingHorizontal: 16,
			}}
		>
			<Icon name="WifiOff" sizePx={15} color="#fff" strokeWidth={2} />
			<Text style={{ color: "#fff", fontSize: 13.5, fontWeight: "600" }}>
				{message}
			</Text>
		</Animated.View>
	);
}
