import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_HINT_COOKIE } from "../auth-cookies";
import {
	ACCESS_TOKEN_KEY,
	createAuthEvents,
	REFRESH_TOKEN_KEY,
	type TokenStore,
	webTokenStore,
} from "../token-store";

// ─── In-memory fake adapter (contract test) ───────────────────────────────────

function createInMemoryTokenStore(): TokenStore {
	const store: Record<string, string> = {};
	return {
		getAccessToken: () => store[ACCESS_TOKEN_KEY] ?? null,
		getRefreshToken: () => store[REFRESH_TOKEN_KEY] ?? null,
		setTokens: async (access, refresh) => {
			store[ACCESS_TOKEN_KEY] = access;
			store[REFRESH_TOKEN_KEY] = refresh;
		},
		clearTokens: () => {
			delete store[ACCESS_TOKEN_KEY];
			delete store[REFRESH_TOKEN_KEY];
		},
	};
}

function runTokenStoreContract(label: string, makeStore: () => TokenStore) {
	describe(`TokenStore contract — ${label}`, () => {
		let store: TokenStore;

		beforeEach(() => {
			store = makeStore();
		});

		it("getAccessToken returns null when nothing is stored", () => {
			expect(store.getAccessToken()).toBeNull();
		});

		it("getRefreshToken returns null when nothing is stored", () => {
			expect(store.getRefreshToken()).toBeNull();
		});

		it("setTokens persists access and refresh tokens", async () => {
			await store.setTokens("access-123", "refresh-xyz");
			expect(store.getAccessToken()).toBe("access-123");
			expect(store.getRefreshToken()).toBe("refresh-xyz");
		});

		it("clearTokens removes both tokens", async () => {
			await store.setTokens("access-abc", "refresh-def");
			await store.clearTokens();
			expect(store.getAccessToken()).toBeNull();
			expect(store.getRefreshToken()).toBeNull();
		});

		it("setTokens overwrites previously stored tokens", async () => {
			await store.setTokens("old-access", "old-refresh");
			await store.setTokens("new-access", "new-refresh");
			expect(store.getAccessToken()).toBe("new-access");
			expect(store.getRefreshToken()).toBe("new-refresh");
		});
	});
}

// Run contract against the in-memory fake
runTokenStoreContract("in-memory fake", createInMemoryTokenStore);

// ─── webTokenStore (real implementation) ─────────────────────────────────────

describe("TokenStore contract — webTokenStore", () => {
	const fakeStorage: Record<string, string> = {};
	let cookieJar: string;

	beforeEach(() => {
		// Clear local state
		for (const key of Object.keys(fakeStorage)) {
			delete fakeStorage[key];
		}
		cookieJar = "";

		vi.stubGlobal("document", {
			get cookie() {
				return cookieJar;
			},
			set cookie(value: string) {
				const [pair] = value.split(";");
				const eq = pair.indexOf("=");
				const name = pair.slice(0, eq);
				const val = pair.slice(eq + 1);
				const parts = cookieJar
					.split("; ")
					.filter(Boolean)
					.filter((p) => !p.startsWith(`${name}=`));
				if (val !== "") parts.push(`${name}=${val}`);
				cookieJar = parts.join("; ");
			},
		});

		vi.stubGlobal("localStorage", {
			getItem: (key: string) => fakeStorage[key] ?? null,
			setItem: (key: string, value: string) => {
				fakeStorage[key] = value;
			},
			removeItem: (key: string) => {
				delete fakeStorage[key];
			},
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("getAccessToken returns null when nothing is stored", () => {
		expect(webTokenStore.getAccessToken()).toBeNull();
	});

	it("getRefreshToken returns null when nothing is stored", () => {
		expect(webTokenStore.getRefreshToken()).toBeNull();
	});

	it("setTokens persists access and refresh tokens", async () => {
		await webTokenStore.setTokens("access-123", "refresh-xyz");
		expect(webTokenStore.getAccessToken()).toBe("access-123");
		expect(webTokenStore.getRefreshToken()).toBe("refresh-xyz");
		expect(cookieJar).toContain(`${SESSION_HINT_COOKIE}=1`);
	});

	it("clearTokens removes both tokens", async () => {
		await webTokenStore.setTokens("access-abc", "refresh-def");
		await webTokenStore.clearTokens();
		expect(webTokenStore.getAccessToken()).toBeNull();
		expect(webTokenStore.getRefreshToken()).toBeNull();
		expect(cookieJar).not.toContain(`${SESSION_HINT_COOKIE}=1`);
	});

	it("uses the correct key names", async () => {
		await webTokenStore.setTokens("a", "r");
		expect(fakeStorage[ACCESS_TOKEN_KEY]).toBe("a");
		expect(fakeStorage[REFRESH_TOKEN_KEY]).toBe("r");
	});

	it("returns null when localStorage throws (safe fallback)", () => {
		vi.stubGlobal("localStorage", {
			getItem: () => {
				throw new Error("SecurityError");
			},
			setItem: () => {
				throw new Error("SecurityError");
			},
			removeItem: () => {
				throw new Error("SecurityError");
			},
		});
		expect(webTokenStore.getAccessToken()).toBeNull();
		expect(webTokenStore.getRefreshToken()).toBeNull();
	});

	it("setTokens resolves even when localStorage throws", async () => {
		vi.stubGlobal("localStorage", {
			getItem: () => null,
			setItem: () => {
				throw new Error("QuotaExceededError");
			},
			removeItem: () => {},
		});
		await expect(webTokenStore.setTokens("a", "r")).resolves.toBeUndefined();
	});
});

// ─── createAuthEvents ─────────────────────────────────────────────────────────

describe("createAuthEvents", () => {
	it("emitUnauthorized calls the registered handler", () => {
		const events = createAuthEvents();
		const handler = vi.fn();
		events.setOnUnauthorized(handler);
		events.emitUnauthorized();
		expect(handler).toHaveBeenCalledOnce();
	});

	it("emitUnauthorized is a no-op before any handler is registered", () => {
		const events = createAuthEvents();
		expect(() => events.emitUnauthorized()).not.toThrow();
	});

	it("each createAuthEvents instance is independent", () => {
		const a = createAuthEvents();
		const b = createAuthEvents();
		const handlerA = vi.fn();
		const handlerB = vi.fn();
		a.setOnUnauthorized(handlerA);
		b.setOnUnauthorized(handlerB);
		a.emitUnauthorized();
		expect(handlerA).toHaveBeenCalledOnce();
		expect(handlerB).not.toHaveBeenCalled();
	});

	it("replaces handler when setOnUnauthorized is called again", () => {
		const events = createAuthEvents();
		const first = vi.fn();
		const second = vi.fn();
		events.setOnUnauthorized(first);
		events.setOnUnauthorized(second);
		events.emitUnauthorized();
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledOnce();
	});
});
