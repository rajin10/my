import * as SecureStore from "expo-secure-store";

const KEY = "talash_reviewed_booking_ids";

export async function loadReviewedIds(): Promise<Set<string>> {
	try {
		const raw = await SecureStore.getItemAsync(KEY);
		if (!raw) return new Set();
		const ids = JSON.parse(raw) as string[];
		return new Set(Array.isArray(ids) ? ids : []);
	} catch {
		return new Set();
	}
}

let writePending: Promise<void> = Promise.resolve();

export async function addReviewedId(id: string): Promise<void> {
	writePending = writePending.then(async () => {
		const set = await loadReviewedIds();
		set.add(id);
		await SecureStore.setItemAsync(KEY, JSON.stringify([...set]));
	});
	return writePending;
}
