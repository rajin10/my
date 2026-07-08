import "../global.css";
import {
	MobilePersistQueryClientProvider,
	OfflineBanner,
	PendingSyncBanner,
} from "@repo/mobile-query";
import { focusManager } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ThemeBoundary } from "../components/ThemeProvider";
import { WalkInHubProvider } from "../components/WalkInHubProvider";
import { AppProvider } from "../context";
import { registerPushToken } from "../lib/push";
import { OWNER_APP_ID, queryClient } from "../lib/query-client";

Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowAlert: true,
		shouldShowBanner: true,
		shouldShowList: true,
		shouldPlaySound: true,
		shouldSetBadge: false,
	}),
});

function NotificationNavigator() {
	const router = useRouter();
	useEffect(() => {
		const sub = Notifications.addNotificationResponseReceivedListener(
			(response) => {
				const data = response.notification.request.content.data as Record<
					string,
					string
				>;
				if (data?.bookingId) router.navigate("/(tabs)/bookings");
				else if (data?.reviewId) router.navigate("/(tabs)/reviews");
			},
		);
		return () => sub.remove();
	}, [router]);
	return null;
}

export default function RootLayout() {
	const appState = useRef(AppState.currentState);

	useEffect(() => {
		registerPushToken();
		const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
			const wasBackground = appState.current.match(/inactive|background/);
			appState.current = state;
			if (state === "active" && wasBackground) {
				focusManager.setFocused(true);
			}
		});
		return () => sub.remove();
	}, []);

	return (
		<MobilePersistQueryClientProvider appId={OWNER_APP_ID} client={queryClient}>
			<GestureHandlerRootView style={{ flex: 1 }}>
				<SafeAreaProvider>
					<StatusBar style="dark" />
					<AppProvider>
						<WalkInHubProvider>
							<ThemeBoundary>
								<ErrorBoundary>
									<NotificationNavigator />
									<Stack screenOptions={{ headerShown: false }}>
										<Stack.Screen name="index" />
										<Stack.Screen name="(auth)" />
										<Stack.Screen name="(setup)" />
										<Stack.Screen name="(tabs)" />
										<Stack.Screen name="notifications" />
										<Stack.Screen name="business" />
										<Stack.Screen name="team" />
										<Stack.Screen name="coupons" />
										<Stack.Screen name="account" />
										<Stack.Screen name="help" />
										<Stack.Screen name="analytics" />
										<Stack.Screen name="calendar" />
										<Stack.Screen name="customers" />
										<Stack.Screen name="campaigns" />
										<Stack.Screen name="branding" />
										<Stack.Screen name="walk-in/index" />
									</Stack>
									<OfflineBanner />
									<PendingSyncBanner appId={OWNER_APP_ID} />
								</ErrorBoundary>
							</ThemeBoundary>
						</WalkInHubProvider>
					</AppProvider>
				</SafeAreaProvider>
			</GestureHandlerRootView>
		</MobilePersistQueryClientProvider>
	);
}
