import type { Query } from "@tanstack/react-query";
import {
	EXCLUDE_PREFIXES,
	keyMatchesPrefix,
	PERSIST_PREFIXES,
} from "./allowlist";

export function shouldDehydrateQuery(query: Query): boolean {
	if (query.state.status !== "success") return false;

	const key = query.queryKey;
	if (EXCLUDE_PREFIXES.some((prefix) => keyMatchesPrefix(key, prefix))) {
		return false;
	}

	return PERSIST_PREFIXES.some((prefix) => keyMatchesPrefix(key, prefix));
}
