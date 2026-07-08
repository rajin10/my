// scripts/dev/__tests__/env-writer.test.ts
import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeEnvFiles } from "../env-writer.ts";

const secrets = {
	jwtSecret: "test-jwt-secret-min-32-chars-long!!",
	googleClientSecret: "GOCSPX-test-secret",
};

describe("writeEnvFiles", () => {
	test("writes all five env files when missing", async () => {
		const dir = await mkdtemp(join(tmpdir(), "talash-env-"));
		const root = join(dir, "repo");
		for (const rel of [
			"workers/api",
			"sites/marketing-site",
			"sites/business-dashboard",
			"apps/mobile-app",
			"apps/owner-app",
		]) {
			await Bun.write(join(root, rel, ".gitkeep"), "");
		}
		const result = await writeEnvFiles(root, secrets, { force: true });
		expect(result.written).toHaveLength(5);
		const api = await Bun.file(join(root, "workers/api/.dev.vars")).text();
		expect(api).toContain("JWT_SECRET");
		await rm(dir, { recursive: true, force: true });
	});

	test("skips when localhost env already correct and force false", async () => {
		const dir = await mkdtemp(join(tmpdir(), "talash-env-skip-"));
		const root = join(dir, "repo");
		const mobileDir = join(root, "apps/mobile-app");
		await Bun.write(join(mobileDir, ".gitkeep"), "");
		await Bun.write(
			join(mobileDir, ".env"),
			"EXPO_PUBLIC_API_URL=http://localhost:8787\nEXPO_PUBLIC_AUTH_PROVIDER=redirect\n",
		);
		// Only mobile path exists — others will be written
		const result = await writeEnvFiles(root, secrets, { force: false });
		expect(result.skipped).toContain("mobileEnv");
		await rm(dir, { recursive: true, force: true });
	});
});
