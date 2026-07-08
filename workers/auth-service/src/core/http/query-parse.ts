/**
 * Lightweight query parser used by middleware.
 * (Auth-service will likely adopt the shared Talash query parsing later.)
 */
export function parseQueryString(
	queryString: string,
	_opts?: { allowDots?: boolean; comma?: boolean },
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	const params = new URLSearchParams(queryString);
	for (const [key, value] of params.entries()) {
		// Preserve last-value wins semantics (good enough for placeholder routes).
		out[key] = value;
	}
	return out;
}
