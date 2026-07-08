import { describe, expect, it } from "vitest";
import app from "../../../app";

describe("auth-service /api/v1/auth/refresh", () => {
	it("returns 401 on invalid refresh token", async () => {
		const kv: KVNamespace = {
			get: async () => null,
			put: async () => undefined,
			delete: async () => undefined,
		} as unknown as KVNamespace;

		const res = await app.request(
			"/api/v1/auth/refresh",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ refreshToken: "bad-token" }),
			},
			{
				ENVIRONMENT: "test",
				ALLOWED_ORIGINS: "",
				JWT_SECRET: "test-secret",
				GOOGLE_CLIENT_ID: "test-client",
				GOOGLE_CLIENT_SECRET: "test-secret",
				TALASH_DB: {} as unknown as D1Database,
				TALASH_KV: kv,
				TALASH_STORAGE: {} as unknown as R2Bucket,
			} as unknown as CloudflareBindings,
		);
		expect(res.status).toBe(401);
	});
});
