import { $ } from "bun";

export type Semver = [number, number, number];

export function parseVersion(raw: string): Semver {
	const match = raw.trim().match(/(\d+)\.(\d+)\.(\d+)/);
	if (!match) return [0, 0, 0];
	return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function meetsMinimum(actual: Semver, minimum: Semver): boolean {
	for (let i = 0; i < 3; i++) {
		if (actual[i] > minimum[i]) return true;
		if (actual[i] < minimum[i]) return false;
	}
	return true;
}

export async function checkPrerequisites(): Promise<void> {
	const bunVersion = parseVersion(process.versions.bun ?? "0.0.0");
	if (!meetsMinimum(bunVersion, [1, 3, 0])) {
		throw new Error(`Bun 1.3+ required (found ${process.versions.bun})`);
	}
	const nodeVersion = parseVersion(process.versions.node);
	if (!meetsMinimum(nodeVersion, [20, 0, 0])) {
		throw new Error(`Node 20+ required (found ${process.versions.node})`);
	}
	const wrangler = await $`bunx wrangler --version`.quiet().nothrow();
	if (wrangler.exitCode !== 0) {
		throw new Error(
			"wrangler not found — run: bun add -g wrangler (or bunx wrangler)",
		);
	}
}
