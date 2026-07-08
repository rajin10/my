import {
	ACCESS_TOKEN_KEY,
	REFRESH_TOKEN_KEY,
	type TokenStore,
} from "@repo/api-client";
import * as SecureStore from "expo-secure-store";

/**
 * Native token store backed by Expo SecureStore.
 * Reads are synchronous (`getItem`); writes/deletes are async.
 */
export const tokenStore: TokenStore = {
	getAccessToken: () => SecureStore.getItem(ACCESS_TOKEN_KEY),
	getRefreshToken: () => SecureStore.getItem(REFRESH_TOKEN_KEY),
	setTokens: async (access: string, refresh: string) => {
		await Promise.all([
			SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access),
			SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh),
		]);
	},
	clearTokens: async () => {
		await Promise.all([
			SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
			SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
		]);
	},
};
