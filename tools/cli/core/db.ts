import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";
import * as schema from "@core/database/schema/index.ts";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { workerDir } from "./paths.ts";

function resolveLocalD1Path(): string {
	const d1Dir = path.resolve(
		workerDir,
		".wrangler/state/v3/d1/miniflare-D1DatabaseObject",
	);

	if (!fs.existsSync(d1Dir)) {
		throw new Error(
			`Local D1 directory not found at:\n  ${d1Dir}\n\nRun "bun run db:migrate:local" from apps/worker first.`,
		);
	}

	const sqliteFiles = fs
		.readdirSync(d1Dir)
		.filter((f) => f.endsWith(".sqlite") && !f.startsWith("metadata"));

	if (sqliteFiles.length === 0) {
		return path.join(d1Dir, "local-d1.sqlite");
	}

	// Pick the file where wrangler last applied a migration, identified by the
	// latest `applied_at` timestamp in the `migrations` table.
	type MigRow = { applied_at: string };
	const scored = sqliteFiles.flatMap((f) => {
		try {
			const db = new Database(path.join(d1Dir, f), { readonly: true });
			const row = db
				.query<MigRow, []>(
					"SELECT applied_at FROM migrations ORDER BY id DESC LIMIT 1",
				)
				.get();
			db.close();
			return row ? [{ f, ts: row.applied_at }] : [];
		} catch {
			return [];
		}
	});

	if (scored.length > 0) {
		scored.sort((a, b) => (a.ts < b.ts ? 1 : -1));
		return path.join(d1Dir, scored[0].f);
	}

	// Fallback: most recently modified file
	return path.join(
		d1Dir,
		sqliteFiles
			.map((f) => ({ f, mtime: fs.statSync(path.join(d1Dir, f)).mtimeMs }))
			.sort((a, b) => b.mtime - a.mtime)[0].f,
	);
}

export type DbClient = ReturnType<typeof createLocalDb>;

export function createLocalDb() {
	const filePath = resolveLocalD1Path();
	const sqlite = new Database(filePath);
	sqlite.run("PRAGMA journal_mode = WAL");
	sqlite.run("PRAGMA foreign_keys = ON");
	return drizzle(sqlite, { schema, casing: "camelCase" });
}

/**
 * Flush the bun:sqlite WAL into the main file and close, so external readers
 * (e.g. `wrangler d1 export`) see all freshly-written rows.
 */
export function checkpointAndClose(db: DbClient): void {
	const sqlite = db.$client;
	sqlite.exec("PRAGMA wal_checkpoint(TRUNCATE)");
	sqlite.close();
}
