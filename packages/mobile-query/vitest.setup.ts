import { vi } from "vitest";

vi.mock("react-native-mmkv", () => {
	const stores = new Map<string, Map<string, string>>();

	return {
		MMKV: class MockMMKV {
			private store: Map<string, string>;

			constructor({ id }: { id: string }) {
				if (!stores.has(id)) stores.set(id, new Map());
				this.store = stores.get(id) ?? new Map();
			}

			getString(key: string) {
				return this.store.get(key);
			}

			set(key: string, value: string) {
				this.store.set(key, value);
			}

			delete(key: string) {
				this.store.delete(key);
			}
		},
	};
});
