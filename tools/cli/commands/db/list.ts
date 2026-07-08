import { defineCommand } from "citty";
import { spawnInWorker, validateEnv } from "../../core/exec.ts";
import { log } from "../../core/logger.ts";

export default defineCommand({
	meta: {
		name: "list",
		description: "List migrations and their applied status",
	},
	args: {
		env: {
			type: "string",
			description: "Target environment: local (default) | production",
			default: "local",
		},
	},
	run({ args }) {
		const env = validateEnv(args.env);
		const isRemote = env === "production";

		if (isRemote) {
			log.warn("Listing migrations from remote D1.");
		}

		spawnInWorker(
			[
				"bunx",
				"wrangler",
				"d1",
				"migrations",
				"list",
				"TALASH_DB",
				isRemote ? "--remote" : "--local",
			],
			"Failed to list migrations.",
		);
	},
});
