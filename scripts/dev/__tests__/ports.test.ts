// scripts/dev/__tests__/ports.test.ts
import { describe, expect, test } from "bun:test";
import { createServer } from "node:net";
import { findBlockedPorts, isPortFree } from "../ports.ts";

function listen(port: number): Promise<ReturnType<typeof createServer>> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.once("error", reject);
		server.listen(port, "127.0.0.1", () => resolve(server));
	});
}

describe("ports", () => {
	test("isPortFree false when port is bound", async () => {
		const server = await listen(0);
		const addr = server.address();
		const port = typeof addr === "object" && addr ? addr.port : 0;
		expect(await isPortFree(port)).toBe(false);
		server.close();
	});

	test("findBlockedPorts lists occupied ports", async () => {
		const server = await listen(0);
		const addr = server.address();
		const port = typeof addr === "object" && addr ? addr.port : 0;
		const blocked = await findBlockedPorts([port, 59999]);
		expect(blocked).toEqual([port]);
		server.close();
	});
});
