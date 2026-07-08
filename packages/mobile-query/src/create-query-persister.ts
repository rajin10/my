import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import type { MobileAppId } from "./app-id";
import { persistStorageKey } from "./app-id";
import { getMmkvStorage } from "./mmkv-storage";

export function createQueryPersister(appId: MobileAppId) {
	const storage = getMmkvStorage(appId);
	const cacheKey = persistStorageKey(appId);

	return createSyncStoragePersister({
		key: cacheKey,
		storage: {
			getItem: (key) => storage.getString(key) ?? null,
			setItem: (key, value) => {
				storage.set(key, value);
			},
			removeItem: (key) => {
				storage.delete(key);
			},
		},
	});
}
