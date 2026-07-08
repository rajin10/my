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
import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { LocaleProvider } from "../components/LocaleProvider";
import { ToastProvider } from "../components/Toast";
import { WalkInConnectivityBanner } from "../components/WalkInConnectivityBanner";
import { shouldShowWalkthrough, Walkthrough } from "../components/Walkthrough";
import { AppProvider } from "../context";
import { MOBILE_APP_ID, queryClient } from "../lib/query-client";

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
				else if (data?.businessId)
					router.push({
						pathname: "/business",
						params: { id: data.businessId },
					});
			},
		);
		return () => sub.remove();
	}, [router]);
	return null;
}

export default function RootLayout() {
	const appState = useRef(AppState.currentState);
	const [showWalkthrough, setShowWalkthrough] = useState(false);

	useEffect(() => {
		shouldShowWalkthrough().then(setShowWalkthrough);
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
		<MobilePersistQueryClientProvider
			appId={MOBILE_APP_ID}
			client={queryClient}
		>
			<GestureHandlerRootView style={{ flex: 1 }}>
				<SafeAreaProvider>
					<StatusBar style="dark" />
					<LocaleProvider>
						<AppProvider>
							<ToastProvider>
								<ErrorBoundary>
									<NotificationNavigator />
									<Stack screenOptions={{ headerShown: false }}>
										<Stack.Screen name="(tabs)" />
										<Stack.Screen name="business" />
										<Stack.Screen name="booking" />
										<Stack.Screen name="confirm" />
										<Stack.Screen name="notifications" />
										<Stack.Screen name="walk-in/scan" />
										<Stack.Screen name="walk-in/booking" />
										<Stack.Screen name="walk-in/order" />
										<Stack.Screen name="walk-in/confirm" />
									</Stack>
									{showWalkthrough && (
										<Walkthrough onDone={() => setShowWalkthrough(false)} />
									)}
									<OfflineBanner />
									<WalkInConnectivityBanner />
									<PendingSyncBanner appId={MOBILE_APP_ID} />
								</ErrorBoundary>
							</ToastProvider>
						</AppProvider>
					</LocaleProvider>
				</SafeAreaProvider>
			</GestureHandlerRootView>
		</MobilePersistQueryClientProvider>
	);
}
