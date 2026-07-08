import { clearAuthCookies, setSessionHintCookie } from "./auth-cookies";

// ─── Token key constants ──────────────────────────────────────────────────────

export const ACCESS_TOKEN_KEY = "talash_access_token";
export const REFRESH_TOKEN_KEY = "talash_refresh_token";

// ─── TokenStore interface ─────────────────────────────────────────────────────

/**
 * Platform-agnostic interface for persisting auth tokens.
 *
 * - `getAccessToken` / `getRefreshToken` are synchronous so they can be called
 *   inline in `ApiClientConfig.getToken` (which expects a sync `string | null`).
 * - `setTokens` is always async (native writes are inherently async).
 * - `clearTokens` may be sync or async; callers should `await` it to be safe.
 */
export interface TokenStore {
	getAccessToken(): string | null;
	getRefreshToken(): string | null;
	setTokens(access: string, refresh: string): Promise<void>;
	clearTokens(): void | Promise<void>;
}

// ─── Web adapter (localStorage + session-hint cookie) ─────────────────────────

function safe<T>(fn: () => T, fallback: T): T {
	try {
		return fn();
	} catch {
		return fallback;
	}
}

/**
 * Web token store backed by `localStorage`.
 * All reads and writes are wrapped in `safe()` so SSR / cookie-blocked
 * environments don't throw.
 */
export const webTokenStore: TokenStore = {
	getAccessToken: () =>
		safe(() => localStorage.getItem(ACCESS_TOKEN_KEY), null),
	getRefreshToken: () =>
		safe(() => localStorage.getItem(REFRESH_TOKEN_KEY), null),
	setTokens: (access: string, refresh: string): Promise<void> => {
		safe(() => {
			localStorage.setItem(ACCESS_TOKEN_KEY, access);
			localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
		}, undefined);
		setSessionHintCookie();
		return Promise.resolve();
	},
	clearTokens: () => {
		safe(() => {
			localStorage.removeItem(ACCESS_TOKEN_KEY);
			localStorage.removeItem(REFRESH_TOKEN_KEY);
		}, undefined);
		clearAuthCookies();
	},
};

// ─── Auth-events factory ──────────────────────────────────────────────────────

type UnauthorizedHandler = () => void;

export interface AuthEvents {
	setOnUnauthorized(fn: UnauthorizedHandler): void;
	emitUnauthorized(): void;
}

/**
 * Returns a fresh auth-events registry.
 *
 * Each app creates its own instance (so there is no shared mutable singleton)
 * and registers a redirect handler during app initialisation.
 *
 * Web apps that handle 401 inline in `onUnauthorized` do not need this.
 */
export function createAuthEvents(): AuthEvents {
	let handler: UnauthorizedHandler | null = null;
	return {
		setOnUnauthorized(fn) {
			handler = fn;
		},
		emitUnauthorized() {
			handler?.();
		},
	};
}
