import { type MobileAppId, persistStorageKey } from "./app-id";
import { getMmkvStorage } from "./mmkv-storage";

export function clearPersistedCache(appId: MobileAppId): void {
	const storage = getMmkvStorage(appId);
	storage.delete(persistStorageKey(appId));
}
