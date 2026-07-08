import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 30_000,
				retry: (failureCount, error) => {
					if ((error as { status?: number }).status === 401) return false;
					return failureCount < 2;
				},
			},
		},
	});
}
