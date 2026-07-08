import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

/** True when the query cache holds at least one entry with data. */
export function useHasCachedQueries(): boolean {
	const queryClient = useQueryClient();
	const [hasCache, setHasCache] = useState(false);

	useEffect(() => {
		const check = () => {
			const has = queryClient
				.getQueryCache()
				.getAll()
				.some((query) => query.state.data !== undefined);
			setHasCache(has);
		};

		check();
		return queryClient.getQueryCache().subscribe(check);
	}, [queryClient]);

	return hasCache;
}
