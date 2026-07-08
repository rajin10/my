# Remote DB Seeding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `tools/cli` seed remote D1 (staging + production) by seeding locally, exporting data-only SQL, and pushing it with `wrangler d1 execute --remote`.

**Architecture:** Reuse all 13 existing seeders. A new `runRemoteSeed` orchestrator: ensures local schema is current, truncates + reseeds the default local D1, checkpoints WAL, `wrangler d1 export`s data-only SQL, optionally prepends a truncate block, then `wrangler d1 execute --remote --file`s it. `seed`/`fresh`/`migrate` become env-aware (`local`|`staging`|`production`).

**Tech Stack:** Bun, citty, drizzle-orm (bun:sqlite), wrangler d1, bun:test.

> **Note (verified):** staging and production envs in `workers/api/wrangler.jsonc` share the same `database_id` — "seed staging" writes the production D1. Documented; acceptable per current direction (prod data not a concern).

---

### Task 1: Add `staging` to the env type and validator

**Files:**
- Modify: `tools/cli/seeders/seeder.types.ts:1`
- Modify: `tools/cli/core/exec.ts:26-32`
- Test: `tools/cli/__tests__/exec.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// tools/cli/__tests__/exec.test.ts
import { describe, expect, test } from "bun:test";
import { validateEnv } from "../core/exec.ts";

describe("validateEnv", () => {
	test("accepts the three known envs", () => {
		expect(validateEnv("local")).toBe("local");
		expect(validateEnv("staging")).toBe("staging");
		expect(validateEnv("production")).toBe("production");
	});
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd tools/cli && bun test __tests__/exec.test.ts`
Expected: FAIL — `validateEnv("staging")` currently calls `process.exit(1)`.

- [ ] **Step 3: Widen the type**

In `tools/cli/seeders/seeder.types.ts` change line 1:

```ts
export type SeedEnv = "local" | "staging" | "production";
```

- [ ] **Step 4: Widen the validator**

In `tools/cli/core/exec.ts` replace the `validateEnv` body:

```ts
export function validateEnv(env: string): "local" | "staging" | "production" {
	if (env !== "local" && env !== "staging" && env !== "production") {
		log.error(
			`Invalid --env value: "${env}". Use "local", "staging", or "production".`,
		);
		process.exit(1);
	}
	return env as "local" | "staging" | "production";
}
```

- [ ] **Step 5: Run test, verify it passes**

Run: `cd tools/cli && bun test __tests__/exec.test.ts`
Expected: PASS.

---

### Task 2: Pure helpers — `buildTruncateSql` and the production gate

**Files:**
- Create: `tools/cli/seeders/tables.ts` (leaf module: `TRUNCATE_ORDER` only — avoids a `run-all` ↔ `remote-seed` import cycle)
- Create: `tools/cli/core/remote-seed.ts` (only `buildTruncateSql` in this task)
- Create: `tools/cli/core/confirm.ts`
- Test: `tools/cli/__tests__/remote-seed.test.ts` (create)

- [ ] **Step 1: Write the failing tests**

```ts
// tools/cli/__tests__/remote-seed.test.ts
import { describe, expect, test } from "bun:test";
import { buildTruncateSql } from "../core/remote-seed.ts";
import { TRUNCATE_ORDER } from "../seeders/tables.ts";
import { checkProductionGate } from "../core/confirm.ts";

describe("buildTruncateSql", () => {
	test("emits one DELETE per table, in order, double-quoted", () => {
		const sql = buildTruncateSql(["users", "orders"]);
		expect(sql).toBe('DELETE FROM "users";\nDELETE FROM "orders";\n');
	});

	test("TRUNCATE_ORDER puts children before parents (users last)", () => {
		expect(TRUNCATE_ORDER[TRUNCATE_ORDER.length - 1]).toBe("users");
		expect(TRUNCATE_ORDER).toContain("order_items");
		expect(TRUNCATE_ORDER.indexOf("order_items")).toBeLessThan(
			TRUNCATE_ORDER.indexOf("orders"),
		);
	});
});

describe("checkProductionGate", () => {
	const dbName = "talash-db";
	test("ok when force + matching confirmation", () => {
		expect(checkProductionGate({ force: true, provided: dbName, dbName }).ok).toBe(true);
	});
	test("blocked without force", () => {
		expect(checkProductionGate({ force: false, provided: dbName, dbName }).ok).toBe(false);
	});
	test("blocked on wrong/empty confirmation", () => {
		expect(checkProductionGate({ force: true, provided: "nope", dbName }).ok).toBe(false);
		expect(checkProductionGate({ force: true, provided: null, dbName }).ok).toBe(false);
	});
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `cd tools/cli && bun test __tests__/remote-seed.test.ts`
Expected: FAIL — modules/exports do not exist.

- [ ] **Step 3: Create `core/confirm.ts`**

```ts
// tools/cli/core/confirm.ts
export interface ProductionGateArgs {
	force: boolean;
	/** The confirmation string supplied (via --confirm or interactive prompt); null if none. */
	provided: string | null;
	/** The remote database name the user must type to proceed. */
	dbName: string;
}

export function checkProductionGate(args: ProductionGateArgs): {
	ok: boolean;
	reason?: string;
} {
	if (!args.force) {
		return { ok: false, reason: "Production requires --force." };
	}
	if (args.provided !== args.dbName) {
		return {
			ok: false,
			reason: `Confirmation mismatch — type the database name "${args.dbName}" to proceed.`,
		};
	}
	return { ok: true };
}
```

- [ ] **Step 4: Create `seeders/tables.ts` (leaf — no imports)**

```ts
// tools/cli/seeders/tables.ts

/** FK-safe deletion order: children before parents. Single source of truth for local fresh and remote truncate. */
export const TRUNCATE_ORDER = [
	"reward_transactions",
	"reward_points",
	"reviews",
	"payments",
	"order_items",
	"orders",
	"customer_addresses",
	"bookings",
	"coupons",
	"team_members",
	"products",
	"services",
	"business_photos",
	"branches",
	"businesses",
	"notifications",
	"auth_refresh_tokens",
	"users",
] as const;
```

- [ ] **Step 5: Create `core/remote-seed.ts` (helper only for now)**

```ts
// tools/cli/core/remote-seed.ts
import { TRUNCATE_ORDER } from "../seeders/tables.ts";

/** Build a remote DELETE block (one statement per table, in FK-safe order). */
export function buildTruncateSql(order: readonly string[]): string {
	return order.map((t) => `DELETE FROM "${t}";`).join("\n") + "\n";
}
```

- [ ] **Step 6: Run, verify it passes**

Run: `cd tools/cli && bun test __tests__/remote-seed.test.ts`
Expected: PASS.

---

### Task 3: Extract `seedAll` + `truncateAll` into a shared module

**Files:**
- Create: `tools/cli/seeders/run-all.ts`
- Modify: `tools/cli/commands/db/seed.ts` (replace inline sequence)
- Modify: `tools/cli/commands/db/fresh.ts` (use shared `truncateAll`/`seedAll`)

> No new unit test — this is a behavior-preserving refactor verified by running local `db fresh`.

- [ ] **Step 1: Create `seeders/run-all.ts`**

Move the seeding sequence out of `seed.ts` and the truncate loop out of `fresh.ts`. `truncateAll` re-exports `TRUNCATE_ORDER` from `core/remote-seed.ts` (single source).

```ts
// tools/cli/seeders/run-all.ts
import { TRUNCATE_ORDER } from "./tables.ts";
import type { DbClient } from "../core/db.ts";
import { log } from "../core/logger.ts";
import { seedBookings } from "./bookings.seeder.ts";
import { seedBranches } from "./branches.seeder.ts";
import { seedBusinesses } from "./businesses.seeder.ts";
import { seedCoupons } from "./coupons.seeder.ts";
import { seedCustomerAddresses } from "./customer-addresses.seeder.ts";
import { seedOrders } from "./orders.seeder.ts";
import { seedPayments } from "./payments.seeder.ts";
import { seedProducts } from "./products.seeder.ts";
import { seedReviews } from "./reviews.seeder.ts";
import { seedRewards } from "./rewards.seeder.ts";
import type { SeedOptions } from "./seeder.types.ts";
import { seedServices } from "./services.seeder.ts";
import { seedTeam } from "./team.seeder.ts";
import { seedUsers } from "./users.seeder.ts";

/** Truncate all domain tables in FK-safe order (local bun:sqlite). */
export function truncateAll(db: DbClient): void {
	const sqlite = db.$client;
	sqlite.exec("PRAGMA foreign_keys = OFF");
	for (const table of TRUNCATE_ORDER) {
		try {
			sqlite.exec(`DELETE FROM "${table}"`);
			log.step(`cleared ${table}`);
		} catch {
			log.dim(`  skipped ${table} (table may not exist)`);
		}
	}
	sqlite.exec("PRAGMA foreign_keys = ON");
}

/** Populate a db client with a full faker dataset. Returns total rows inserted. */
export async function seedAll(db: DbClient, opts: SeedOptions): Promise<number> {
	const results: Array<{ inserted: number }> = [];

	log.info(`Seeding ${opts.count} users worth of data…`);

	const users = await seedUsers(db, opts);
	results.push(users);
	log.step(
		`users: ${users.inserted} (${users.ownerIds.length} owners, ${users.staffIds.length} staff, ${users.userIds.length} customers)`,
	);

	const businesses = await seedBusinesses(db, users.ownerIds);
	results.push(businesses);
	log.step(`businesses + photos: ${businesses.inserted}`);

	const branches = await seedBranches(
		db,
		businesses.businessIds,
		businesses.businessCities,
	);
	results.push(branches);
	log.step(`branches: ${branches.inserted}`);

	const services = await seedServices(db, branches.businessBranches);
	results.push(services);
	log.step(`services: ${services.inserted}`);

	const products = await seedProducts(
		db,
		businesses.commerceBusinessIds,
		branches.businessBranches,
	);
	results.push(products);
	log.step(`products: ${products.inserted}`);

	const team = await seedTeam(
		db,
		businesses.businessIds,
		branches.businessBranches,
		users.ownerIds,
		users.staffIds,
	);
	results.push(team);
	log.step(`team members: ${team.inserted}`);

	const bookings = await seedBookings(
		db,
		users.userIds,
		businesses.businessIds,
		branches.businessBranches,
		services.branchServices,
		services.servicePrices,
	);
	results.push(bookings);
	log.step(`bookings: ${bookings.inserted}`);

	const orders = await seedOrders(
		db,
		businesses.commerceBusinessIds,
		branches.businessBranches,
		products.branchProducts,
		products.productPrices,
		products.productStock,
		users.userIds,
	);
	results.push(orders);
	log.step(`orders: ${orders.orderCount} (+ ${orders.itemCount} order items)`);

	const payments = await seedPayments(
		db,
		orders.deliveredTotals,
		businesses.businessOwnerIds,
	);
	results.push(payments);
	log.step(`payments: ${payments.paymentCount}`);

	const customerAddresses = await seedCustomerAddresses(db, users.userIds);
	results.push(customerAddresses);
	log.step(`customer addresses: ${customerAddresses.inserted}`);

	const coupons = await seedCoupons(db, businesses.businessIds);
	results.push(coupons);
	log.step(`coupons: ${coupons.inserted}`);

	const reviews = await seedReviews(db, bookings.bookingRefs);
	results.push(reviews);
	log.step(`reviews: ${reviews.inserted}`);

	const allUserIds = [...users.userIds, ...users.ownerIds, ...users.staffIds];
	const rewards = await seedRewards(db, allUserIds, bookings.bookingRefs);
	results.push(rewards);
	log.step(`rewards (txns + balances): ${rewards.inserted}`);

	return results.reduce((sum, r) => sum + r.inserted, 0);
}
```

- [ ] **Step 2: Rewrite `commands/db/seed.ts` to use `seedAll`**

Replace the whole file with:

```ts
// tools/cli/commands/db/seed.ts
import { faker } from "@faker-js/faker";
import { defineCommand } from "citty";
import { createLocalDb } from "../../core/db.ts";
import { validateEnv } from "../../core/exec.ts";
import { log } from "../../core/logger.ts";
import { runRemoteSeed } from "../../core/remote-seed.ts";
import type { SeedOptions } from "../../seeders/seeder.types.ts";
import { seedAll } from "../../seeders/run-all.ts";

export default defineCommand({
	meta: {
		name: "seed",
		description: "Seed the database with faker data (local or remote)",
	},
	args: {
		count: {
			type: "string",
			description: "Base user count to generate (default: 20)",
			default: "20",
		},
		seed: {
			type: "string",
			description: "Faker seed integer for reproducible data",
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
			description: "Non-interactive production confirmation (the database name)",
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
				fresh: false,
				force: args.force,
				confirm: args.confirm ?? null,
			});
			return;
		}

		if (fakerSeed !== undefined) {
			faker.seed(fakerSeed);
			log.dim(`faker seed: ${fakerSeed}`);
		}
		const opts: SeedOptions = { count, fakerSeed, env: "local" };
		const db = createLocalDb();
		const total = await seedAll(db, opts);
		log.success(`Done — ${total} rows seeded (local)`);
	},
});
```

- [ ] **Step 3: Rewrite `commands/db/fresh.ts` to add `--env` and reuse shared helpers**

```ts
// tools/cli/commands/db/fresh.ts
import { faker } from "@faker-js/faker";
import { defineCommand } from "citty";
import { createLocalDb } from "../../core/db.ts";
import { validateEnv } from "../../core/exec.ts";
import { log } from "../../core/logger.ts";
import { runRemoteSeed } from "../../core/remote-seed.ts";
import type { SeedOptions } from "../../seeders/seeder.types.ts";
import { seedAll, truncateAll } from "../../seeders/run-all.ts";

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
			description: "Non-interactive production confirmation (the database name)",
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
```

- [ ] **Step 4: Verify local still works (behavior preserved)**

Run: `bun run cli db fresh --count 5 --seed 42`
Expected: truncates + seeds, ends with `Done — <n> rows seeded (local)`, no errors.

---

### Task 4: Implement the `runRemoteSeed` pipeline

**Files:**
- Modify: `tools/cli/core/remote-seed.ts` (append the orchestrator)
- Modify: `tools/cli/core/db.ts` (export a WAL-checkpoint + close helper)

- [ ] **Step 1: Add a checkpoint/close helper to `core/db.ts`**

Append to `tools/cli/core/db.ts`:

```ts
/** Flush the bun:sqlite WAL into the main file and close, so external readers (wrangler export) see all rows. */
export function checkpointAndClose(db: DbClient): void {
	const sqlite = db.$client;
	sqlite.exec("PRAGMA wal_checkpoint(TRUNCATE)");
	sqlite.close();
}
```

- [ ] **Step 2: Append `runRemoteSeed` to `core/remote-seed.ts`**

```ts
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { faker } from "@faker-js/faker";
import { checkpointAndClose, createLocalDb } from "./db.ts";
import { checkProductionGate } from "./confirm.ts";
import { log } from "./logger.ts";
import { workerDir } from "./paths.ts";
import { seedAll, truncateAll } from "../seeders/run-all.ts";

const REMOTE_DB_NAME = "talash-db";

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

	const tmpSql = path.join(os.tmpdir(), `talash-remote-seed-${process.pid}.sql`);

	try {
		// 2. Ensure local schema is current.
		log.info("Ensuring local schema is up to date…");
		wrangler(
			["d1", "migrations", "apply", "TALASH_DB", "--env", "local", "--local"],
			"Local migration failed.",
		);

		// 3. Build the dataset in the local D1 (always truncate first so the export is exactly this dataset).
		if (args.fakerSeed !== undefined) {
			faker.seed(args.fakerSeed);
			log.dim(`faker seed: ${args.fakerSeed}`);
		}
		const db = createLocalDb();
		log.info("Rebuilding local dataset (also leaves it in your local D1)…");
		truncateAll(db);
		const total = await seedAll(db, { count: args.count, fakerSeed: args.fakerSeed, env: "local" });
		checkpointAndClose(db);
		log.success(`Generated ${total} rows locally`);

		// 4. Export data-only SQL from the local D1.
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
				"--output",
				tmpSql,
			],
			"Export failed.",
		);

		// 5. Assemble the push file (prepend truncate block for fresh).
		const inserts = fs.readFileSync(tmpSql, "utf8");
		const pushSql = args.fresh
			? `${buildTruncateSql(TRUNCATE_ORDER)}\n${inserts}`
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
```

- [ ] **Step 3: Re-run the pure tests (still green after appending)**

Run: `cd tools/cli && bun test`
Expected: PASS (exec + remote-seed helper tests).

---

### Task 5: Make `migrate` support `staging`

**Files:**
- Modify: `tools/cli/commands/db/migrate.ts`

- [ ] **Step 1: Replace the env→wrangler mapping**

In `tools/cli/commands/db/migrate.ts`, replace the `run` body's remote handling so `staging` and `production` both go remote, and only `production` needs `--force`:

```ts
	run({ args }) {
		const env = validateEnv(args.env);
		const isRemote = env !== "local";

		if (env === "production" && !args.force) {
			log.error(
				"Production migrations require --force. Run: db migrate --env production --force",
			);
			process.exit(1);
		}
		if (isRemote) {
			log.warn(`Applying migrations to ${env} (remote D1).`);
		}

		spawnInWorker(
			[
				"bunx",
				"wrangler",
				"d1",
				"migrations",
				"apply",
				"TALASH_DB",
				"--env",
				env,
				isRemote ? "--remote" : "--local",
			],
			"Migration failed.",
		);
	},
```

- [ ] **Step 2: Verify local migrate still works**

Run: `bun run db:migrate`
Expected: applies/【no-ops】 against local; ends success.

---

### Task 6: Documentation

**Files:**
- Modify: `tools/cli/CLAUDE.md`
- Modify: `docs/guides/cli.md`
- Modify: `AGENTS.md`
- Modify: `docs/guides/environment-variables.md`

- [ ] **Step 1: `docs/guides/cli.md`** — add a "Remote seeding" section: the three commands (`migrate`/`seed`/`fresh` with `--env staging|production`), the local-seed→export→push pipeline, the production `--force`+typed-confirm gate, the staging==production shared-DB note, the Cloudflare-auth prerequisite (`wrangler login` / `CLOUDFLARE_API_TOKEN`), and the `d1 execute --file` size caveat (keep `--count` modest).

- [ ] **Step 2: `tools/cli/CLAUDE.md`** — extend the Commands block with the remote forms and a one-line pointer to the cli.md remote section.

- [ ] **Step 3: `AGENTS.md`** — under the CLI section, add the remote `--env` forms.

- [ ] **Step 4: `docs/guides/environment-variables.md`** — note that remote D1 ops (`migrate`/`seed`/`fresh --env staging|production`) require Cloudflare auth.

---

### Task 7: Final verification

- [ ] **Step 1: Lint touched files**

Run: `cd tools/cli && bunx biome check core/ commands/db/ seeders/run-all.ts __tests__/`
Expected: no errors on touched files.

- [ ] **Step 2: Unit tests**

Run: `cd tools/cli && bun test`
Expected: all pass (factories + exec + remote-seed).

- [ ] **Step 3: Local regression**

Run: `bun run cli db fresh --count 5 --seed 42 && bun run cli db status`
Expected: seeds and prints non-zero row counts.

- [ ] **Step 4 (optional, requires CF auth + intent): real staging push**

Run: `bun run cli db fresh --env staging --count 10 --seed 42`
Expected: local rebuild → export → remote execute all succeed.
