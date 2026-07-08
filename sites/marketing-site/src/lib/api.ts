import { createApi, createRefreshFn, webTokenStore } from "@repo/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { vars } from "./vars";

const baseUrl = vars.API_URL;

export const tokenStore = webTokenStore;

export const api = createApi({
	baseUrl,
	getToken: () => tokenStore.getAccessToken(),
	tryRefresh: createRefreshFn(baseUrl, tokenStore),
	onUnauthorized: () => {
		useAuthStore.getState().signOut();
		if (typeof window !== "undefined") {
			window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
		}
	},
});
