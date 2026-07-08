import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { DevSecrets } from "./constants.ts";
import { envTargets } from "./paths.ts";
import { isLocalDevEnv, renderAllEnvFiles } from "./templates.ts";

type WriteResult = { written: string[]; skipped: string[] };

const RENDER_KEY: Record<string, keyof ReturnType<typeof renderAllEnvFiles>> = {
	apiDevVars: "apiDevVars",
	marketingEnv: "marketingEnv",
	dashboardEnv: "dashboardEnv",
	mobileEnv: "mobileEnv",
	ownerEnv: "ownerEnv",
};

export async function writeEnvFiles(
	root: string,
	secrets: DevSecrets,
	opts: { force: boolean },
): Promise<WriteResult> {
	const rendered = renderAllEnvFiles(secrets);
	const written: string[] = [];
	const skipped: string[] = [];

	for (const target of envTargets(root)) {
		const abs = join(root, target.relativePath);
		await mkdir(dirname(abs), { recursive: true });
		const file = Bun.file(abs);
		const renderKey = RENDER_KEY[target.key];
		const content = rendered[renderKey];

		if (!opts.force && (await file.exists())) {
			const existing = await file.text();
			if (isLocalDevEnv(target.key, existing)) {
				skipped.push(target.key);
				continue;
			}
		}

		await Bun.write(abs, content);
		written.push(target.key);
	}

	return { written, skipped };
}
