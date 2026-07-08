import { spawnSync } from "node:child_process";
import { log } from "./logger.ts";
import { workerDir } from "./paths.ts";

/**
 * Spawns a command in apps/worker using an argument array (no shell, no injection risk).
 * Exits the process with a clean error message on failure.
 */
export function spawnInWorker(args: string[], errorMessage: string): void {
	const result = spawnSync(args[0], args.slice(1), {
		cwd: workerDir,
		stdio: "inherit",
	});

	if (result.error) {
		log.error(`${errorMessage}: ${result.error.message}`);
		process.exit(1);
	}

	if (result.status !== 0) {
		log.error(errorMessage);
		process.exit(result.status ?? 1);
	}
}

export function validateEnv(env: string): "local" | "staging" | "production" {
	if (env !== "local" && env !== "staging" && env !== "production") {
		log.error(
			`Invalid --env value: "${env}". Use "local", "staging", or "production".`,
		);
		process.exit(1);
	}
	return env as "local" | "staging" | "production";
}
