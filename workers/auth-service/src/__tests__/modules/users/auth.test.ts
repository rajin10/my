import { describe, expect, it } from "vitest";
import app from "../../../app";

describe("auth-service /api/v1/users", () => {
	it("returns 401 when missing Bearer token", async () => {
		const res = await app.request("/api/v1/users/any", { method: "GET" }, {
			ENVIRONMENT: "test",
			ALLOWED_ORIGINS: "",
			PUBLIC_R2_URL: "storage.talash.bd",
			JWT_SECRET: "test-secret",
			GOOGLE_CLIENT_ID: "test-client",
			GOOGLE_CLIENT_SECRET: "test-secret",
			TALASH_DB: {} as unknown as D1Database,
			TALASH_KV: {
				get: async () => null,
				put: async () => undefined,
				delete: async () => undefined,
			} as unknown as KVNamespace,
			TALASH_STORAGE: {} as unknown as R2Bucket,
		} as unknown as CloudflareBindings);
		expect(res.status).toBe(401);
	});
});
