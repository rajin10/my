import { defineCommand } from "citty";
import { spawnInWorker } from "../../core/exec.ts";

export default defineCommand({
	meta: {
		name: "generate",
		description: "Generate a new migration from schema changes",
	},
	args: {
		name: {
			type: "string",
			description: "Optional migration name slug (e.g. add_business_tags)",
		},
	},
	run({ args }) {
		spawnInWorker(
			[
				"bunx",
				"drizzle-kit",
				"generate",
				"--config",
				"src/config/drizzle.config.ts",
				...(args.name ? ["--name", args.name] : []),
			],
			"Migration generation failed.",
		);
	},
});
