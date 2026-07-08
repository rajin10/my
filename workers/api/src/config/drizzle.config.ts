import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "drizzle-kit";

const d1Dir = path.resolve(
	process.cwd(),
	".wrangler/state/v3/d1/miniflare-D1DatabaseObject",
);

export function resolveLocalD1SqliteUrl(): string {
	if (!fs.existsSync(d1Dir)) {
		throw new Error(
			`D1 directory not found at ${d1Dir}. Make sure to run "wrangler d1 dev" at least once to initialize the database.`,
		);
	}

	const sqliteFiles = fs
		.readdirSync(d1Dir)
		.filter((file) => file.endsWith(".sqlite") && !file.startsWith("metadata"));

	if (sqliteFiles.length === 0) {
		throw new Error(
			`No sqlite files found in ${d1Dir}. Make sure to run "wrangler d1 dev" at least once to initialize the database.`,
		);
	}

	const sortedFiles = sqliteFiles.sort();
	const fileName = sortedFiles[sortedFiles.length - 1];

	if (!fileName) {
		throw new Error(
			`Failed to resolve local D1 sqlite file in ${d1Dir}. Make sure to run "wrangler d1 dev" at least once to initialize the database.`,
		);
	}

	const url = `${d1Dir}/${fileName}`;
	console.log(`Using local D1 sqlite: ${url}`);

	return url;
}

export default defineConfig({
	dbCredentials: {
		url: resolveLocalD1SqliteUrl(),
	},
	schema: "../../packages/core/src/database/schema/index.ts",
	out: "src/database/migrations",
	dialect: "sqlite",
	// casing: "camelCase",
	verbose: true,
});
