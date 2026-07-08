import { Colors } from "@repo/tokens";
import { Icon } from "@repo/ui-native";
import { useEffect, useRef } from "react";
import { Animated, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MobileAppId } from "./app-id";
import { useOutbox } from "./outbox/use-outbox";
import { useNetworkStatus } from "./use-network-status";

type PendingSyncBannerProps = {
	appId: MobileAppId;
};

export function PendingSyncBanner({ appId }: PendingSyncBannerProps) {
	const { isOnline } = useNetworkStatus();
	const { pendingCount } = useOutbox(appId);
	const translateY = useRef(new Animated.Value(-60)).current;
	const insets = useSafeAreaInsets();

	const visible = pendingCount > 0 && !isOnline;

	useEffect(() => {
		Animated.spring(translateY, {
			toValue: visible ? 0 : -60,
			useNativeDriver: true,
			tension: 80,
			friction: 12,
		}).start();
	}, [visible, translateY]);

	if (!visible) return null;

	const label =
		pendingCount === 1
			? "1 action waiting to sync"
			: `${pendingCount} actions waiting to sync`;

	return (
		<Animated.View
			style={{
				position: "absolute",
				top: insets.top + 44,
				left: 0,
				right: 0,
				zIndex: 9998,
				transform: [{ translateY }],
				backgroundColor: Colors.pending,
				flexDirection: "row",
				alignItems: "center",
				justifyContent: "center",
				gap: 8,
				paddingVertical: 8,
				paddingHorizontal: 16,
			}}
		>
			<Icon name="CloudOff" sizePx={14} color="#fff" strokeWidth={2} />
			<Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>
				{label}
			</Text>
		</Animated.View>
	);
}
