# Phase 0 — Auth State with zustand — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a zustand store the single client-side source of truth for the marketing site's auth UI state, replacing the TanStack Query `["auth","me"]` path, so the Nav can reliably show/hide Sign-in vs Profile without a flash.

**Architecture:** A pure-module zustand store (`useAuthStore`) holds `user` + `status` with `persist` (display cache) + `devtools` middleware. The token stays in `tokenStore` (the sole credential). An `AuthProvider` rehydrates the store, bootstraps via `auth.me()`, and clears the React Query cache on logout. `useAuth` becomes a thin selector over the store. See [ADR 0001](../../adr/0001-marketing-site-auth-state-with-zustand.md).

**Tech Stack:** Next.js 16, React 19, zustand 5, TanStack Query 5, Vitest + Testing Library, `@repo/api-client`.

**Spec:** [2026-06-08-account-auth-features-design.md](../specs/2026-06-08-account-auth-features-design.md) (Phase 0 section).

---

## File Structure

| File | Responsibility |
|---|---|
| `sites/marketing-site/src/stores/auth-store.ts` | **Create.** zustand store: `user`, `status`, `setUser`, `signOut`. Pure module — no React, no api-client `api`. |
| `sites/marketing-site/src/stores/__tests__/auth-store.test.ts` | **Create.** Unit tests for store transitions. |
| `sites/marketing-site/src/components/AuthProvider.tsx` | **Create.** Bootstrap (rehydrate → token check → `me()`) + cache-clear subscription. |
| `sites/marketing-site/src/components/__tests__/AuthProvider.test.tsx` | **Create.** Behavioural tests for the two bootstrap paths. |
| `sites/marketing-site/src/hooks/useAuth.ts` | **Modify.** Selector over the store; `signOut` = best-effort API logout + store reset + redirect. |
| `sites/marketing-site/src/components/Providers.tsx` | **Modify.** Render `AuthProvider` inside `QueryClientProvider`. |
| `sites/marketing-site/src/lib/api.ts` | **Modify.** `onUnauthorized` calls `useAuthStore.getState().signOut()`. |
| `sites/marketing-site/src/app/auth/callback/page.tsx` | **Modify.** Prime the store with `me()` before redirect. |
| `sites/marketing-site/src/components/Nav.tsx` | **Modify.** Render neutral slot when `status === "unknown"`. |
| `sites/marketing-site/src/components/__tests__/Nav.auth.test.tsx` | **Create.** Asserts the three-state Nav rendering. |
| `sites/marketing-site/src/app/account/page.tsx` | **Modify.** Guard on `status`; name-edit refreshes store; sign-out/delete route through the store. |
| `sites/marketing-site/vitest.config.ts` | **Modify.** Add `@/` path alias for tests. |
| `sites/marketing-site/package.json` | **Modify.** Add `zustand` dependency. |
| `sites/marketing-site/AGENTS.md` | **Modify.** Update the Auth convention note. |

**Circular-import note:** `auth-store.ts` imports `webTokenStore` directly from `@repo/api-client` (NOT from `@/lib/api`). `lib/api.ts` imports the store. This keeps the dependency one-directional: `api.ts → store → @repo/api-client`.

All commands below run from the worktree root unless noted.

**Canonical verification commands** (this is a Turbo-routed Bun monorepo — `cd <pkg> && bun run test` fails with exit 127; use these instead):
- **Whole suite:** `bun run --filter @repo/marketing-site test` (from worktree root)
- **Single test file:** `cd sites/marketing-site && bunx vitest run <path>`
- **Lint:** `bun run --filter @repo/marketing-site lint` (from worktree root)
- **Type-check:** `cd sites/marketing-site && bunx tsc --noEmit`
- **Build:** `bun run build` (from worktree root)

---

## Task 1: Project setup — zustand dependency + test alias

**Files:**
- Modify: `sites/marketing-site/package.json`
- Modify: `sites/marketing-site/vitest.config.ts`

- [ ] **Step 1: Install zustand**

Run (from worktree root):

```bash
cd sites/marketing-site && bun add zustand@^5.0.0 && cd -
```

Expected: `package.json` gains `"zustand": "^5.0.x"` under `dependencies`; `bun.lock` updates.

- [ ] **Step 2: Add the `@/` alias to the Vitest config**

The app resolves `@/*` via `tsconfig.json`, but Vitest has no matching alias, so tests importing `@/...` (or testing modules that do) fail to resolve. Replace the entire contents of `sites/marketing-site/vitest.config.ts` with:

```ts
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: ["./src/__tests__/setup.ts"],
	},
});
```

- [ ] **Step 3: Verify the existing test suite still passes**

Run: `bun run --filter @repo/marketing-site test`
Expected: PASS — the existing `Stars` test still passes; no new failures from the config change.

- [ ] **Step 4: Commit**

```bash
git add sites/marketing-site/package.json sites/marketing-site/vitest.config.ts
git add bun.lock 2>/dev/null || true   # root lockfile (Bun keeps one lockfile per workspace root)
git commit -m "chore(marketing-site): add zustand + @/ vitest alias for auth-state work"
```

---

## Task 2: The auth store

**Files:**
- Create: `sites/marketing-site/src/stores/auth-store.ts`
- Test: `sites/marketing-site/src/stores/__tests__/auth-store.test.ts`

- [ ] **Step 1: Write the failing test**

Create `sites/marketing-site/src/stores/__tests__/auth-store.test.ts`:

```ts
import type { AuthUser } from "@repo/api-client";
import { webTokenStore } from "@repo/api-client";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "../auth-store";

const USER: AuthUser = {
	id: "u1",
	email: "sara@example.com",
	name: "Sara Khan",
	role: "user",
};

beforeEach(() => {
	// Reset the singleton store + persisted state between tests.
	localStorage.clear();
	useAuthStore.setState({ user: null, status: "unknown" });
});

describe("auth-store", () => {
	it("starts in the unknown state with no user", () => {
		const s = useAuthStore.getState();
		expect(s.user).toBeNull();
		expect(s.status).toBe("unknown");
	});

	it("setUser marks the session authenticated", () => {
		useAuthStore.getState().setUser(USER);
		const s = useAuthStore.getState();
		expect(s.user).toEqual(USER);
		expect(s.status).toBe("authenticated");
	});

	it("signOut clears the user, marks unauthenticated, and clears tokens", async () => {
		await webTokenStore.setTokens("access-123", "refresh-123");
		useAuthStore.getState().setUser(USER);

		useAuthStore.getState().signOut();

		const s = useAuthStore.getState();
		expect(s.user).toBeNull();
		expect(s.status).toBe("unauthenticated");
		expect(webTokenStore.getAccessToken()).toBeNull();
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd sites/marketing-site && bunx vitest run src/stores/__tests__/auth-store.test.ts`
Expected: FAIL — cannot resolve `../auth-store` (module does not exist yet).

- [ ] **Step 3: Implement the store**

Create `sites/marketing-site/src/stores/auth-store.ts`:

```ts
import type { AuthUser } from "@repo/api-client";
import { webTokenStore } from "@repo/api-client";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export type AuthStatus = "unknown" | "authenticated" | "unauthenticated";

export interface AuthState {
	/** Display cache. Never trusted without a live token (see ADR 0001). */
	user: AuthUser | null;
	status: AuthStatus;
	/** Mark the session authenticated with a confirmed/optimistic user. */
	setUser: (user: AuthUser) => void;
	/** Clear credential + identity. Pure: no React, no navigation, no cache. */
	signOut: () => void;
}

export const useAuthStore = create<AuthState>()(
	devtools(
		persist(
			(set) => ({
				user: null,
				status: "unknown",
				setUser: (user) => set({ user, status: "authenticated" }),
				signOut: () => {
					webTokenStore.clearTokens();
					set({ user: null, status: "unauthenticated" });
				},
			}),
			{
				name: "talash-auth",
				// Persist only the display cache; status is recomputed on boot.
				partialize: (s) => ({ user: s.user }),
				// Next.js: do not auto-hydrate during render. AuthProvider rehydrates
				// in an effect so the server and first client render both show `unknown`.
				skipHydration: true,
			},
		),
		{ name: "auth-store", enabled: process.env.NODE_ENV === "development" },
	),
);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd sites/marketing-site && bunx vitest run src/stores/__tests__/auth-store.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add sites/marketing-site/src/stores/auth-store.ts sites/marketing-site/src/stores/__tests__/auth-store.test.ts
git commit -m "feat(marketing-site): add zustand auth store (user + status, persist+devtools)"
```

---

## Task 3: Refactor `useAuth` into a store selector

**Files:**
- Modify: `sites/marketing-site/src/hooks/useAuth.ts`
- Test: `sites/marketing-site/src/hooks/__tests__/useAuth.test.ts`

- [ ] **Step 1: Write the failing test**

Create `sites/marketing-site/src/hooks/__tests__/useAuth.test.ts`:

```ts
import type { AuthUser } from "@repo/api-client";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/stores/auth-store";
import { useAuth } from "../useAuth";

vi.mock("@/lib/api", () => ({
	api: { auth: { logout: vi.fn().mockResolvedValue(undefined) } },
	tokenStore: { clearTokens: vi.fn() },
}));

const USER: AuthUser = { id: "u1", email: null, name: "Sara", role: "user" };

beforeEach(() => {
	localStorage.clear();
	useAuthStore.setState({ user: null, status: "unknown" });
});

describe("useAuth", () => {
	it("reports loading while status is unknown", () => {
		const { result } = renderHook(() => useAuth());
		expect(result.current.isLoading).toBe(true);
		expect(result.current.user).toBeNull();
	});

	it("exposes the user and status once authenticated", () => {
		useAuthStore.getState().setUser(USER);
		const { result } = renderHook(() => useAuth());
		expect(result.current.user).toEqual(USER);
		expect(result.current.status).toBe("authenticated");
		expect(result.current.isLoading).toBe(false);
	});

	it("is not loading when unauthenticated", () => {
		useAuthStore.setState({ user: null, status: "unauthenticated" });
		const { result } = renderHook(() => useAuth());
		expect(result.current.isLoading).toBe(false);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd sites/marketing-site && bunx vitest run src/hooks/__tests__/useAuth.test.ts`
Expected: FAIL — current `useAuth` returns `isLoading` from a TanStack query gated on `hasToken` (set in an effect), so `result.current.status` is `undefined` and the authenticated assertions fail.

- [ ] **Step 3: Replace `useAuth` with a store selector**

Replace the entire contents of `sites/marketing-site/src/hooks/useAuth.ts` with:

```ts
"use client";
import { useCallback } from "react";
import { api } from "@/lib/api";
import { type AuthStatus, useAuthStore } from "@/stores/auth-store";

export function useAuth(): {
	user: ReturnType<typeof useAuthStore.getState>["user"];
	status: AuthStatus;
	isLoading: boolean;
	signOut: () => Promise<void>;
} {
	const user = useAuthStore((s) => s.user);
	const status = useAuthStore((s) => s.status);

	// Best-effort server logout, then clear local state and hard-reset to home.
	// The hard navigation matches prior behaviour and guarantees a clean slate;
	// AuthProvider's subscription also clears the query cache on the transition.
	const signOut = useCallback(async () => {
		try {
			await api.auth.logout();
		} catch {
			/* ignore — local clear below is what matters */
		}
		useAuthStore.getState().signOut();
		if (typeof window !== "undefined") window.location.href = "/";
	}, []);

	return {
		user,
		status,
		isLoading: status === "unknown",
		signOut,
	};
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd sites/marketing-site && bunx vitest run src/hooks/__tests__/useAuth.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add sites/marketing-site/src/hooks/useAuth.ts sites/marketing-site/src/hooks/__tests__/useAuth.test.ts
git commit -m "refactor(marketing-site): useAuth selects from the zustand store"
```

---

## Task 4: AuthProvider — bootstrap + cache-clear, wired into Providers

**Files:**
- Create: `sites/marketing-site/src/components/AuthProvider.tsx`
- Test: `sites/marketing-site/src/components/__tests__/AuthProvider.test.tsx`
- Modify: `sites/marketing-site/src/components/Providers.tsx`

- [ ] **Step 1: Write the failing test**

Create `sites/marketing-site/src/components/__tests__/AuthProvider.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/stores/auth-store";

const me = vi.fn();
const getAccessToken = vi.fn();

vi.mock("@/lib/api", () => ({
	api: { auth: { me: () => me() } },
	tokenStore: { getAccessToken: () => getAccessToken() },
}));

// Import after the mock is registered.
import { AuthProvider } from "../AuthProvider";

function renderProvider() {
	const qc = new QueryClient();
	return render(
		<QueryClientProvider client={qc}>
			<AuthProvider>
				<div>child</div>
			</AuthProvider>
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	localStorage.clear();
	useAuthStore.setState({ user: null, status: "unknown" });
	me.mockReset();
	getAccessToken.mockReset();
});

describe("AuthProvider bootstrap", () => {
	it("with no token, settles to unauthenticated and never calls me()", async () => {
		getAccessToken.mockReturnValue(null);
		renderProvider();
		await waitFor(() =>
			expect(useAuthStore.getState().status).toBe("unauthenticated"),
		);
		expect(me).not.toHaveBeenCalled();
	});

	it("with a token, calls me() and becomes authenticated", async () => {
		getAccessToken.mockReturnValue("access-123");
		me.mockResolvedValue({
			data: { id: "u1", email: null, name: "Sara", role: "user" },
		});
		renderProvider();
		await waitFor(() =>
			expect(useAuthStore.getState().status).toBe("authenticated"),
		);
		expect(useAuthStore.getState().user?.name).toBe("Sara");
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd sites/marketing-site && bunx vitest run src/components/__tests__/AuthProvider.test.tsx`
Expected: FAIL — cannot resolve `../AuthProvider`.

- [ ] **Step 3: Implement AuthProvider**

Create `sites/marketing-site/src/components/AuthProvider.tsx`:

```tsx
"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api, tokenStore } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Owns auth bootstrap and the logout cache-purge. Must render inside
 * QueryClientProvider. See ADR 0001.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
	const queryClient = useQueryClient();

	// Bootstrap once on mount: rehydrate display cache, then reconcile with the
	// token (the sole credential) and revalidate via me().
	useEffect(() => {
		let cancelled = false;

		(async () => {
			await useAuthStore.persist.rehydrate();

			const token = tokenStore.getAccessToken();
			if (!token) {
				// No credential → ignore any cached user (stale display cache).
				useAuthStore.setState({ user: null, status: "unauthenticated" });
				return;
			}

			// Optimistic: if we have a cached user, show authenticated immediately.
			if (useAuthStore.getState().user) {
				useAuthStore.setState({ status: "authenticated" });
			}

			try {
				const res = await api.auth.me();
				if (!cancelled) useAuthStore.getState().setUser(res.data);
			} catch {
				// 401 paths are handled by onUnauthorized → signOut. If we never
				// reached authenticated (e.g. no cache + network error), settle to
				// unauthenticated rather than hang in `unknown`.
				if (!cancelled && useAuthStore.getState().status !== "authenticated") {
					useAuthStore.setState({ user: null, status: "unauthenticated" });
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, []);

	// Purge the query cache whenever the session ends, so one user's cached data
	// (bookings, rewards, …) can't leak to the next on a shared browser.
	useEffect(() => {
		const unsub = useAuthStore.subscribe((state, prev) => {
			if (prev.status !== "unauthenticated" && state.status === "unauthenticated") {
				queryClient.clear();
			}
		});
		return unsub;
	}, [queryClient]);

	return <>{children}</>;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd sites/marketing-site && bunx vitest run src/components/__tests__/AuthProvider.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire AuthProvider into Providers**

Replace the entire contents of `sites/marketing-site/src/components/Providers.tsx` with:

```tsx
"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useRef } from "react";
import { makeQueryClient } from "../lib/query-client";
import { AuthProvider } from "./AuthProvider";

export function Providers({ children }: { children: React.ReactNode }) {
	const clientRef = useRef<ReturnType<typeof makeQueryClient> | null>(null);
	if (!clientRef.current) clientRef.current = makeQueryClient();
	return (
		<QueryClientProvider client={clientRef.current}>
			<AuthProvider>{children}</AuthProvider>
		</QueryClientProvider>
	);
}
```

- [ ] **Step 6: Run the full suite**

Run: `bun run --filter @repo/marketing-site test`
Expected: PASS — all suites green.

- [ ] **Step 7: Commit**

```bash
git add sites/marketing-site/src/components/AuthProvider.tsx sites/marketing-site/src/components/__tests__/AuthProvider.test.tsx sites/marketing-site/src/components/Providers.tsx
git commit -m "feat(marketing-site): AuthProvider bootstraps auth store + clears cache on logout"
```

---

## Task 5: Route `onUnauthorized` through the store

**Files:**
- Modify: `sites/marketing-site/src/lib/api.ts`

- [ ] **Step 1: Update `onUnauthorized`**

In `sites/marketing-site/src/lib/api.ts`, add the store import at the top (after the existing imports):

```ts
import { useAuthStore } from "@/stores/auth-store";
```

Then replace the `onUnauthorized` handler so it resets store state (which the provider observes to clear the cache) before redirecting:

```ts
	onUnauthorized: () => {
		useAuthStore.getState().signOut();
		if (typeof window !== "undefined") {
			window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
		}
	},
```

(The store's `signOut` already calls `tokenStore.clearTokens()`, so the standalone `tokenStore.clearTokens()` line is removed.)

- [ ] **Step 2: Verify the suite still passes**

Run: `bun run --filter @repo/marketing-site test`
Expected: PASS — no behavioural test depends on the old handler body; this is a wiring change.

- [ ] **Step 3: Commit**

```bash
git add sites/marketing-site/src/lib/api.ts
git commit -m "refactor(marketing-site): onUnauthorized resets auth store (single signOut path)"
```

---

## Task 6: Prime the store on the OAuth callback

**Files:**
- Modify: `sites/marketing-site/src/app/auth/callback/page.tsx`

- [ ] **Step 1: Update the callback to set the user before redirecting**

In `sites/marketing-site/src/app/auth/callback/page.tsx`, add the store import:

```ts
import { useAuthStore } from "@/stores/auth-store";
```

Replace the `.then((tokens) => { ... })` block so the store is primed from a fresh `me()` (avoiding a post-login refetch and a flash):

```ts
			.then(async (tokens) => {
				await tokenStore.setTokens(tokens.accessToken, tokens.refreshToken);
				try {
					const res = await api.auth.me();
					useAuthStore.getState().setUser(res.data);
				} catch {
					// Tokens are set; AuthProvider will revalidate on the next page.
				}
				router.replace(next);
			})
```

- [ ] **Step 2: Type-check / build the route**

Run: `cd sites/marketing-site && bunx tsc --noEmit`
Expected: PASS — no type errors (`api.auth.me()` returns `{ data: AuthUser }`, matching `setUser`).

- [ ] **Step 3: Commit**

```bash
git add sites/marketing-site/src/app/auth/callback/page.tsx
git commit -m "feat(marketing-site): prime auth store on OAuth callback"
```

---

## Task 7: Nav — neutral slot for `unknown`, status-driven branches

**Files:**
- Modify: `sites/marketing-site/src/components/Nav.tsx`
- Test: `sites/marketing-site/src/components/__tests__/Nav.auth.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `sites/marketing-site/src/components/__tests__/Nav.auth.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => useAuthMock() }));
vi.mock("@/hooks/useNotifications", () => ({
	useNotifications: () => ({ data: [] }),
	useMarkNotificationRead: () => ({ mutate: vi.fn() }),
	useMarkAllNotificationsRead: () => ({ mutate: vi.fn() }),
}));

import { Nav } from "../Nav";

beforeEach(() => useAuthMock.mockReset());

describe("Nav auth slot", () => {
	it("renders neither Sign in nor Profile while status is unknown", () => {
		useAuthMock.mockReturnValue({
			user: null,
			status: "unknown",
			signOut: vi.fn(),
		});
		render(<Nav />);
		expect(screen.queryByText("Sign in")).toBeNull();
		expect(screen.queryByText("Sign out")).toBeNull();
	});

	it("renders Sign in when unauthenticated", () => {
		useAuthMock.mockReturnValue({
			user: null,
			status: "unauthenticated",
			signOut: vi.fn(),
		});
		render(<Nav />);
		expect(screen.getAllByText("Sign in").length).toBeGreaterThan(0);
	});

	it("renders the profile name when authenticated", () => {
		useAuthMock.mockReturnValue({
			user: { id: "u1", email: null, name: "Sara Khan", role: "user" },
			status: "authenticated",
			signOut: vi.fn(),
		});
		render(<Nav />);
		expect(screen.getByText("Sara")).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd sites/marketing-site && bunx vitest run src/components/__tests__/Nav.auth.test.tsx`
Expected: FAIL — current Nav branches on `user ?` only, so the `unknown` case renders "Sign in" (no neutral slot), failing the first assertion.

- [ ] **Step 3: Make Nav status-driven**

In `sites/marketing-site/src/components/Nav.tsx`:

1. Destructure `status` from `useAuth`:

```tsx
	const { user, status, signOut } = useAuth();
```

2. In the **desktop** auth area, replace the `{user ? ( … ) : ( … )}` ternary with a three-way branch. The `unknown` branch renders a fixed-size neutral placeholder so layout is stable and no flash occurs:

```tsx
				{status === "unknown" ? (
					<div className="w-9 h-9" aria-hidden />
				) : status === "authenticated" && user ? (
					<>
						{/* …existing authenticated block: notifications bell, profile link, Sign out… */}
					</>
				) : (
					<>
						{/* …existing unauthenticated block: Sign in link, Get the app button… */}
					</>
				)}
```

Keep the existing JSX inside the authenticated and unauthenticated branches exactly as-is (the notifications bell, `Link href="/account"`, the `signOut` button, the `Sign in` link, and the `Get the app` button).

3. In the **mobile** menu, apply the same guard: render nothing auth-related for `unknown`, otherwise the existing authenticated / unauthenticated blocks:

```tsx
					{status === "unknown" ? null : user ? (
						<>
							{/* …existing mobile authenticated block… */}
						</>
					) : (
						<>
							{/* …existing mobile unauthenticated block… */}
						</>
					)}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd sites/marketing-site && bunx vitest run src/components/__tests__/Nav.auth.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add sites/marketing-site/src/components/Nav.tsx sites/marketing-site/src/components/__tests__/Nav.auth.test.tsx
git commit -m "feat(marketing-site): Nav renders neutral slot until auth status resolves"
```

---

## Task 8: Account page — guard, name refresh, store-routed sign-out/delete

**Files:**
- Modify: `sites/marketing-site/src/app/account/page.tsx`

This page uses `useAuth()` and currently relies on `["auth","me"]` invalidation + inline token clearing. Update three spots.

> **Note (post-`develop` merge):** the page now has two early-return render guards — `if (isLoading)` (skeleton) and `if (!user)` ("please log in" message). Leave both as-is; they remain correct under the new model (`isLoading = status === "unknown"` → skeleton; `status === "unauthenticated"` → the redirect effect fires while the `!user` message shows transiently). Do not modify those render blocks — only the three spots below.

- [ ] **Step 1: Add the store import**

Near the existing imports in `sites/marketing-site/src/app/account/page.tsx`, add:

```ts
import { useAuthStore } from "@/stores/auth-store";
```

And destructure `status` from `useAuth`:

```ts
	const { user, isLoading, status } = useAuth();
```

- [ ] **Step 2: Simplify the redirect guard to use `status`**

Replace the existing guard effect:

```ts
	useEffect(() => {
		if (!isLoading && !user && !tokenStore.getAccessToken()) {
			router.replace(`/login?next=/account`);
		}
	}, [user, isLoading, router]);
```

with:

```ts
	useEffect(() => {
		if (status === "unauthenticated") {
			router.replace(`/login?next=/account`);
		}
	}, [status, router]);
```

- [ ] **Step 3: Refresh the store after a name edit (replaces the `["auth","me"]` invalidation)**

In `updateNameMut`, replace the `onSuccess` body:

```ts
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["auth", "me"] });
			setEditingName(false);
		},
```

with an optimistic store update (the new name is already known locally; `user` is non-null here):

```ts
		onSuccess: (_data, name) => {
			if (user) useAuthStore.getState().setUser({ ...user, name });
			setEditingName(false);
		},
```

- [ ] **Step 4: Route the sign-out button and delete-account flow through the store**

In the **Sign out** button's `onClick`, replace:

```ts
							onClick={async () => {
								try {
									await api.auth.logout();
								} finally {
									tokenStore.clearTokens();
									router.replace("/");
								}
							}}
```

with:

```ts
							onClick={async () => {
								try {
									await api.auth.logout();
								} finally {
									useAuthStore.getState().signOut();
									router.replace("/");
								}
							}}
```

In `deleteAccountMut.onSuccess`, replace `tokenStore.clearTokens();` with `useAuthStore.getState().signOut();` (keep the surrounding `api.auth.logout()` try/catch, `qc.clear()`, and `router.replace("/")`):

```ts
		onSuccess: async () => {
			try {
				await api.auth.logout();
			} catch {
				/* ignore */
			}
			useAuthStore.getState().signOut();
			qc.clear();
			router.replace("/");
		},
```

- [ ] **Step 5: Type-check**

Run: `cd sites/marketing-site && bunx tsc --noEmit`
Expected: PASS. If `tokenStore` is now unused in this file, remove it from the `@/lib/api` import to satisfy lint.

- [ ] **Step 6: Run the full suite**

Run: `bun run --filter @repo/marketing-site test`
Expected: PASS — all suites green.

- [ ] **Step 7: Commit**

```bash
git add sites/marketing-site/src/app/account/page.tsx
git commit -m "refactor(marketing-site): account page uses auth store for guard, name refresh, sign-out"
```

---

## Task 9: Verification + docs

**Files:**
- Modify: `sites/marketing-site/AGENTS.md`

- [ ] **Step 1: Update the Auth convention note**

In `sites/marketing-site/AGENTS.md`, replace the existing **Auth** bullet (under "Key conventions") with:

```md
- **Auth**: Google OAuth redirect flow via `api.auth.getGoogleUrl()` → browser redirect → `GET /auth/callback?code=&state=`. Client auth state lives in a **zustand store** (`src/stores/auth-store.ts`) — the single source of truth for UI auth state (`user` + `status`: `unknown | authenticated | unauthenticated`). `tokenStore` (`@repo/api-client`) holds the raw tokens and is the **sole credential**; the persisted `user` is a display-only cache, never trusted without a live token. `AuthProvider` (in `Providers`) bootstraps via `auth.me()` and clears the query cache on logout. `useAuth()` selects from the store (`{ user, status, isLoading, signOut }`). See [ADR 0001](../../docs/adr/0001-marketing-site-auth-state-with-zustand.md).
```

- [ ] **Step 2: Lint**

Run: `bun run --filter @repo/marketing-site lint`
Expected: PASS (no Biome errors). Fix any unused-import or formatting issues it reports.

- [ ] **Step 3: Full test suite**

Run: `bun run --filter @repo/marketing-site test`
Expected: PASS — `auth-store`, `useAuth`, `AuthProvider`, `Nav.auth`, and the pre-existing `Stars` suite all green.

- [ ] **Step 4: Build**

Run (from worktree root): `bun run build`
Expected: PASS — the monorepo build (including marketing-site) completes with no type errors.

- [ ] **Step 5: Manual smoke test**

Run: `bun run marketing-site:dev` → open `http://localhost:3000`.

Verify:
1. **Logged-out reload** → Nav shows "Sign in" (after a brief neutral frame), never a Profile flash.
2. **Sign in with Google** → after the callback redirect, Nav immediately shows the profile name + bell with no extra `me()` flash.
3. **Reload while logged in** → Profile shows immediately (optimistic from persist), no "Sign in" flash.
4. **Sign out** → returns to home, Nav shows "Sign in".
5. **Edit name on `/account`** → the displayed name updates without a manual refresh.

- [ ] **Step 6: Commit**

```bash
git add sites/marketing-site/AGENTS.md
git commit -m "docs(marketing-site): document zustand auth state in AGENTS.md"
```

---

## Self-Review notes (for the implementer)

- **Spec coverage:** Token-as-credential (Tasks 2, 4), neutral-`unknown`/optimistic-`authenticated` (Tasks 4, 7), pure store + provider cache-clear (Tasks 2, 4), single `signOut` (Tasks 3, 5, 8), cross-tab deferred (no task — deliberate). Migration points — name-edit refresh (Task 8) and guard simplification (Task 8) — covered.
- **Type consistency:** `setUser(user: AuthUser)`, `status: AuthStatus`, `api.auth.me(): { data: AuthUser }`, `useAuthStore.getState().signOut()` used identically across Tasks 2–8.
- **Not in this phase:** `photoUrl` (Phase 3), profile/booking/review UI (Phases 1–2). Do not add them here.
