import { defineCommand } from "citty";
import { spawnInWorker } from "../../core/exec.ts";
import { log } from "../../core/logger.ts";

export default defineCommand({
	meta: {
		name: "studio",
		description: "Open Drizzle Studio for the local D1 database",
	},
	args: {},
	run() {
		log.info("Starting Drizzle Studio… (Ctrl+C to stop)");
		spawnInWorker(
			["bunx", "drizzle-kit", "studio", "--config", "api/drizzle.config.ts"],
			"drizzle-kit studio exited with error.",
		);
	},
});
