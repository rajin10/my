"use client";

import { createApi, createRefreshFn, webTokenStore } from "@repo/api-client";
import { vars } from "./vars";

const baseUrl = vars.API_URL;

export const tokenStore = webTokenStore;

export const api = createApi({
	baseUrl,
	getToken: () => tokenStore.getAccessToken(),
	tryRefresh: createRefreshFn(baseUrl, tokenStore),
	onUnauthorized: () => {
		tokenStore.clearTokens();
		if (typeof window !== "undefined") window.location.reload();
	},
});
