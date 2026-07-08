export class ApiError extends Error {
	constructor(
		public readonly code: string,
		message: string,
		public readonly status: number,
	) {
		super(message);
		this.name = "ApiError";
	}
}

/**
 * Next.js fetch cache config (the `next` field on `fetch` init). An opaque
 * pass-through — Next's runtime reads it to populate the Data Cache; non-Next
 * runtimes (browser, React Native) ignore it. Set on a server caller to opt
 * its reads into ISR-style revalidation.
 */
export interface NextFetchConfig {
	revalidate?: number | false;
	tags?: string[];
}

export interface ApiClientConfig {
	baseUrl: string;
	getToken?: () => string | null;
	onUnauthorized?: () => void;
	/** Return a fresh access token, or null if refresh failed. Called once on 401 before giving up. */
	tryRefresh?: () => Promise<string | null>;
	/**
	 * Default Next.js fetch cache config applied to every request from this
	 * caller. Used by the marketing-site server caller (`revalidate: 300`) so
	 * public reads can be served from Next's Data Cache. **Inert without an
	 * OpenNext incremental-cache override** (none wired today), so it only
	 * dedupes within a single render until that infra lands. Unset on browser
	 * callers, so they are unaffected.
	 */
	next?: NextFetchConfig;
}

export class ApiClient {
	private _refreshing: Promise<string | null> | null = null;

	constructor(private readonly config: ApiClientConfig) {}

	/** Public auth routes: 401 means invalid credentials, not a stale session. */
	private shouldAttemptRefreshOn401(path: string): boolean {
		if (path.startsWith("/api/v1/auth/google")) return false;
		if (path === "/api/v1/auth/register") return false;
		if (path === "/api/v1/auth/login") return false;
		if (path === "/api/v1/auth/forgot-password") return false;
		if (path === "/api/v1/auth/reset-password") return false;
		if (path === "/api/v1/auth/refresh") return false;
		return true;
	}

	private async request<T>(
		path: string,
		init: RequestInit = {},
		isRetry = false,
	): Promise<T> {
		const token = this.config.getToken?.();
		const isFormData = init.body instanceof FormData;
		const headers: Record<string, string> = {
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...(!isFormData ? { "Content-Type": "application/json" } : {}),
			...(init.headers as Record<string, string> | undefined),
		};

		const fetchInit: RequestInit & { next?: NextFetchConfig } = {
			...init,
			headers,
		};
		if (this.config.next) fetchInit.next = this.config.next;

		const res = await fetch(`${this.config.baseUrl}${path}`, fetchInit);

		if (res.status === 401) {
			// Try refresh once — deduplicate concurrent 401s into a single refresh call
			if (
				!isRetry &&
				this.config.tryRefresh &&
				this.shouldAttemptRefreshOn401(path)
			) {
				if (!this._refreshing) {
					this._refreshing = this.config.tryRefresh().finally(() => {
						this._refreshing = null;
					});
				}
				let newToken: string | null = null;
				try {
					newToken = await this._refreshing;
				} catch {
					// refresh network failure — fall through to onUnauthorized
				}
				if (newToken) {
					return this.request<T>(path, init, true);
				}
			}
			if (this.shouldAttemptRefreshOn401(path)) {
				this.config.onUnauthorized?.();
			}
			const d = (await res.json().catch(() => null)) as {
				code?: string;
				message?: string;
			} | null;
			throw new ApiError(
				d?.code ?? "UNAUTHORIZED",
				d?.message ?? "Unauthorized",
				401,
			);
		}

		const hasBody =
			res.status !== 204 && res.headers.get("content-length") !== "0";
		const data = hasBody ? await res.json().catch(() => null) : null;
		if (!res.ok) {
			const d = data as { code?: string; message?: string } | null;
			throw new ApiError(
				d?.code ?? "UNKNOWN",
				d?.message ?? "An error occurred",
				res.status,
			);
		}
		return (hasBody ? data : undefined) as T;
	}

	get<T>(
		path: string,
		params?: Record<string, string | number | boolean | undefined>,
	): Promise<T> {
		const defined = Object.entries(params ?? {}).filter(
			([, v]) => v !== undefined,
		) as [string, string | number | boolean][];
		const qs = defined.length
			? "?" +
				new URLSearchParams(defined.map(([k, v]) => [k, String(v)])).toString()
			: "";
		return this.request<T>(`${path}${qs}`);
	}

	post<T>(path: string, body?: unknown): Promise<T> {
		const isFormData = body instanceof FormData;
		return this.request<T>(path, {
			method: "POST",
			body: isFormData
				? body
				: body !== undefined
					? JSON.stringify(body)
					: undefined,
		});
	}

	patch<T>(path: string, body?: unknown): Promise<T> {
		return this.request<T>(path, {
			method: "PATCH",
			body: body !== undefined ? JSON.stringify(body) : undefined,
		});
	}

	put<T>(path: string, body?: unknown): Promise<T> {
		return this.request<T>(path, {
			method: "PUT",
			body: body !== undefined ? JSON.stringify(body) : undefined,
		});
	}

	delete<T>(path: string, body?: unknown): Promise<T> {
		return this.request<T>(path, {
			method: "DELETE",
			body: body !== undefined ? JSON.stringify(body) : undefined,
		});
	}

	async getBlob(
		path: string,
		params?: Record<string, string | number | boolean | undefined>,
		isRetry = false,
	): Promise<Blob> {
		const defined = Object.entries(params ?? {}).filter(
			([, v]) => v !== undefined,
		) as [string, string | number | boolean][];
		const qs = defined.length
			? "?" +
				new URLSearchParams(defined.map(([k, v]) => [k, String(v)])).toString()
			: "";
		const token = this.config.getToken?.();
		const headers: Record<string, string> = token
			? { Authorization: `Bearer ${token}` }
			: {};
		const res = await fetch(`${this.config.baseUrl}${path}${qs}`, { headers });
		if (res.status === 401) {
			if (
				!isRetry &&
				this.config.tryRefresh &&
				this.shouldAttemptRefreshOn401(path)
			) {
				if (!this._refreshing) {
					this._refreshing = this.config.tryRefresh().finally(() => {
						this._refreshing = null;
					});
				}
				let newToken: string | null = null;
				try {
					newToken = await this._refreshing;
				} catch {
					// refresh network failure — fall through to onUnauthorized
				}
				if (newToken) {
					return this.getBlob(path, params, true);
				}
			}
			if (this.shouldAttemptRefreshOn401(path)) {
				this.config.onUnauthorized?.();
			}
			throw new ApiError("UNAUTHORIZED", "Unauthorized", 401);
		}
		if (!res.ok) {
			const d = (await res.json().catch(() => null)) as {
				code?: string;
				message?: string;
			} | null;
			throw new ApiError(
				d?.code ?? "UNKNOWN",
				d?.message ?? "An error occurred",
				res.status,
			);
		}
		return res.blob();
	}
}
