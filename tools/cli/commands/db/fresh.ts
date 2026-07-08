import { faker } from "@faker-js/faker";
import { defineCommand } from "citty";
import { createLocalDb } from "../../core/db.ts";
import { validateEnv } from "../../core/exec.ts";
import { log } from "../../core/logger.ts";
import { runRemoteSeed } from "../../core/remote-seed.ts";
import { seedAll, truncateAll } from "../../seeders/run-all.ts";
import type { SeedOptions } from "../../seeders/seeder.types.ts";

export default defineCommand({
	meta: {
		name: "fresh",
		description: "Truncate all domain tables then re-seed (local or remote)",
	},
	args: {
		count: {
			type: "string",
			description: "Base user count (default: 20)",
			default: "20",
		},
		seed: {
			type: "string",
			description: "Faker seed for reproducible data",
		},
		env: {
			type: "string",
			description: "Target: local (default) | staging | production",
			default: "local",
		},
		force: {
			type: "boolean",
			description: "Required when targeting production",
			default: false,
		},
		confirm: {
			type: "string",
			description:
				"Non-interactive production confirmation (the database name)",
		},
	},
	async run({ args }) {
		const env = validateEnv(args.env);
		const count = Number.parseInt(args.count, 10);
		if (Number.isNaN(count) || count < 1) {
			log.error("--count must be a positive integer");
			process.exit(1);
		}
		const fakerSeed = args.seed ? Number.parseInt(args.seed, 10) : undefined;

		if (env !== "local") {
			await runRemoteSeed({
				env,
				count,
				fakerSeed,
				fresh: true,
				force: args.force,
				confirm: args.confirm ?? null,
			});
			return;
		}

		if (fakerSeed !== undefined) faker.seed(fakerSeed);
		const db = createLocalDb();
		log.info("Truncating domain tables…");
		truncateAll(db);
		log.success("Tables cleared");
		log.info("Running seed…");
		const opts: SeedOptions = { count, fakerSeed, env: "local" };
		const total = await seedAll(db, opts);
		log.success(`Done — ${total} rows seeded (local)`);
	},
});
