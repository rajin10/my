/** Customer app store and deep-link URLs (override via env in production). */

export const PLAY_STORE_URL =
	process.env.NEXT_PUBLIC_PLAY_STORE_URL ??
	"https://play.google.com/store/apps/details?id=talash.bd";

export const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL ?? "";

export const MOBILE_DEEP_LINK_SCHEME = "mobileapp://";

export function hasPlayStoreLink(): boolean {
	return PLAY_STORE_URL.length > 0;
}

export function hasAppStoreLink(): boolean {
	return APP_STORE_URL.length > 0;
}
