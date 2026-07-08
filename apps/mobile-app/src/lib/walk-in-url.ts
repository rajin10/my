export type WalkInUrlParams = {
	branchId: string;
	session?: string;
	signature?: string;
};

const UNIVERSAL_PATH = /^\/w\/([^/?#]+)/;
const BRANCH_ID = /^[a-zA-Z0-9_-]+$/;

/** Parse walk-in QR or deep link URLs into route params. */
export function parseWalkInUrl(raw: string): WalkInUrlParams | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;

	let url: URL;
	try {
		url = new URL(trimmed);
	} catch {
		return null;
	}

	const host = url.hostname.toLowerCase();
	const isUniversal = host === "talash.app" || host.endsWith(".talash.app");
	const isDeepLink = url.protocol === "mobileapp:";

	if (!isUniversal && !isDeepLink) return null;

	let branchId: string | null = null;

	if (isUniversal) {
		const match = url.pathname.match(UNIVERSAL_PATH);
		if (!match?.[1] || !BRANCH_ID.test(match[1])) return null;
		branchId = match[1];
	} else {
		const path = url.pathname.replace(/^\//, "");
		const host = url.hostname.toLowerCase();
		const isWalkInHost = host === "walk-in";
		const isWalkInPath = path === "walk-in";
		if (!isWalkInHost && !isWalkInPath) return null;
		const fromQuery = url.searchParams.get("branchId");
		if (!fromQuery || !BRANCH_ID.test(fromQuery)) return null;
		branchId = fromQuery;
	}

	const session =
		url.searchParams.get("s") ?? url.searchParams.get("session") ?? undefined;
	const signature =
		url.searchParams.get("sig") ??
		url.searchParams.get("signature") ??
		undefined;

	return { branchId, session, signature };
}

export function walkInRouteParams(
	params: WalkInUrlParams,
): Record<string, string> {
	const out: Record<string, string> = { branchId: params.branchId };
	if (params.session) out.session = params.session;
	if (params.signature) out.signature = params.signature;
	return out;
}
