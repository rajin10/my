import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "@repo/core/src/database/schema";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, "../../database/migrations");

/**
 * Builds a fresh in-memory SQLite database with the full schema applied by
 * replaying the drizzle migration SQL files, and returns a drizzle client.
 *
 * Foreign keys are explicitly disabled after the replay (migration 0003 ends on
 * `PRAGMA foreign_keys=ON`) so a single table can be seeded without inserting
 * rows into its referenced tables.
 */
export function createTestDb() {
	const sqlite = new Database(":memory:");

	const files = readdirSync(MIGRATIONS_DIR)
		.filter((f) => f.endsWith(".sql"))
		// Zero-padded filenames (0000–0008) sort lexically into apply order.
		.sort();

	for (const file of files) {
		// drizzle's `--> statement-breakpoint` lines start with `--` (SQL comment),
		// so the whole file can be exec'd at once.
		const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
		sqlite.exec(sql);
	}

	// Migration 0003 leaves the connection with foreign keys ON; turn them back
	// off so repository tests can seed a single table in isolation.
	sqlite.pragma("foreign_keys = OFF");

	return drizzle(sqlite, { schema });
}

/**
 * D1's `db.batch()` has no equivalent on the better-sqlite3 driver. Attach a
 * shim that awaits each drizzle statement in order so repository methods using
 * `db.batch([...])` (placeOrder, cancelAndRestore) can run in integration tests.
 * Returns the same db for chaining: `const db = attachBatch(createTestDb())`.
 */
export function attachBatch(db: ReturnType<typeof createTestDb>) {
	(db as unknown as { batch: (stmts: unknown[]) => Promise<unknown[]> }).batch =
		async (stmts) => {
			const results: unknown[] = [];
			for (const stmt of stmts) results.push(await stmt);
			return results;
		};
	return db;
}
