import { MMKV } from "react-native-mmkv";
import type { WalkInAppId } from "./app-id";

const instances = new Map<WalkInAppId, MMKV>();

export function getWalkInMmkv(appId: WalkInAppId): MMKV {
	let storage = instances.get(appId);
	if (!storage) {
		storage = new MMKV({ id: `talash-walk-in-${appId}` });
		instances.set(appId, storage);
	}
	return storage;
}
