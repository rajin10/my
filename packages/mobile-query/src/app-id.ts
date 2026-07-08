export type MobileAppId = "mobile-app" | "owner-app";

export function persistStorageKey(appId: MobileAppId): string {
	return `talash-query-cache-${appId}`;
}
