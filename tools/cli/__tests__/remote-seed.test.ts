import { describe, expect, test } from "bun:test";
import { checkProductionGate } from "../core/confirm.ts";
import {
	buildFreshTruncateBlock,
	buildTruncateSql,
	reorderInsertStatements,
	stripBookkeepingInserts,
} from "../core/remote-seed.ts";
import { EXPORT_ORDER, TRUNCATE_ORDER } from "../seeders/tables.ts";

describe("buildTruncateSql", () => {
	test("emits one DELETE per table, in order, double-quoted", () => {
		const sql = buildTruncateSql(["users", "orders"]);
		expect(sql).toBe('DELETE FROM "users";\nDELETE FROM "orders";\n');
	});

	test("buildFreshTruncateBlock disables FK checks during delete", () => {
		const sql = buildFreshTruncateBlock(["users"]);
		expect(sql).toBe(
			'PRAGMA foreign_keys = OFF;\nDELETE FROM "users";\nPRAGMA foreign_keys = ON;\n',
		);
	});

	test("TRUNCATE_ORDER puts children before parents (users last)", () => {
		expect(TRUNCATE_ORDER[TRUNCATE_ORDER.length - 1]).toBe("users");
		expect(TRUNCATE_ORDER).toContain("order_items");
		expect(TRUNCATE_ORDER.indexOf("order_items")).toBeLessThan(
			TRUNCATE_ORDER.indexOf("orders"),
		);
	});

	test("EXPORT_ORDER is TRUNCATE_ORDER reversed (parents before children)", () => {
		expect(EXPORT_ORDER[0]).toBe("users");
		expect(EXPORT_ORDER[EXPORT_ORDER.length - 1]).toBe("reward_transactions");
		expect(EXPORT_ORDER).toEqual([...TRUNCATE_ORDER].reverse());
	});
});

describe("reorderInsertStatements", () => {
	test("groups inserts by table in parent-first order (wrangler exports alphabetically)", () => {
		const input = [
			"PRAGMA defer_foreign_keys=TRUE;",
			'INSERT INTO "bookings" ("id") VALUES(\'b1\');',
			'INSERT INTO "users" ("id") VALUES(\'u1\');',
			'INSERT INTO "businesses" ("id") VALUES(\'biz1\');',
			'INSERT INTO "bookings" ("id") VALUES(\'b2\');',
		].join("\n");
		const out = reorderInsertStatements(input, [
			"users",
			"businesses",
			"bookings",
		]);
		const tables = [...out.matchAll(/^INSERT INTO "([^"]+)"/gm)].map(
			(m) => m[1],
		);
		expect(tables).toEqual(["users", "businesses", "bookings", "bookings"]);
		expect(out).toContain("PRAGMA defer_foreign_keys=TRUE;");
	});
});

describe("stripBookkeepingInserts", () => {
	test("drops migrations + sqlite_sequence inserts, keeps domain rows + PRAGMA", () => {
		const input = [
			"PRAGMA defer_foreign_keys=TRUE;",
			`INSERT INTO "migrations" ("id","name") VALUES(1,'0000_x');`,
			`INSERT INTO "sqlite_sequence"("name","seq") VALUES('users',5);`,
			`INSERT INTO "users" ("id","email") VALUES('u1','a@b.c');`,
		].join("\n");
		const out = stripBookkeepingInserts(input);
		expect(out).toContain("PRAGMA defer_foreign_keys=TRUE;");
		expect(out).toContain('INSERT INTO "users"');
		expect(out).not.toContain('INSERT INTO "migrations"');
		expect(out).not.toContain('INSERT INTO "sqlite_sequence"');
	});

	test("does not strip domain tables whose name merely contains a keyword", () => {
		const input = `INSERT INTO "user_migrations_log" ("id") VALUES('x');`;
		expect(stripBookkeepingInserts(input)).toContain("user_migrations_log");
	});
});

describe("checkProductionGate", () => {
	const dbName = "talash-db";
	test("ok when force + matching confirmation", () => {
		expect(
			checkProductionGate({ force: true, provided: dbName, dbName }).ok,
		).toBe(true);
	});
	test("blocked without force", () => {
		expect(
			checkProductionGate({ force: false, provided: dbName, dbName }).ok,
		).toBe(false);
	});
	test("blocked on wrong/empty confirmation", () => {
		expect(
			checkProductionGate({ force: true, provided: "nope", dbName }).ok,
		).toBe(false);
		expect(
			checkProductionGate({ force: true, provided: null, dbName }).ok,
		).toBe(false);
	});
});
