import { MMKV } from "react-native-mmkv";
import type { MobileAppId } from "./app-id";

const instances = new Map<MobileAppId, MMKV>();

export function getMmkvStorage(appId: MobileAppId): MMKV {
	let storage = instances.get(appId);
	if (!storage) {
		storage = new MMKV({ id: `talash-query-${appId}` });
		instances.set(appId, storage);
	}
	return storage;
}
