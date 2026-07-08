import { defineCommand } from "citty";
import { createLocalDb } from "../../core/db.ts";
import { log } from "../../core/logger.ts";

const TABLES = [
	"users",
	"businesses",
	"business_photos",
	"branches",
	"services",
	"products",
	"team_members",
	"coupons",
	"bookings",
	"orders",
	"order_items",
	"payments",
	"customer_addresses",
	"reviews",
	"reward_points",
	"reward_transactions",
	"auth_refresh_tokens",
] as const;

export default defineCommand({
	meta: {
		name: "status",
		description: "Show row counts for all domain tables",
	},
	args: {},
	async run() {
		const db = createLocalDb();
		const sqlite = db.$client;
		const rows: Array<[string, number]> = [];

		for (const table of TABLES) {
			try {
				const stmt = sqlite.prepare(`SELECT COUNT(*) as n FROM "${table}"`);
				const result = stmt.get() as { n: number } | null;
				rows.push([table, result?.n ?? 0]);
			} catch {
				rows.push([table, -1]);
			}
		}

		log.table(rows, ["table", "rows"]);
	},
});
