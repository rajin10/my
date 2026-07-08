import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";
import { tokenStore } from "./native-token-store";

export async function registerPushToken(): Promise<void> {
	if (Platform.OS === "web") return;
	if (!tokenStore.getAccessToken()) return;
	try {
		const { status: existing } = await Notifications.getPermissionsAsync();
		const { status } =
			existing === "granted"
				? { status: existing }
				: await Notifications.requestPermissionsAsync();
		if (status !== "granted") return;
		const token = (await Notifications.getExpoPushTokenAsync()).data;
		await api.auth.registerPushToken(token);
	} catch {
		// Non-fatal — push notifications are best-effort
	}
}
