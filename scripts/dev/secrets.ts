import { stdin as input, stdout as output } from "node:process";
import * as readline from "node:readline/promises";
import type { DevSecrets } from "./constants.ts";

export function parseSecretsJson(raw: string): DevSecrets {
	const data = JSON.parse(raw) as Partial<DevSecrets>;
	if (!data.jwtSecret?.trim() || !data.googleClientSecret?.trim()) {
		throw new Error(
			"TALASH_DEV_SECRETS must include jwtSecret and googleClientSecret",
		);
	}
	return {
		jwtSecret: data.jwtSecret.trim(),
		googleClientSecret: data.googleClientSecret.trim(),
	};
}

export async function resolveSecrets(): Promise<{
	secrets: DevSecrets;
	source: "env" | "interactive";
}> {
	const fromEnv = process.env.TALASH_DEV_SECRETS;
	if (fromEnv) {
		return { secrets: parseSecretsJson(fromEnv), source: "env" };
	}

	if (!process.stdin.isTTY) {
		console.error(
			"Missing TALASH_DEV_SECRETS. Set JSON { jwtSecret, googleClientSecret } or run interactively.",
		);
		console.error("See docs/guides/google-auth.md for team vault values.");
		process.exit(1);
	}

	const rl = readline.createInterface({ input, output });
	try {
		const jwtSecret = await rl.question("JWT_SECRET: ");
		const googleClientSecret = await rl.question("GOOGLE_CLIENT_SECRET: ");
		if (!jwtSecret.trim() || !googleClientSecret.trim()) {
			throw new Error("Both secrets are required");
		}
		return {
			secrets: {
				jwtSecret: jwtSecret.trim(),
				googleClientSecret: googleClientSecret.trim(),
			},
			source: "interactive",
		};
	} finally {
		rl.close();
	}
}
