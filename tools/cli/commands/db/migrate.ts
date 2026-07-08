import { defineCommand } from "citty";
import { spawnInWorker, validateEnv } from "../../core/exec.ts";
import { log } from "../../core/logger.ts";

export default defineCommand({
	meta: {
		name: "migrate",
		description: "Apply D1 migrations (local or remote)",
	},
	args: {
		env: {
			type: "string",
			description: "Target environment: local (default) | production",
			default: "local",
		},
		force: {
			type: "boolean",
			description: "Required when targeting production",
			default: false,
		},
	},
	run({ args }) {
		const env = validateEnv(args.env);
		const isRemote = env !== "local";

		if (env === "production" && !args.force) {
			log.error(
				"Production migrations require --force. Run: db migrate --env production --force",
			);
			process.exit(1);
		}

		if (isRemote) {
			log.warn(`Applying migrations to ${env} (remote D1).`);
		}

		spawnInWorker(
			[
				"bunx",
				"wrangler",
				"d1",
				"migrations",
				"apply",
				"TALASH_DB",
				"--env",
				env,
				isRemote ? "--remote" : "--local",
			],
			"Migration failed.",
		);
	},
});
