import { createApi, createAuthEvents, createRefreshFn } from "@repo/api-client";
import Constants from "expo-constants";
import { tokenStore } from "./native-token-store";

const baseUrl =
	(Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
	process.env.EXPO_PUBLIC_API_URL ??
	"http://localhost:8787";

export const authEvents = createAuthEvents();

export const api = createApi({
	baseUrl,
	getToken: () => tokenStore.getAccessToken(),
	tryRefresh: createRefreshFn(baseUrl, tokenStore),
	onUnauthorized: () => {
		tokenStore.clearTokens();
		authEvents.emitUnauthorized();
	},
});
