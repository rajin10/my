# Khata / Payments Backend — Implementation Plan (Plan A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `payments` table + the derived khata ledger (`due = Σ delivered-order totals − Σ payments` per `(business, customer)`), exposed as owner-scoped API routes and api-client endpoints — the backend for the owner "Customer dues" UI (Plan B).

**Architecture:** Two new `@repo/core` repositories (`PaymentsRepository` for writes/history, `KhataRepository` for the cross-table derived reads) behind two thin Hono services (`PaymentsService`, `KhataService`) using the established `ServiceInstaller` injection pattern. Migration `0016` is hand-authored (approved deviation — see spec). Authorization uses the central `AuthorizationService.assertBusinessOwner(actorId, businessId)` (injected as `authz`, exactly as `OrdersService` does — the worker guide mandates services use it rather than hand-rolling owner checks). It checks `business.ownerId === actorId`, so this is **owner-only effective**; managers pass the `requireAuth(["owner","manager"])` middleware but fail the owner check. (Task 3's original code below hand-rolled this via `businessesRepo`; it was corrected to `authz` in review — Tasks 4/5 already reflect the corrected form.)

**Tech Stack:** Drizzle/D1, Hono + `@hono/zod-openapi` (`@repo/api`), `@repo/api-client`, Vitest (Node, mocked repos/services).

**Spec:** `docs/superpowers/specs/2026-06-10-khata-payments-design.md`

**Base:** worktree `claude/khata-payments` off `develop`. Run `bun install` in the worktree first.

**Commands:** `cd workers/api && bun run test` (api), `bun run --filter @repo/core test` (core, if present), `bunx tsc --noEmit -p <tsconfig>`, `bunx biome check --write <files>`, `bun run cli db fresh` (from root). Baselines are pre-existing RED — gate on **touched files + zero new failures vs baseline**.

---

## File Structure

**Create:**
- `packages/core/src/database/schema/payments.schema.ts` — the table
- `packages/core/src/database/repositories/payments.repository.ts` — payment writes + history
- `packages/core/src/database/repositories/khata.repository.ts` — derived reads (Σ delivered − Σ payments)
- `workers/api/src/database/migrations/0016_payments.sql` — hand-authored `CREATE TABLE`
- `workers/api/src/modules/payments/payments.service.ts` + `index.ts`
- `workers/api/src/modules/khata/khata.service.ts` + `index.ts`
- `workers/api/src/__tests__/modules/payments/payments.service.test.ts` + `payments.routes.test.ts`
- `workers/api/src/__tests__/modules/khata/khata.service.test.ts` + `khata.routes.test.ts`
- `packages/api-client/src/endpoints/payments.ts` + `khata.ts`

**Modify:**
- `packages/core/src/database/schema/index.ts` — export payments schema/types
- `workers/api/src/database/migrations/meta/_journal.json` — register idx 16
- `workers/api/src/middleware/shared-deps.ts` — `paymentsRepo` + `khataRepo` in `SharedDeps`
- `workers/api/src/middleware/services.ts` — instantiate both repos into `deps`
- `workers/api/src/modules/routes.ts` — mount `paymentsApp`/`khataApp` + register installers
- `workers/api/src/types/index.ts` — `paymentsService`/`khataService` context vars
- `workers/api/src/__tests__/helpers/create-test-app.ts` — mock services + mount
- `packages/api-client/src/types.ts` — `Payment`, `KhataDue`, `KhataCustomer`
- `packages/api-client/src/index.ts` — register `payments` + `khata` endpoint groups

---

## Task 1: Core — payments schema + migration 0016

**Files:** create `packages/core/src/database/schema/payments.schema.ts`; modify `packages/core/src/database/schema/index.ts`; create `workers/api/src/database/migrations/0016_payments.sql`; modify `workers/api/src/database/migrations/meta/_journal.json`.

- [ ] **Step 1: Create `payments.schema.ts`** (mirrors `orders.schema.ts` style + `helpers` `primaryID`/`timestamps`):

```ts
import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";
import { primaryID, timestamps } from "../helpers";
import { businessesSchema } from "./businesses.schema";
import { ordersSchema } from "./orders.schema";
import { usersSchema } from "./users.schema";

export const paymentsSchema = sqliteTable(
	"payments",
	{
		...primaryID(),
		businessId: text("business_id")
			.notNull()
			.references(() => businessesSchema.id),
		userId: text("user_id")
			.notNull()
			.references(() => usersSchema.id),
		amount: integer().notNull(),
		note: text(),
		recordedBy: text("recorded_by")
			.notNull()
			.references(() => usersSchema.id),
		orderId: text("order_id").references(() => ordersSchema.id, {
			onDelete: "set null",
		}),
		...timestamps(),
	},
	(t) => [
		index("payments_business_user_idx").on(t.businessId, t.userId),
		check("payments_amount_positive", sql`${t.amount} > 0`),
	],
);

export type PaymentSelect = typeof paymentsSchema.$inferSelect;
export type PaymentInsert = Omit<
	typeof paymentsSchema.$inferInsert,
	"id" | "createdAt" | "updatedAt" | "deletedAt"
>;
```

- [ ] **Step 2: Export from `schema/index.ts`** — add (alphabetically near the other commerce exports; mirror the existing `export type { ... } from "./orders.schema"` + `export { ordersSchema } ...` shape):

```ts
export type { PaymentInsert, PaymentSelect } from "./payments.schema";
export { paymentsSchema } from "./payments.schema";
```

- [ ] **Step 3: Create the migration `workers/api/src/database/migrations/0016_payments.sql`** (hand-authored — matches `0014`'s exact rendering; **do NOT run `db:generate`**, per spec §1):

```sql
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`note` text,
	`recorded_by` text NOT NULL,
	`order_id` text,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT `payments_amount_positive` CHECK(`amount` > 0)
);
--> statement-breakpoint
CREATE INDEX `payments_business_user_idx` ON `payments` (`business_id`,`user_id`);
```

- [ ] **Step 4: Register in `_journal.json`** — append after the `0015_notifications_order_id` entry, inside `entries`:

```json
    {
      "idx": 16,
      "version": "6",
      "when": 1780957481722,
      "tag": "0016_payments",
      "breakpoints": true
    }
```

- [ ] **Step 5: Verify the migration applies + core typechecks.**

Run (from repo root): `bun run cli db fresh`
Expected: completes, no errors; applies all 16 migrations.
Run: `bunx tsc --noEmit -p packages/core/tsconfig.json 2>&1 | grep payments || echo "no payments errors"`
Expected: no payments errors (a pre-existing baseline `client.ts` error may remain — ignore).
Run: `grep -c "payments_amount_positive" workers/api/src/database/migrations/0016_payments.sql`
Expected: `1` (the CHECK survived).

- [ ] **Step 6: Lint touched core files + commit.**

```bash
bunx biome check --write packages/core/src/database/schema/payments.schema.ts packages/core/src/database/schema/index.ts
git add packages/core/src/database/schema/payments.schema.ts packages/core/src/database/schema/index.ts workers/api/src/database/migrations/0016_payments.sql workers/api/src/database/migrations/meta/_journal.json
git commit -m "feat(core): payments schema + migration 0016"
```

---

## Task 2: Core — PaymentsRepository + KhataRepository

**Files:** create `packages/core/src/database/repositories/payments.repository.ts`, `packages/core/src/database/repositories/khata.repository.ts`.

> These hold the data access. The derivation SQL in `KhataRepository` is the crux — it is exercised end-to-end in Task 7 (real D1 seed + assert). Here we just write it to the analytics-repo aggregation pattern.

- [ ] **Step 1: Create `payments.repository.ts`:**

```ts
import { and, desc, eq, isNull } from "drizzle-orm";
import type { DbClient } from "../client";
import type { PaymentInsert, PaymentSelect } from "../schema";
import { paymentsSchema } from "../schema";

export class PaymentsRepository {
	constructor(private readonly db: DbClient) {}

	async create(input: PaymentInsert): Promise<PaymentSelect> {
		const [row] = await this.db
			.insert(paymentsSchema)
			.values(input)
			.returning();
		return row;
	}

	/** Live (non-voided) payment by id. */
	async findOne(id: string): Promise<PaymentSelect | null> {
		const [row] = await this.db
			.select()
			.from(paymentsSchema)
			.where(and(eq(paymentsSchema.id, id), isNull(paymentsSchema.deletedAt)));
		return row ?? null;
	}

	/** Void = soft-delete; the derived balance self-corrects. */
	async voidPayment(id: string, deletedAt: string): Promise<void> {
		await this.db
			.update(paymentsSchema)
			.set({ deletedAt })
			.where(eq(paymentsSchema.id, id));
	}

	/** A customer's live payment history for one business, newest first. */
	async findByBusinessCustomer(
		businessId: string,
		userId: string,
	): Promise<PaymentSelect[]> {
		return this.db
			.select()
			.from(paymentsSchema)
			.where(
				and(
					eq(paymentsSchema.businessId, businessId),
					eq(paymentsSchema.userId, userId),
					isNull(paymentsSchema.deletedAt),
				),
			)
			.orderBy(desc(paymentsSchema.createdAt));
	}
}
```

- [ ] **Step 2: Create `khata.repository.ts`** (derivation — mirrors the `analytics.repository.ts` `sql<number>\`sum(...)\`` + `groupBy` pattern):

```ts
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { DbClient } from "../client";
import { ordersSchema, paymentsSchema, usersSchema } from "../schema";

export interface KhataDueRow {
	userId: string;
	name: string;
	due: number;
}

export interface CustomerDue {
	due: number;
	totalDelivered: number;
	totalPaid: number;
}

export interface DeliveredOrderRow {
	id: string;
	total: number;
	deliveredAt: string | null;
}

export class KhataRepository {
	constructor(private readonly db: DbClient) {}

	/** Σ delivered-order totals − Σ payments, for one (business, customer). */
	async customerDue(
		businessId: string,
		userId: string,
	): Promise<CustomerDue> {
		const [orders] = await this.db
			.select({
				total: sql<number>`coalesce(sum(${ordersSchema.total}), 0)`,
			})
			.from(ordersSchema)
			.where(
				and(
					eq(ordersSchema.businessId, businessId),
					eq(ordersSchema.userId, userId),
					eq(ordersSchema.status, "Delivered"),
					isNull(ordersSchema.deletedAt),
				),
			);
		const [pay] = await this.db
			.select({
				total: sql<number>`coalesce(sum(${paymentsSchema.amount}), 0)`,
			})
			.from(paymentsSchema)
			.where(
				and(
					eq(paymentsSchema.businessId, businessId),
					eq(paymentsSchema.userId, userId),
					isNull(paymentsSchema.deletedAt),
				),
			);
		const totalDelivered = Number(orders?.total ?? 0);
		const totalPaid = Number(pay?.total ?? 0);
		return { due: totalDelivered - totalPaid, totalDelivered, totalPaid };
	}

	/** Customers with due > 0 for a business, with names, highest due first. */
	async businessDues(businessId: string): Promise<KhataDueRow[]> {
		const delivered = await this.db
			.select({
				userId: ordersSchema.userId,
				total: sql<number>`coalesce(sum(${ordersSchema.total}), 0)`,
			})
			.from(ordersSchema)
			.where(
				and(
					eq(ordersSchema.businessId, businessId),
					eq(ordersSchema.status, "Delivered"),
					isNull(ordersSchema.deletedAt),
				),
			)
			.groupBy(ordersSchema.userId);

		const paid = await this.db
			.select({
				userId: paymentsSchema.userId,
				total: sql<number>`coalesce(sum(${paymentsSchema.amount}), 0)`,
			})
			.from(paymentsSchema)
			.where(
				and(
					eq(paymentsSchema.businessId, businessId),
					isNull(paymentsSchema.deletedAt),
				),
			)
			.groupBy(paymentsSchema.userId);

		const paidMap = new Map(paid.map((p) => [p.userId, Number(p.total)]));
		// Only customers with delivered orders can owe; due > 0 filter handles
		// fully-paid and credit cases.
		const dues = delivered
			.map((d) => ({
				userId: d.userId,
				due: Number(d.total) - (paidMap.get(d.userId) ?? 0),
			}))
			.filter((d) => d.due > 0);
		if (dues.length === 0) return [];

		const ids = dues.map((d) => d.userId);
		const users = await this.db
			.select({ id: usersSchema.id, name: usersSchema.name })
			.from(usersSchema)
			.where(inArray(usersSchema.id, ids));
		const nameMap = new Map(users.map((u) => [u.id, u.name]));

		return dues
			.map((d) => ({
				userId: d.userId,
				name: nameMap.get(d.userId) ?? "Unknown",
				due: d.due,
			}))
			.sort((a, b) => b.due - a.due);
	}

	/** Delivered orders (the debits) for the per-customer ledger. */
	async deliveredOrders(
		businessId: string,
		userId: string,
	): Promise<DeliveredOrderRow[]> {
		return this.db
			.select({
				id: ordersSchema.id,
				total: ordersSchema.total,
				deliveredAt: ordersSchema.deliveredAt,
			})
			.from(ordersSchema)
			.where(
				and(
					eq(ordersSchema.businessId, businessId),
					eq(ordersSchema.userId, userId),
					eq(ordersSchema.status, "Delivered"),
					isNull(ordersSchema.deletedAt),
				),
			);
	}

	/** Customer display name for the ledger header. */
	async customerName(userId: string): Promise<string | null> {
		const [row] = await this.db
			.select({ name: usersSchema.name })
			.from(usersSchema)
			.where(eq(usersSchema.id, userId));
		return row?.name ?? null;
	}
}
```

> If `usersSchema` exposes the display name under a different property than `name`, match it (grep `usersSchema` in `users.schema.ts`); `customers.repository.ts` already selects the customer name, so mirror exactly what it uses.

- [ ] **Step 3: Typecheck + lint + commit.**

```bash
bunx tsc --noEmit -p packages/core/tsconfig.json 2>&1 | grep -E "payments.repository|khata.repository" || echo "no new errors"
bunx biome check --write packages/core/src/database/repositories/payments.repository.ts packages/core/src/database/repositories/khata.repository.ts
git add packages/core/src/database/repositories/payments.repository.ts packages/core/src/database/repositories/khata.repository.ts
git commit -m "feat(core): PaymentsRepository + KhataRepository (khata derivation)"
```

---

## Task 3: API — PaymentsService (TDD)

**Files:** create `workers/api/src/modules/payments/payments.service.ts`, `workers/api/src/__tests__/modules/payments/payments.service.test.ts`.

- [ ] **Step 1: Write the failing service test** `payments.service.test.ts` (mirrors `orders.service.test.ts`'s mocked-repo + `as never` style):

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	ForbiddenError,
	NotFoundError,
	ValidationError,
} from "../../../core/errors";
import { PaymentsService } from "../../../modules/payments/payments.service";

const repo = {
	create: vi.fn(),
	findOne: vi.fn(),
	voidPayment: vi.fn(),
	findByBusinessCustomer: vi.fn(),
};
const businessesRepo = { findOne: vi.fn() };

function makeService() {
	return new PaymentsService(repo as never, businessesRepo as never);
}

beforeEach(() => vi.clearAllMocks());

describe("PaymentsService.record", () => {
	it("records a payment for the owner with recordedBy = actor", async () => {
		businessesRepo.findOne.mockResolvedValue({
			data: { id: "biz1", ownerId: "owner-1" },
		});
		repo.create.mockResolvedValue({ id: "pay1", amount: 500 });
		const res = await makeService().record("owner-1", {
			businessId: "biz1",
			userId: "u1",
			amount: 500,
			note: "cash",
		});
		expect(res).toEqual({ id: "pay1", amount: 500 });
		expect(repo.create).toHaveBeenCalledWith(
			expect.objectContaining({
				businessId: "biz1",
				userId: "u1",
				amount: 500,
				note: "cash",
				recordedBy: "owner-1",
				orderId: null,
			}),
		);
	});

	it("rejects a non-owner with ForbiddenError", async () => {
		businessesRepo.findOne.mockResolvedValue({
			data: { id: "biz1", ownerId: "someone-else" },
		});
		await expect(
			makeService().record("owner-1", {
				businessId: "biz1",
				userId: "u1",
				amount: 500,
			}),
		).rejects.toBeInstanceOf(ForbiddenError);
		expect(repo.create).not.toHaveBeenCalled();
	});

	it("rejects a non-positive amount with ValidationError (before any DB call)", async () => {
		await expect(
			makeService().record("owner-1", {
				businessId: "biz1",
				userId: "u1",
				amount: 0,
			}),
		).rejects.toBeInstanceOf(ValidationError);
		expect(businessesRepo.findOne).not.toHaveBeenCalled();
	});
});

describe("PaymentsService.void", () => {
	it("soft-deletes a payment the owner owns", async () => {
		repo.findOne.mockResolvedValue({ id: "pay1", businessId: "biz1" });
		businessesRepo.findOne.mockResolvedValue({
			data: { id: "biz1", ownerId: "owner-1" },
		});
		await makeService().void("owner-1", "pay1");
		expect(repo.voidPayment).toHaveBeenCalledWith("pay1", expect.any(String));
	});

	it("404s a missing payment", async () => {
		repo.findOne.mockResolvedValue(null);
		await expect(makeService().void("owner-1", "nope")).rejects.toBeInstanceOf(
			NotFoundError,
		);
	});

	it("403s a cross-business void", async () => {
		repo.findOne.mockResolvedValue({ id: "pay1", businessId: "biz1" });
		businessesRepo.findOne.mockResolvedValue({
			data: { id: "biz1", ownerId: "other-owner" },
		});
		await expect(makeService().void("owner-1", "pay1")).rejects.toBeInstanceOf(
			ForbiddenError,
		);
		expect(repo.voidPayment).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run → fail.** `cd workers/api && bun run test src/__tests__/modules/payments/payments.service.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `payments.service.ts`:**

```ts
import { BusinessesRepository } from "@repo/core/src/database/repositories/businesses.repository";
import type { PaymentsRepository } from "@repo/core/src/database/repositories/payments.repository";
import type { PaymentSelect } from "@repo/core/src/database/schema";
import {
	ForbiddenError,
	NotFoundError,
	ValidationError,
} from "../../core/errors";

export interface RecordPaymentInput {
	businessId: string;
	userId: string;
	amount: number;
	note?: string;
	orderId?: string;
}

export class PaymentsService {
	constructor(
		private readonly repo: PaymentsRepository,
		private readonly businessesRepo: BusinessesRepository,
	) {}

	private async assertOwner(actorId: string, businessId: string): Promise<void> {
		const result = await this.businessesRepo.findOne(businessId);
		if (!result.data) throw new NotFoundError("Business not found");
		if (result.data.ownerId !== actorId)
			throw new ForbiddenError("You do not own this business");
	}

	async record(
		actorId: string,
		input: RecordPaymentInput,
	): Promise<PaymentSelect> {
		if (!Number.isInteger(input.amount) || input.amount <= 0)
			throw new ValidationError("amount must be a positive integer");
		await this.assertOwner(actorId, input.businessId);
		return this.repo.create({
			businessId: input.businessId,
			userId: input.userId,
			amount: input.amount,
			note: input.note ?? null,
			recordedBy: actorId,
			orderId: input.orderId ?? null,
		});
	}

	async void(actorId: string, paymentId: string): Promise<void> {
		const payment = await this.repo.findOne(paymentId);
		if (!payment) throw new NotFoundError("Payment not found");
		await this.assertOwner(actorId, payment.businessId);
		await this.repo.voidPayment(paymentId, new Date().toISOString());
	}
}
```

> `BusinessesRepository` is imported as a value only for the type in the constructor signature in tests; the service receives it via DI. If `ValidationError`/`ForbiddenError`/`NotFoundError` are not all exported from `../../core/errors`, grep that file and import the exact names (they are used by `orders.service.ts`).

- [ ] **Step 4: Run → pass.** `cd workers/api && bun run test src/__tests__/modules/payments/payments.service.test.ts` → all pass.

- [ ] **Step 5: tsc + lint + commit.**

```bash
cd workers/api && bunx tsc --noEmit -p tsconfig.json 2>&1 | grep "payments.service" || echo "no new errors"
cd /Users/hasib/Documents/Talash/monorepo/.claude/worktrees/khata-payments
bunx biome check --write workers/api/src/modules/payments/payments.service.ts workers/api/src/__tests__/modules/payments/payments.service.test.ts
git add workers/api/src/modules/payments/payments.service.ts workers/api/src/__tests__/modules/payments/payments.service.test.ts
git commit -m "feat(api): PaymentsService — record + void with owner guard"
```

---

## Task 4: API — KhataService (TDD)

**Files:** create `workers/api/src/modules/khata/khata.service.ts`, `workers/api/src/__tests__/modules/khata/khata.service.test.ts`.

- [ ] **Step 1: Write the failing service test** `khata.service.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "../../../core/errors";
import { KhataService } from "../../../modules/khata/khata.service";

const khataRepo = {
	customerDue: vi.fn(),
	businessDues: vi.fn(),
	deliveredOrders: vi.fn(),
	customerName: vi.fn(),
};
const paymentsRepo = { findByBusinessCustomer: vi.fn() };
const authz = { assertBusinessOwner: vi.fn() };

function makeService() {
	return new KhataService(
		khataRepo as never,
		paymentsRepo as never,
		authz as never,
	);
}

beforeEach(() => vi.clearAllMocks());

describe("KhataService.dues", () => {
	it("returns the dues list for the owner", async () => {
		authz.assertBusinessOwner.mockResolvedValue({ id: "biz1", ownerId: "owner-1" });
		khataRepo.businessDues.mockResolvedValue([
			{ userId: "u1", name: "Karim", due: 1200 },
		]);
		const res = await makeService().dues("owner-1", "biz1");
		expect(res).toEqual([{ userId: "u1", name: "Karim", due: 1200 }]);
	});

	it("rejects a non-owner", async () => {
		authz.assertBusinessOwner.mockRejectedValue(new ForbiddenError("no"));
		await expect(makeService().dues("owner-1", "biz1")).rejects.toBeInstanceOf(
			ForbiddenError,
		);
		expect(khataRepo.businessDues).not.toHaveBeenCalled();
	});
});

describe("KhataService.customerLedger", () => {
	it("composes due + delivered orders + payments + name", async () => {
		authz.assertBusinessOwner.mockResolvedValue({ id: "biz1", ownerId: "owner-1" });
		khataRepo.customerDue.mockResolvedValue({
			due: 700,
			totalDelivered: 1200,
			totalPaid: 500,
		});
		khataRepo.deliveredOrders.mockResolvedValue([
			{ id: "o1", total: 1200, deliveredAt: "2026-06-01" },
		]);
		khataRepo.customerName.mockResolvedValue("Karim");
		paymentsRepo.findByBusinessCustomer.mockResolvedValue([
			{ id: "p1", amount: 500, note: null, createdAt: "2026-06-02", recordedBy: "owner-1" },
		]);

		const res = await makeService().customerLedger("owner-1", "biz1", "u1");
		expect(res).toEqual({
			userId: "u1",
			name: "Karim",
			due: 700,
			totalDelivered: 1200,
			totalPaid: 500,
			deliveredOrders: [{ id: "o1", total: 1200, deliveredAt: "2026-06-01" }],
			payments: [
				{ id: "p1", amount: 500, note: null, createdAt: "2026-06-02", recordedBy: "owner-1" },
			],
		});
	});
});
```

- [ ] **Step 2: Run → fail.** `cd workers/api && bun run test src/__tests__/modules/khata/khata.service.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `khata.service.ts`:**

```ts
import type { AuthorizationService } from "../../core/authorization";
import type {
	CustomerDue,
	DeliveredOrderRow,
	KhataDueRow,
	KhataRepository,
} from "@repo/core/src/database/repositories/khata.repository";
import type { PaymentsRepository } from "@repo/core/src/database/repositories/payments.repository";
import type { PaymentSelect } from "@repo/core/src/database/schema";

export interface CustomerLedger extends CustomerDue {
	userId: string;
	name: string;
	deliveredOrders: DeliveredOrderRow[];
	payments: PaymentSelect[];
}

export class KhataService {
	constructor(
		private readonly khataRepo: KhataRepository,
		private readonly paymentsRepo: PaymentsRepository,
		private readonly authz: AuthorizationService,
	) {}

	async dues(actorId: string, businessId: string): Promise<KhataDueRow[]> {
		await this.authz.assertBusinessOwner(actorId, businessId);
		return this.khataRepo.businessDues(businessId);
	}

	async customerLedger(
		actorId: string,
		businessId: string,
		userId: string,
	): Promise<CustomerLedger> {
		await this.authz.assertBusinessOwner(actorId, businessId);
		const { due, totalDelivered, totalPaid } =
			await this.khataRepo.customerDue(businessId, userId);
		const deliveredOrders = await this.khataRepo.deliveredOrders(
			businessId,
			userId,
		);
		const payments = await this.paymentsRepo.findByBusinessCustomer(
			businessId,
			userId,
		);
		const name = (await this.khataRepo.customerName(userId)) ?? "Unknown";
		return {
			userId,
			name,
			due,
			totalDelivered,
			totalPaid,
			deliveredOrders,
			payments,
		};
	}
}
```

- [ ] **Step 4: Run → pass.** `cd workers/api && bun run test src/__tests__/modules/khata/khata.service.test.ts` → all pass.

- [ ] **Step 5: tsc + lint + commit.**

```bash
cd workers/api && bunx tsc --noEmit -p tsconfig.json 2>&1 | grep "khata.service" || echo "no new errors"
cd /Users/hasib/Documents/Talash/monorepo/.claude/worktrees/khata-payments
bunx biome check --write workers/api/src/modules/khata/khata.service.ts workers/api/src/__tests__/modules/khata/khata.service.test.ts
git add workers/api/src/modules/khata/khata.service.ts workers/api/src/__tests__/modules/khata/khata.service.test.ts
git commit -m "feat(api): KhataService — dues list + per-customer ledger"
```

---

## Task 5: API — modules, wiring, route tests (TDD)

**Files:** create `workers/api/src/modules/payments/index.ts`, `workers/api/src/modules/khata/index.ts`, `workers/api/src/__tests__/modules/payments/payments.routes.test.ts`, `workers/api/src/__tests__/modules/khata/khata.routes.test.ts`; modify `workers/api/src/middleware/shared-deps.ts`, `workers/api/src/middleware/services.ts`, `workers/api/src/types/index.ts`, `workers/api/src/modules/routes.ts`, `workers/api/src/__tests__/helpers/create-test-app.ts`.

- [ ] **Step 1: Create the payments module `workers/api/src/modules/payments/index.ts`** (mirrors `customers`/`orders` route style + the installer pattern):

```ts
import { createRoute, z } from "@hono/zod-openapi";
import { createApp } from "../../core/create-app";
import { authenticate } from "../../middleware/auth";
import { requireAuth } from "../../middleware/auth-guard";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import { PaymentsService } from "./payments.service";

const RecordBody = z
	.object({
		businessId: z.string().min(1),
		userId: z.string().min(1),
		amount: z.number().int().positive(),
		note: z.string().optional(),
		orderId: z.string().optional(),
	})
	.openapi("RecordPaymentBody");

const IdParam = z.object({ id: z.string() });

const recordRoute = createRoute({
	method: "post",
	path: "/",
	tags: ["Payments"],
	summary: "Record a cash payment (owner)",
	security: [{ bearerAuth: [] }],
	request: {
		body: {
			content: { "application/json": { schema: RecordBody } },
			required: true,
		},
	},
	responses: {
		201: {
			content: { "application/json": { schema: z.any() } },
			description: "Created",
		},
	},
});

const voidRoute = createRoute({
	method: "delete",
	path: "/:id",
	tags: ["Payments"],
	summary: "Void a payment (owner)",
	security: [{ bearerAuth: [] }],
	request: { params: IdParam },
	responses: { 204: { description: "Voided" } },
});

export const paymentsApp = createApp();
paymentsApp.use("*", authenticate, requireAuth(["owner", "manager"]));

paymentsApp
	.openapi(recordRoute, async (c) => {
		const body = c.req.valid("json");
		const payment = await c.var.paymentsService.record(c.var.user.id, body);
		return c.json(payment, 201);
	})
	.openapi(voidRoute, async (c) => {
		await c.var.paymentsService.void(c.var.user.id, c.req.valid("param").id);
		return c.body(null, 204);
	});

export const installPaymentsService: ServiceInstaller = (
	c,
	{ paymentsRepo, authz },
) => c.set("paymentsService", new PaymentsService(paymentsRepo, authz));
```

> Confirm the body accessor is `c.req.valid("json")` vs `"body"` by checking `orders/index.ts`'s POST handler (it uses the same `@hono/zod-openapi` version) and match it.

- [ ] **Step 2: Create the khata module `workers/api/src/modules/khata/index.ts`:**

```ts
import { createRoute, z } from "@hono/zod-openapi";
import { createApp } from "../../core/create-app";
import { authenticate } from "../../middleware/auth";
import { requireAuth } from "../../middleware/auth-guard";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import { KhataService } from "./khata.service";

const BusinessIdQuery = z.object({ businessId: z.string() });
const CustomerParams = z.object({ userId: z.string() });

const duesRoute = createRoute({
	method: "get",
	path: "/dues",
	tags: ["Khata"],
	summary: "Customer dues list (owner)",
	security: [{ bearerAuth: [] }],
	request: { query: BusinessIdQuery },
	responses: {
		200: {
			content: { "application/json": { schema: z.any() } },
			description: "OK",
		},
	},
});

const ledgerRoute = createRoute({
	method: "get",
	path: "/customers/:userId",
	tags: ["Khata"],
	summary: "One customer's khata ledger (owner)",
	security: [{ bearerAuth: [] }],
	request: { params: CustomerParams, query: BusinessIdQuery },
	responses: {
		200: {
			content: { "application/json": { schema: z.any() } },
			description: "OK",
		},
	},
});

export const khataApp = createApp();
khataApp.use("*", authenticate, requireAuth(["owner", "manager"]));

khataApp
	.openapi(duesRoute, async (c) => {
		const { businessId } = c.req.valid("query");
		const dues = await c.var.khataService.dues(c.var.user.id, businessId);
		return c.json(dues, 200);
	})
	.openapi(ledgerRoute, async (c) => {
		const { userId } = c.req.valid("param");
		const { businessId } = c.req.valid("query");
		const ledger = await c.var.khataService.customerLedger(
			c.var.user.id,
			businessId,
			userId,
		);
		return c.json(ledger, 200);
	});

export const installKhataService: ServiceInstaller = (
	c,
	{ khataRepo, paymentsRepo, authz },
) =>
	c.set(
		"khataService",
		new KhataService(khataRepo, paymentsRepo, authz),
	);
```

- [ ] **Step 3: Wire `SharedDeps` (`workers/api/src/middleware/shared-deps.ts`).** Add the two type imports next to the other repo imports:

```ts
import type { PaymentsRepository } from "@repo/core/src/database/repositories/payments.repository";
import type { KhataRepository } from "@repo/core/src/database/repositories/khata.repository";
```
Add the two fields to the `SharedDeps` interface (after `customerAddressesRepo`):
```ts
	paymentsRepo: PaymentsRepository;
	khataRepo: KhataRepository;
```

- [ ] **Step 4: Instantiate them (`workers/api/src/middleware/services.ts`).** Add the value imports (next to the other repository imports at the top of the file), then in `injectServices`, after `const customerAddressesRepo = new CustomerAddressesRepository(db);`:

```ts
import { PaymentsRepository } from "@repo/core/src/database/repositories/payments.repository";
import { KhataRepository } from "@repo/core/src/database/repositories/khata.repository";
```
```ts
		const paymentsRepo = new PaymentsRepository(db);
		const khataRepo = new KhataRepository(db);
```
And add `paymentsRepo,` and `khataRepo,` to the `const deps: SharedDeps = { ... }` object literal.

- [ ] **Step 5: Add the context vars (`workers/api/src/types/index.ts`).** Add imports near the other service imports:

```ts
import type { PaymentsService } from "../modules/payments/payments.service";
import type { KhataService } from "../modules/khata/khata.service";
```
Add to the `Variables` block (after `notificationsService: NotificationsService;`):
```ts
		paymentsService: PaymentsService;
		khataService: KhataService;
```

- [ ] **Step 6: Mount + register installers (`workers/api/src/modules/routes.ts`).** Add imports:
```ts
import { installPaymentsService, paymentsApp } from "./payments";
import { installKhataService, khataApp } from "./khata";
```
Register both installers in the installer array (mirror where `installOrdersService` is added), and mount both apps where the other apps are routed (mirror `ordersApp`/`customersApp` mounting — typically `.route("/payments", paymentsApp)` and `.route("/khata", khataApp)`; match the exact `.route(...)`/path style used for `customersApp`).

- [ ] **Step 7: Extend the test app (`workers/api/src/__tests__/helpers/create-test-app.ts`).** Add type imports + app imports:
```ts
import { paymentsApp } from "../../modules/payments";
import type { PaymentsService } from "../../modules/payments/payments.service";
import { khataApp } from "../../modules/khata";
import type { KhataService } from "../../modules/khata/khata.service";
```
Add to `MockServices`:
```ts
	paymentsService?: Partial<PaymentsService>;
	khataService?: Partial<KhataService>;
```
And mount `paymentsApp`/`khataApp` + set the mock services on the context exactly as the helper does for `ordersApp`/`ordersService` (find the block that mounts apps and the block that `c.set(...)`s each provided mock service, and add the two new ones with the same shape and the same route paths used in Step 6).

- [ ] **Step 8: Write the failing route tests.** `workers/api/src/__tests__/modules/payments/payments.routes.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "../../../core/errors";
import { authHeader, createTestToken, TEST_ENV } from "../../helpers/auth";
import { createTestApp } from "../../helpers/create-test-app";

const mockPaymentsService = { record: vi.fn(), void: vi.fn() };
const app = createTestApp({ paymentsService: mockPaymentsService as never });
beforeEach(() => vi.clearAllMocks());

const body = { businessId: "biz1", userId: "u1", amount: 500 };

describe("POST /api/v1/payments", () => {
	it("401 without auth", async () => {
		const res = await app.request(
			"/api/v1/payments",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});

	it("403 for a customer role", async () => {
		const token = await createTestToken({ role: "customer", userId: "u9" });
		const res = await app.request(
			"/api/v1/payments",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify(body),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("201 for an owner", async () => {
		mockPaymentsService.record.mockResolvedValue({ id: "pay1", amount: 500 });
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/payments",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify(body),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(201);
		expect(mockPaymentsService.record).toHaveBeenCalledWith(
			"owner-1",
			expect.objectContaining({ businessId: "biz1", userId: "u1", amount: 500 }),
		);
	});

	it("422 when amount is not a positive integer (zod)", async () => {
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/payments",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader(token) },
				body: JSON.stringify({ ...body, amount: 0 }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(422);
	});
});

describe("DELETE /api/v1/payments/:id", () => {
	it("204 when the owner voids", async () => {
		mockPaymentsService.void.mockResolvedValue(undefined);
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/payments/pay1",
			{ method: "DELETE", headers: { ...authHeader(token) } },
			TEST_ENV,
		);
		expect(res.status).toBe(204);
		expect(mockPaymentsService.void).toHaveBeenCalledWith("owner-1", "pay1");
	});
});
```

`workers/api/src/__tests__/modules/khata/khata.routes.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authHeader, createTestToken, TEST_ENV } from "../../helpers/auth";
import { createTestApp } from "../../helpers/create-test-app";

const mockKhataService = { dues: vi.fn(), customerLedger: vi.fn() };
const app = createTestApp({ khataService: mockKhataService as never });
beforeEach(() => vi.clearAllMocks());

describe("GET /api/v1/khata/dues", () => {
	it("401 without auth", async () => {
		const res = await app.request("/api/v1/khata/dues?businessId=biz1", {}, TEST_ENV);
		expect(res.status).toBe(401);
	});

	it("200 with the dues list for an owner", async () => {
		mockKhataService.dues.mockResolvedValue([
			{ userId: "u1", name: "Karim", due: 1200 },
		]);
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/khata/dues?businessId=biz1",
			{ headers: { ...authHeader(token) } },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual([{ userId: "u1", name: "Karim", due: 1200 }]);
		expect(mockKhataService.dues).toHaveBeenCalledWith("owner-1", "biz1");
	});
});

describe("GET /api/v1/khata/customers/:userId", () => {
	it("200 with the customer ledger", async () => {
		mockKhataService.customerLedger.mockResolvedValue({
			userId: "u1",
			name: "Karim",
			due: 700,
			totalDelivered: 1200,
			totalPaid: 500,
			deliveredOrders: [],
			payments: [],
		});
		const token = await createTestToken({ role: "owner", userId: "owner-1" });
		const res = await app.request(
			"/api/v1/khata/customers/u1?businessId=biz1",
			{ headers: { ...authHeader(token) } },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		expect(mockKhataService.customerLedger).toHaveBeenCalledWith(
			"owner-1",
			"biz1",
			"u1",
		);
	});
});
```

- [ ] **Step 9: Run → pass + tsc.**

Run: `cd workers/api && bun run test src/__tests__/modules/payments/ src/__tests__/modules/khata/`
Expected: all pass. (If the `403 for a customer role` test fails because `requireAuth` returns 401/another code, adjust the expectation to whatever `requireAuth(["owner","manager"])` actually returns for a `customer` token — grep an existing route test that asserts a role rejection, e.g. in `customers.routes.test.ts` or `analytics.routes.test.ts`, and match its expected status.)
Run: `bunx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "modules/payments|modules/khata|shared-deps|services.ts|types/index|create-test-app"` → no output.

- [ ] **Step 10: Lint + commit.**

```bash
cd /Users/hasib/Documents/Talash/monorepo/.claude/worktrees/khata-payments
bunx biome check --write workers/api/src/modules/payments/index.ts workers/api/src/modules/khata/index.ts workers/api/src/middleware/shared-deps.ts workers/api/src/middleware/services.ts workers/api/src/types/index.ts workers/api/src/modules/routes.ts workers/api/src/__tests__/helpers/create-test-app.ts workers/api/src/__tests__/modules/payments/payments.routes.test.ts workers/api/src/__tests__/modules/khata/khata.routes.test.ts
git add workers/api/src/modules/payments/ workers/api/src/modules/khata/ workers/api/src/middleware/ workers/api/src/types/index.ts workers/api/src/modules/routes.ts workers/api/src/__tests__/
git commit -m "feat(api): payments + khata modules, wiring, route tests"
```

---

## Task 6: api-client — payments + khata endpoints + types

**Files:** create `packages/api-client/src/endpoints/payments.ts`, `packages/api-client/src/endpoints/khata.ts`; modify `packages/api-client/src/types.ts`, `packages/api-client/src/index.ts`.

- [ ] **Step 1: Add types to `packages/api-client/src/types.ts`** (place near `CustomerAddress` / the commerce types):

```ts
export interface Payment {
	id: string;
	businessId: string;
	userId: string;
	amount: number;
	note: string | null;
	recordedBy: string;
	orderId: string | null;
	createdAt: string;
	updatedAt: string | null;
}

export interface KhataDue {
	userId: string;
	name: string;
	due: number;
}

export interface KhataCustomer {
	userId: string;
	name: string;
	due: number;
	totalDelivered: number;
	totalPaid: number;
	deliveredOrders: { id: string; total: number; deliveredAt: string | null }[];
	payments: Payment[];
}
```

- [ ] **Step 2: Create `packages/api-client/src/endpoints/payments.ts`** (mirror `endpoints/orders.ts`):

```ts
import type { ApiClient } from "../client";
import type { Payment } from "../types";

export interface RecordPaymentBody {
	businessId: string;
	userId: string;
	amount: number;
	note?: string;
	orderId?: string;
}

export function createPaymentsEndpoints(client: ApiClient) {
	return {
		record: (body: RecordPaymentBody) =>
			client.post<Payment>("/api/v1/payments", body),
		void: (id: string) => client.delete<void>(`/api/v1/payments/${id}`),
	};
}
```

> Confirm the client exposes a `delete<T>(url)` method (grep `delete` in `packages/api-client/src/client.ts`); if the verb method differs, match it. If `void` is an awkward key name for a method, keep it — it mirrors the domain action; rename only if the client/lint forbids it.

- [ ] **Step 3: Create `packages/api-client/src/endpoints/khata.ts`:**

```ts
import type { ApiClient } from "../client";
import type { KhataCustomer, KhataDue } from "../types";

export function createKhataEndpoints(client: ApiClient) {
	return {
		dues: (businessId: string) =>
			client.get<KhataDue[]>("/api/v1/khata/dues", { businessId }),
		customer: (userId: string, businessId: string) =>
			client.get<KhataCustomer>(`/api/v1/khata/customers/${userId}`, {
				businessId,
			}),
	};
}
```

> Match the `client.get(url, params)` query-param signature to how `endpoints/customers.ts` passes `{ businessId }` (it does exactly this).

- [ ] **Step 4: Register in `packages/api-client/src/index.ts`** (mirror the `orders`/`customers` registration):

```ts
import { createPaymentsEndpoints } from "./endpoints/payments";
import { createKhataEndpoints } from "./endpoints/khata";
```
In the endpoints object (next to `orders: createOrdersEndpoints(client),`):
```ts
		payments: createPaymentsEndpoints(client),
		khata: createKhataEndpoints(client),
```
Re-export the body type if the index re-exports endpoint types (mirror `export type { PlaceOrderBody } from "./endpoints/orders";`):
```ts
export type { RecordPaymentBody } from "./endpoints/payments";
```

- [ ] **Step 5: Typecheck + lint + commit.**

```bash
bunx tsc --noEmit -p packages/api-client/tsconfig.json 2>&1 | grep -E "payments|khata|types.ts" || echo "no new errors"
bunx biome check --write packages/api-client/src/endpoints/payments.ts packages/api-client/src/endpoints/khata.ts packages/api-client/src/types.ts packages/api-client/src/index.ts
git add packages/api-client/src/endpoints/payments.ts packages/api-client/src/endpoints/khata.ts packages/api-client/src/types.ts packages/api-client/src/index.ts
git commit -m "feat(api-client): payments + khata endpoints + types"
```

---

## Task 7: Seeder + derivation integration check + docs + final gate

**Files:** a payments seeder under `tools/cli/` (mirror the orders seeder); docs (`workers/api/CLAUDE.md`, `docs/guides/api-endpoints.md`, `docs/guides/ui-backend-sync.md`, `docs/plan/multi-vertical-schema-design.md`).

- [ ] **Step 1: Add a payments seeder.** Open `tools/cli/` and find the orders seeder (the module that seeds `orders`/`order_items`; grep `orders` under `tools/cli/`). Add a `payments` seeder that mirrors its structure: for a subset of `(business, customer)` pairs that have `Delivered` orders, insert 0–2 `payments` rows with a positive `amount` (some less than the delivered total so a non-zero due remains, some clearing it). Register it in the seeder list exactly as the orders seeder is registered. Keep amounts positive integers (the `CHECK` enforces it).

- [ ] **Step 2: Verify the seeder + migration run clean.**

Run (from root): `bun run cli db fresh`
Expected: completes; `bun run cli db status` shows a non-zero `payments` row count.

- [ ] **Step 3: Integration-verify the derivation against real local D1.** The route/service tests mock the repos, so the actual `Σ delivered − Σ payments` SQL is unverified until here. Verify it end-to-end:

Start the API: `bun run api:dev` (separate terminal).
Pick a seeded commerce business + a customer with delivered orders (from `bun run cli db status` / a quick `orders` query, or the seeder's known ids). Obtain an owner token for that business (reuse the project's local-auth path used in other manual checks).
Run: `curl -s "http://localhost:8787/api/v1/khata/customers/<userId>?businessId=<businessId>" -H "Authorization: Bearer <token>" | jq`
Expected: `due === totalDelivered − totalPaid`, `deliveredOrders` lists only `Delivered` orders, `payments` excludes any you soft-delete.
Then `curl -s "http://localhost:8787/api/v1/khata/dues?businessId=<businessId>" -H "Authorization: Bearer <token>" | jq` → only customers with `due > 0`, sorted desc.
Record one DELETE `/api/v1/payments/<id>` and re-fetch the ledger → `due` increased by that amount (void self-corrects).

> If obtaining a local owner token is friction, instead add a focused integration test that builds a real in-memory/D1 client, seeds two delivered orders (total 1200) + one payment (500) for one `(business, customer)`, and asserts `KhataRepository.customerDue` returns `{ due: 700, totalDelivered: 1200, totalPaid: 500 }` and that a voided payment is excluded — following whatever real-DB test harness the order-flow stock-invariant e2e used (grep the test that exercised `placeOrder` against a real D1).

- [ ] **Step 4: Docs.**
  - `workers/api/CLAUDE.md` — add **Payments** + **Khata** sections: routes, owner-only auth via `assertBusinessOwner`, the derived-balance rule (`Σ delivered − Σ payments`), void = soft-delete.
  - `docs/guides/api-endpoints.md` — add `POST/DELETE /api/v1/payments` and `GET /api/v1/khata/dues`, `GET /api/v1/khata/customers/:userId`.
  - `docs/guides/ui-backend-sync.md` — note the upcoming owner khata hooks consume `api.payments.*` / `api.khata.*`.
  - `docs/plan/multi-vertical-schema-design.md` — flip the Phase-1 status note: the khata/payments portion is now implemented (payments table + derivation + owner routes).

- [ ] **Step 5: Final gate.**

Run: `cd workers/api && bun run test 2>&1 | tail -8` — the new payments/khata service + route tests pass; no new failures vs the pre-existing baseline.
Run: `bunx tsc --noEmit -p workers/api/tsconfig.json 2>&1 | grep -E "payments|khata" || echo "clean"` — no output.
Run (root): `bun run lint` — touched files clean (repo baseline red is expected; confirm no NEW errors in touched files).
Run (root): `bun run build` — succeeds.

- [ ] **Step 6: Commit.**

```bash
git add tools/cli/ workers/api/CLAUDE.md docs/
git commit -m "feat(cli)+docs: payments seeder + khata/payments backend docs"
```

---

## Self-Review notes

- **Spec coverage:** Data layer (schema/migration/repos) → Tasks 1–2. API (payments + khata routes, owner auth) → Tasks 3–5. api-client → Task 6. Testing → per-task service tests + Task 5 route tests + Task 7 derivation integration check. Seeder + docs → Task 7.
- **Auth correction (important):** the spec said "owner/manager," but `AuthorizationService.assertBusinessOwner` checks `business.ownerId === actorId`, making this **owner-only effective** (managers pass `requireAuth(["owner","manager"])` but fail the owner check). Services inject `authz` and call `this.authz.assertBusinessOwner(...)` (the worker guide mandates this over hand-rolled checks; `OrdersService` is the precedent). The role middleware stays `["owner","manager"]` for consistency with siblings; if true manager access is wanted later, add a team-membership-aware assertion to `AuthorizationService`. Flagged for the user.
- **Type consistency:** `RecordPaymentInput`/`RecordPaymentBody` fields (`businessId,userId,amount,note?,orderId?`) match across `PaymentsService` (T3), the route body (T5), and the api-client (T6). `KhataDueRow`/`CustomerDue`/`DeliveredOrderRow` from `KhataRepository` (T2) are reused by `KhataService` (T4) and mirrored by `KhataDue`/`KhataCustomer` in api-client (T6). `recordedBy` = actor id everywhere; `note`/`orderId` default to `null` at the repo boundary.
- **Derivation safety:** voided payments (`deletedAt`) and non-`Delivered` orders are excluded in SQL; `businessDues` filters `due > 0`; the real SQL is integration-verified in Task 7 (mocked unit tests can't prove it).
- **Migration:** hand-authored `0016` per the approved Option A; **no `db:generate`**; snapshot debt remains a separate deferred follow-up.
- **Plan B (owner-app khata UI)** is authored separately after this lands, so it references the final api-client shapes.
```
