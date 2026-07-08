import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { faker } from "@faker-js/faker";
import { seedAll, truncateAll } from "../seeders/run-all.ts";
import { EXPORT_ORDER, TRUNCATE_ORDER } from "../seeders/tables.ts";
import { checkProductionGate } from "./confirm.ts";
import { checkpointAndClose, createLocalDb } from "./db.ts";
import { log } from "./logger.ts";
import { workerDir } from "./paths.ts";

const REMOTE_DB_NAME = "talash-db";

/** Build a remote DELETE block (one statement per table, in FK-safe order). */
export function buildTruncateSql(order: readonly string[]): string {
	return `${order.map((t) => `DELETE FROM "${t}";`).join("\n")}\n`;
}

/** Remote fresh: disable FK checks while clearing every domain table (matches local truncateAll). */
export function buildFreshTruncateBlock(order: readonly string[]): string {
	return `PRAGMA foreign_keys = OFF;\n${buildTruncateSql(order)}PRAGMA foreign_keys = ON;\n`;
}

const INSERT_INTO_TABLE_RE = /^INSERT INTO "([^"]+)"/;

/**
 * Wrangler `d1 export --table …` does not preserve flag order — inserts may come
 * out alphabetically (e.g. bookings before users). Re-group by table and emit
 * in parent-first order before pushing to remote D1.
 */
export function reorderInsertStatements(
	sql: string,
	tableOrder: readonly string[],
): string {
	const rank = new Map(tableOrder.map((table, index) => [table, index]));
	const pragmas: string[] = [];
	const insertsByTable = new Map<string, string[]>();

	for (const line of sql.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		if (trimmed.startsWith("PRAGMA")) {
			pragmas.push(trimmed);
			continue;
		}
		const match = trimmed.match(INSERT_INTO_TABLE_RE);
		if (!match) continue;
		const table = match[1];
		const bucket = insertsByTable.get(table);
		if (bucket) bucket.push(trimmed);
		else insertsByTable.set(table, [trimmed]);
	}

	const sortedTables = [...insertsByTable.keys()].sort(
		(a, b) =>
			(rank.get(a) ?? Number.MAX_SAFE_INTEGER) -
			(rank.get(b) ?? Number.MAX_SAFE_INTEGER),
	);
	const inserts = sortedTables.flatMap((table) => insertsByTable.get(table)!);
	if (inserts.length === 0) return sql.trim() ? `${sql.trim()}\n` : "";

	return `${[...pragmas, ...inserts].join("\n")}\n`;
}

/**
 * Defensive net: drop any `INSERT INTO` targeting SQLite/D1 bookkeeping tables
 * (`migrations`, `sqlite_sequence`, internal `_cf_*` / `d1_*`). Those rows
 * already exist on a migrated remote and would abort the push on a PK conflict.
 * The `--table` export allowlist already excludes them; this guards against
 * wrangler behavior changes. `wrangler d1 export` emits one INSERT per line,
 * so line-based filtering is safe; the leading `PRAGMA` line is preserved.
 */
export function stripBookkeepingInserts(sql: string): string {
	const bookkeeping =
		/^INSERT INTO\s+"?(migrations|sqlite_sequence|_cf_\w+|d1_\w+)"?[\s(]/i;
	return sql
		.split("\n")
		.filter((line) => !bookkeeping.test(line))
		.join("\n");
}

export interface RemoteSeedArgs {
	env: "staging" | "production";
	count: number;
	fakerSeed?: number;
	fresh: boolean;
	force: boolean;
	confirm: string | null;
}

function wrangler(args: string[], errorMessage: string): void {
	const result = spawnSync("bunx", ["wrangler", ...args], {
		cwd: workerDir,
		stdio: "inherit",
	});
	if (result.status !== 0) {
		log.error(errorMessage);
		process.exit(result.status ?? 1);
	}
}

export async function runRemoteSeed(args: RemoteSeedArgs): Promise<void> {
	// 1. Production gate.
	if (args.env === "production") {
		const provided =
			args.confirm ??
			(process.stdin.isTTY
				? prompt(
						`⚠️  This targets PRODUCTION D1 ("${REMOTE_DB_NAME}").${args.fresh ? " 'fresh' DELETES ALL existing rows." : ""}\nType the database name to proceed:`,
					)
				: null);
		const gate = checkProductionGate({
			force: args.force,
			provided,
			dbName: REMOTE_DB_NAME,
		});
		if (!gate.ok) {
			log.error(gate.reason ?? "Production confirmation failed.");
			process.exit(1);
		}
	} else {
		log.warn(
			`Targeting ${args.env} (remote D1). NOTE: staging and production share the same database.`,
		);
	}

	const tmpSql = path.join(
		os.tmpdir(),
		`talash-remote-seed-${process.pid}.sql`,
	);

	try {
		// 2. Ensure the local schema is current.
		log.info("Ensuring local schema is up to date…");
		wrangler(
			["d1", "migrations", "apply", "TALASH_DB", "--env", "local", "--local"],
			"Local migration failed.",
		);

		// 3. Build the dataset in the local D1. Always truncate first so the export
		//    is exactly this dataset (never stale local rows).
		if (args.fakerSeed !== undefined) {
			faker.seed(args.fakerSeed);
			log.dim(`faker seed: ${args.fakerSeed}`);
		}
		const db = createLocalDb();
		log.info("Rebuilding local dataset (this also refreshes your local D1)…");
		truncateAll(db);
		const total = await seedAll(db, {
			count: args.count,
			fakerSeed: args.fakerSeed,
			env: "local",
		});
		checkpointAndClose(db);
		log.success(`Generated ${total} rows locally`);

		// 4. Export data-only SQL from the local D1. Restrict to domain tables via
		//    an explicit --table allowlist — otherwise the dump includes the
		//    `migrations` and `sqlite_sequence` bookkeeping tables, whose rows
		//    already exist on the (migrated) remote and would abort the push on a
		//    PRIMARY KEY conflict. Export parents before children (EXPORT_ORDER);
		//    remote D1 execute does not reliably honour deferred FK checks.
		log.info("Exporting data as SQL…");
		wrangler(
			[
				"d1",
				"export",
				"TALASH_DB",
				"--env",
				"local",
				"--local",
				"--no-schema",
				...EXPORT_ORDER.flatMap((t) => ["--table", t]),
				"--output",
				tmpSql,
			],
			"Export failed.",
		);

		// 5. Assemble the push file (prepend truncate block for fresh). Re-order
		//    inserts after export — wrangler ignores --table flag order.
		const inserts = reorderInsertStatements(
			stripBookkeepingInserts(fs.readFileSync(tmpSql, "utf8")),
			EXPORT_ORDER,
		);
		const pushSql = args.fresh
			? `${buildFreshTruncateBlock(TRUNCATE_ORDER)}${inserts}`
			: inserts;
		fs.writeFileSync(tmpSql, pushSql);

		// 6. Push to remote.
		log.info(`Pushing dataset to ${args.env} (remote)…`);
		wrangler(
			[
				"d1",
				"execute",
				"TALASH_DB",
				"--env",
				args.env,
				"--remote",
				"--file",
				tmpSql,
				"--yes",
			],
			"Remote execute failed.",
		);

		log.success(`Done — ${args.env} seeded with ${total} rows.`);
	} finally {
		if (fs.existsSync(tmpSql)) fs.rmSync(tmpSql);
	}
}
