import { vi } from "vitest";

vi.mock("@repo/mobile-query", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@repo/mobile-query")>();
	const { QueryClient } = await import("@tanstack/react-query");
	return {
		...actual,
		createMobileQueryClient: () =>
			new QueryClient({
				defaultOptions: {
					queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
				},
			}),
		useNetworkStatus: () => ({ isOnline: true }),
		useOnlineGuard: () => () => true,
		OutboxSyncProvider: ({ children }: { children: React.ReactNode }) =>
			children,
		PendingSyncBanner: () => null,
		useOutbox: () => ({
			entries: [],
			pendingCount: 0,
			failedCount: 0,
			refresh: () => {},
			hasPendingForBooking: () => false,
		}),
		useOutboxSync: () => {},
	};
});

vi.mock("@repo/walk-in-sync", () => ({
	clearWalkInQueue: vi.fn(),
	discoverHub: vi.fn().mockResolvedValue(null),
	enqueueWalkInSubmission: vi.fn(),
	fetchHubContext: vi.fn(),
	loadWalkInQueue: () => [],
	submitToHub: vi.fn(),
	useLanFallbackEligible: () => false,
	WalkInLanBanner: () => null,
}));

vi.mock("@react-native-community/netinfo", () => ({
	default: {
		addEventListener: (listener: (state: { isConnected: boolean }) => void) => {
			listener({ isConnected: true });
			return () => {};
		},
		fetch: () => Promise.resolve({ isConnected: true }),
	},
}));

vi.mock("react-native-mmkv", () => ({
	MMKV: class MockMMKV {
		getString() {
			return undefined;
		}
		set() {}
		delete() {}
	},
}));

vi.mock("expo-secure-store", () => ({
	getItem: vi.fn(),
	getItemAsync: vi.fn(),
	setItemAsync: vi.fn(),
	deleteItemAsync: vi.fn(),
}));
