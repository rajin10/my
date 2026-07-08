// scripts/dev/__tests__/paths.test.ts
import { describe, expect, test } from "bun:test";
import { envTargets, repoRoot } from "../paths.ts";

describe("paths", () => {
	test("envTargets lists all five local env files", () => {
		const keys = envTargets(repoRoot()).map((t) => t.key);
		expect(keys).toEqual([
			"apiDevVars",
			"marketingEnv",
			"dashboardEnv",
			"mobileEnv",
			"ownerEnv",
		]);
	});

	test("repoRoot ends at monorepo root (has package.json workspaces)", async () => {
		const root = repoRoot();
		const pkg = await Bun.file(`${root}/package.json`).json();
		expect(pkg.workspaces).toBeDefined();
	});
});
