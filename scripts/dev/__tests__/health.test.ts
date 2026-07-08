// scripts/dev/__tests__/health.test.ts
import { describe, expect, test } from "bun:test";
import { waitForHealth } from "../health.ts";

describe("waitForHealth", () => {
	test("resolves when server returns 200", async () => {
		const server = Bun.serve({
			port: 0,
			fetch(req) {
				if (new URL(req.url).pathname === "/health") {
					return Response.json({ status: "ok" });
				}
				return new Response("not found", { status: 404 });
			},
		});
		await expect(
			waitForHealth(`http://127.0.0.1:${server.port}/health`, {
				timeoutMs: 5000,
				pollMs: 100,
			}),
		).resolves.toBeUndefined();
		server.stop();
	});

	test("rejects on timeout", async () => {
		await expect(
			waitForHealth("http://127.0.0.1:59998/health", {
				timeoutMs: 300,
				pollMs: 100,
			}),
		).rejects.toThrow(/timeout/i);
	});
});
