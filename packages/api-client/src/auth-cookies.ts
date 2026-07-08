import type { AuthUser } from "./types";

/** SSR-readable hint that a session likely exists (not a credential). */
export const SESSION_HINT_COOKIE = "talash_session";
/** Display-only user cache for SSR Nav — validated by `auth.me()` on the client. */
export const DISPLAY_USER_COOKIE = "talash_user";

/** Align with refresh-token TTL (30 days). */
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface AuthInitialState {
	hasSession: boolean;
	user: AuthUser | null;
}

export type CookieReader = {
	get(name: string): { value: string } | undefined;
};

function isBrowser(): boolean {
	return typeof document !== "undefined";
}

function writeCookie(name: string, value: string, maxAge: number): void {
	if (!isBrowser()) return;
	document.cookie = `${name}=${value}; Path=/; SameSite=Lax; Max-Age=${maxAge}`;
}

function deleteCookie(name: string): void {
	writeCookie(name, "", 0);
}

export function setSessionHintCookie(): void {
	writeCookie(SESSION_HINT_COOKIE, "1", COOKIE_MAX_AGE_SECONDS);
}

export function syncAuthDisplayCookie(user: AuthUser): void {
	const payload = encodeURIComponent(
		JSON.stringify({
			id: user.id,
			email: user.email,
			name: user.name,
			role: user.role,
			...(user.photoUrl != null ? { photoUrl: user.photoUrl } : {}),
		}),
	);
	writeCookie(DISPLAY_USER_COOKIE, payload, COOKIE_MAX_AGE_SECONDS);
}

export function clearAuthCookies(): void {
	if (!isBrowser()) return;
	deleteCookie(SESSION_HINT_COOKIE);
	deleteCookie(DISPLAY_USER_COOKIE);
}

function parseDisplayUserCookie(raw: string | undefined): AuthUser | null {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<AuthUser>;
		if (
			typeof parsed.id === "string" &&
			(parsed.email === null || typeof parsed.email === "string") &&
			typeof parsed.name === "string" &&
			typeof parsed.role === "string"
		) {
			return {
				id: parsed.id,
				email: parsed.email,
				name: parsed.name,
				role: parsed.role,
				photoUrl: parsed.photoUrl ?? null,
				authMethods: parsed.authMethods ?? {
					password: false,
					google: false,
				},
			};
		}
	} catch {
		/* ignore malformed display cache */
	}
	return null;
}

/** Read SSR auth hint from request cookies (Next.js `cookies()` or middleware). */
export function readAuthInitialState(reader: CookieReader): AuthInitialState {
	const hasSession = reader.get(SESSION_HINT_COOKIE)?.value === "1";
	const user = parseDisplayUserCookie(reader.get(DISPLAY_USER_COOKIE)?.value);
	return { hasSession, user };
}
