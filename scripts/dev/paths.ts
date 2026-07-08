import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function repoRoot(): string {
	// scripts/dev/paths.ts → repo root is two levels up from scripts/dev
	return join(dirname(fileURLToPath(import.meta.url)), "../..");
}

export type EnvTarget = {
	key: string;
	relativePath: string;
};

export function envTargets(_root: string): EnvTarget[] {
	return [
		{ key: "apiDevVars", relativePath: "workers/api/.dev.vars" },
		{ key: "marketingEnv", relativePath: "sites/marketing-site/.env.local" },
		{
			key: "dashboardEnv",
			relativePath: "sites/business-dashboard/.env.local",
		},
		{ key: "mobileEnv", relativePath: "apps/mobile-app/.env" },
		{ key: "ownerEnv", relativePath: "apps/owner-app/.env" },
	];
}

export function markerPath(root: string): string {
	return join(root, ".talash/dev-setup.json");
}
