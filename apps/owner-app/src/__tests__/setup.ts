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
	flushWalkInQueue: vi.fn().mockResolvedValue({ synced: {}, failed: [] }),
	loadWalkInQueue: () => [],
	startWalkInHub: vi.fn().mockResolvedValue(null),
	submitToHub: vi.fn(),
	useLanFallbackEligible: () => false,
	useWalkInQueue: () => ({
		entries: [],
		pendingCount: 0,
		pendingEntries: [],
		refresh: vi.fn(),
	}),
	WalkInLanBanner: () => null,
}));

vi.mock("../components/WalkInHubProvider", () => ({
	WalkInHubProvider: ({ children }: { children: React.ReactNode }) => children,
	useWalkInHub: () => ({
		walkInModeActive: false,
		setWalkInModeActive: vi.fn(),
		hubStatus: "inactive" as const,
		pendingWalkIns: [],
		refreshQueue: vi.fn(),
	}),
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

// @repo/ui-native's `Icon`/`Stars` (#64) `import * as Icons from
// "lucide-react-native"`, whose ESM build trips vitest-native. Stub those two
// leaf modules so lucide is never imported — every other shared component
// (Button, Card, Badge, StatusPill…) is the real implementation, and consumers
// that pull Icon/Stars via the barrel get the no-op too. Relative paths resolve
// to the same files Badge's internal `./Icon` import does.
vi.mock("../../../../packages/ui-native/src/components/Icon", () => ({
	Icon: () => null,
}));
vi.mock("../../../../packages/ui-native/src/components/Stars", () => ({
	Stars: () => null,
}));
