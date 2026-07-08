import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError } from "../client";

function mockFetch(
	status: number,
	body: unknown,
	headers: Record<string, string> = {},
) {
	return vi.fn().mockResolvedValue({
		status,
		ok: status >= 200 && status < 300,
		headers: {
			get: (key: string) => headers[key.toLowerCase()] ?? null,
		},
		json: vi.fn().mockResolvedValue(body),
	});
}

beforeEach(() => {
	vi.resetAllMocks();
});

describe("ApiClient.get", () => {
	it("sends GET with Authorization header when token is present", async () => {
		const fetch = mockFetch(200, { data: "ok" });
		vi.stubGlobal("fetch", fetch);

		const client = new ApiClient({
			baseUrl: "https://api.test",
			getToken: () => "tok123",
		});
		await client.get("/users");

		const [url, init] = fetch.mock.calls[0] as [
			string,
			RequestInit & { headers: Record<string, string> },
		];
		expect(url).toBe("https://api.test/users");
		expect(init.headers.Authorization).toBe("Bearer tok123");
	});

	it("sends GET without Authorization header when no token", async () => {
		const fetch = mockFetch(200, { items: [] });
		vi.stubGlobal("fetch", fetch);

		const client = new ApiClient({ baseUrl: "https://api.test" });
		await client.get("/businesses");

		const [, init] = fetch.mock.calls[0] as [
			string,
			RequestInit & { headers: Record<string, string> },
		];
		expect(init.headers.Authorization).toBeUndefined();
	});

	it("appends query string parameters", async () => {
		const fetch = mockFetch(200, {});
		vi.stubGlobal("fetch", fetch);

		const client = new ApiClient({ baseUrl: "https://api.test" });
		await client.get("/businesses", { page: 2, limit: 10 });

		const [url] = fetch.mock.calls[0] as [string];
		expect(url).toContain("page=2");
		expect(url).toContain("limit=10");
	});

	it("omits undefined query parameters", async () => {
		const fetch = mockFetch(200, {});
		vi.stubGlobal("fetch", fetch);

		const client = new ApiClient({ baseUrl: "https://api.test" });
		await client.get("/businesses", { page: 1, search: undefined });

		const [url] = fetch.mock.calls[0] as [string];
		expect(url).not.toContain("search");
	});
});

describe("ApiClient error handling", () => {
	it("throws ApiError with server code and message on non-2xx response", async () => {
		const fetch = mockFetch(404, {
			code: "NOT_FOUND",
			message: "Business not found",
		});
		vi.stubGlobal("fetch", fetch);

		const client = new ApiClient({ baseUrl: "https://api.test" });
		await expect(client.get("/businesses/missing")).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Business not found",
			status: 404,
		});
	});

	it("throws ApiError with fallback code when server returns no body", async () => {
		const fetch = mockFetch(500, null);
		vi.stubGlobal("fetch", fetch);

		const client = new ApiClient({ baseUrl: "https://api.test" });
		const err = await client.get("/crash").catch((e) => e);
		expect(err).toBeInstanceOf(ApiError);
		expect(err.status).toBe(500);
	});
});

describe("ApiClient 401 token refresh", () => {
	it("retries request with new token after successful refresh", async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce({
				status: 401,
				ok: false,
				headers: { get: () => null },
				json: vi.fn().mockResolvedValue(null),
			})
			.mockResolvedValueOnce({
				status: 200,
				ok: true,
				headers: { get: () => null },
				json: vi.fn().mockResolvedValue({ id: "u-1" }),
			});
		vi.stubGlobal("fetch", fetch);

		let currentToken = "old-token";
		const tryRefresh = vi.fn().mockImplementation(async () => {
			currentToken = "new-token";
			return currentToken;
		});

		const client = new ApiClient({
			baseUrl: "https://api.test",
			getToken: () => currentToken,
			tryRefresh,
		});

		const result = await client.get<{ id: string }>("/me");
		expect(result.id).toBe("u-1");
		expect(tryRefresh).toHaveBeenCalledOnce();
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it("calls onUnauthorized and throws when refresh returns null", async () => {
		const fetch = mockFetch(401, null);
		vi.stubGlobal("fetch", fetch);

		const onUnauthorized = vi.fn();
		const client = new ApiClient({
			baseUrl: "https://api.test",
			getToken: () => "expired",
			tryRefresh: async () => null,
			onUnauthorized,
		});

		await expect(client.get("/me")).rejects.toMatchObject({ status: 401 });
		expect(onUnauthorized).toHaveBeenCalledOnce();
	});

	it("deduplicates concurrent 401s into a single refresh call", async () => {
		const fetch = vi.fn().mockResolvedValue({
			status: 401,
			ok: false,
			headers: { get: () => null },
			json: vi.fn().mockResolvedValue(null),
		});
		vi.stubGlobal("fetch", fetch);

		const tryRefresh = vi.fn().mockResolvedValue(null);
		const onUnauthorized = vi.fn();

		const client = new ApiClient({
			baseUrl: "https://api.test",
			getToken: () => "tok",
			tryRefresh,
			onUnauthorized,
		});

		await Promise.allSettled([
			client.get("/a"),
			client.get("/b"),
			client.get("/c"),
		]);

		expect(tryRefresh).toHaveBeenCalledOnce();
	});

	it("does not retry when no tryRefresh is configured", async () => {
		const fetch = mockFetch(401, null);
		vi.stubGlobal("fetch", fetch);

		const onUnauthorized = vi.fn();
		const client = new ApiClient({
			baseUrl: "https://api.test",
			onUnauthorized,
		});

		await expect(client.get("/me")).rejects.toMatchObject({ status: 401 });
		expect(fetch).toHaveBeenCalledOnce();
		expect(onUnauthorized).toHaveBeenCalledOnce();
	});

	it("does not refresh or sign out on OAuth callback 401", async () => {
		const fetch = vi.fn().mockResolvedValue({
			status: 401,
			ok: false,
			headers: { get: () => null },
			json: vi.fn().mockResolvedValue({
				ok: false,
				code: "UNAUTHORIZED",
				message: "Invalid or expired OAuth state.",
			}),
		});
		vi.stubGlobal("fetch", fetch);

		const tryRefresh = vi.fn();
		const onUnauthorized = vi.fn();
		const client = new ApiClient({
			baseUrl: "https://api.test",
			getToken: () => "stale",
			tryRefresh,
			onUnauthorized,
		});

		await expect(
			client.post("/api/v1/auth/google/callback", {
				code: "c",
				state: "s",
				redirect_uri: "https://talash.bd/auth/callback",
			}),
		).rejects.toMatchObject({
			status: 401,
			message: "Invalid or expired OAuth state.",
		});
		expect(tryRefresh).not.toHaveBeenCalled();
		expect(onUnauthorized).not.toHaveBeenCalled();
	});
});

describe("search.businesses endpoint", () => {
	it("search.businesses forwards vertical/area/lat/lng params", async () => {
		const calls: Array<{ path: string; params: unknown }> = [];
		const client = {
			get: (path: string, params: unknown) => {
				calls.push({ path, params });
				return Promise.resolve({ data: [], aiRanked: false });
			},
		} as never;
		const { createSearchEndpoints } = await import("../endpoints/search");
		const ep = createSearchEndpoints(client);
		await ep.businesses({
			vertical: "commerce",
			area: "Banani",
			lat: 23.78,
			lng: 90.4,
		});
		expect(calls[0]?.path).toBe("/api/v1/search");
		expect(calls[0]?.params).toMatchObject({
			vertical: "commerce",
			area: "Banani",
			lat: 23.78,
			lng: 90.4,
		});
	});
});

describe("ApiClient.post / patch / delete", () => {
	it("sends POST with JSON body", async () => {
		const fetch = mockFetch(201, { id: "new-1" });
		vi.stubGlobal("fetch", fetch);

		const client = new ApiClient({ baseUrl: "https://api.test" });
		await client.post("/businesses", { name: "Spa" });

		const [, init] = fetch.mock.calls[0] as [
			string,
			RequestInit & { headers: Record<string, string> },
		];
		expect(init.method).toBe("POST");
		expect(init.body).toBe(JSON.stringify({ name: "Spa" }));
		expect(init.headers["Content-Type"]).toBe("application/json");
	});

	it("sends PATCH with JSON body", async () => {
		const fetch = mockFetch(200, { id: "v-1", name: "New Name" });
		vi.stubGlobal("fetch", fetch);

		const client = new ApiClient({ baseUrl: "https://api.test" });
		await client.patch("/businesses/v-1", { name: "New Name" });

		const [, init] = fetch.mock.calls[0] as [string, RequestInit];
		expect(init.method).toBe("PATCH");
	});

	it("sends DELETE with no body", async () => {
		const fetch = mockFetch(204, null, { "content-length": "0" });
		vi.stubGlobal("fetch", fetch);

		const client = new ApiClient({ baseUrl: "https://api.test" });
		await client.delete("/businesses/v-1");

		const [, init] = fetch.mock.calls[0] as [string, RequestInit];
		expect(init.method).toBe("DELETE");
	});
});

describe("ApiClient next/revalidate forwarding (SSR Data Cache)", () => {
	it("forwards config.next into the fetch init when configured", async () => {
		const fetch = mockFetch(200, { data: "ok" });
		vi.stubGlobal("fetch", fetch);

		const client = new ApiClient({
			baseUrl: "https://api.test",
			next: { revalidate: 300 },
		});
		await client.get("/businesses/abc");

		const [, init] = fetch.mock.calls[0] as [
			string,
			RequestInit & { next?: { revalidate?: number } },
		];
		expect(init.next).toEqual({ revalidate: 300 });
	});

	it("omits next from the fetch init when not configured (browser caller)", async () => {
		const fetch = mockFetch(200, {});
		vi.stubGlobal("fetch", fetch);

		const client = new ApiClient({ baseUrl: "https://api.test" });
		await client.get("/businesses");

		const [, init] = fetch.mock.calls[0] as [
			string,
			RequestInit & { next?: unknown },
		];
		expect(init.next).toBeUndefined();
	});
});
