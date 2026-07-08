import { onlineManager, QueryClient } from "@tanstack/react-query";
import { setupOnlineManager } from "./setup-online-manager";

export function createMobileQueryClient(): QueryClient {
	setupOnlineManager();

	return new QueryClient({
		defaultOptions: {
			queries: {
				networkMode: "offlineFirst",
				gcTime: Number.POSITIVE_INFINITY,
				staleTime: 30_000,
				retry: (failureCount, error) => {
					if ((error as { status?: number }).status === 401) return false;
					if (!onlineManager.isOnline()) return false;
					return failureCount < 2;
				},
			},
			mutations: {
				networkMode: "online",
			},
		},
	});
}
