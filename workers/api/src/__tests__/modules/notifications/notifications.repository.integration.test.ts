/**
 * Real-DB regression test for the notification dedupe-key idempotency. The
 * unique index on `dedupe_key` and the `ON CONFLICT DO NOTHING` behaviour are
 * only exercised by the actual SQLite engine (createTestDb replays every
 * migration, including the one that adds the index), so this verifies the real
 * conditional insert rather than a mock. The first test guards the rest: if the
 * index isn't materialised, the dedupe behaviour below is meaningless.
 */
import { NotificationsRepository } from "@repo/core/src/database/repositories/notifications.repository";
import type { NotificationInsert } from "@repo/core/src/database/schema";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../helpers/test-db";

type Db = ReturnType<typeof createTestDb>;

function notif(over: Partial<NotificationInsert> = {}): NotificationInsert {
	return {
		userId: "u-1",
		type: "order",
		title: "Order confirmed",
		body: "Your order has been confirmed.",
		go: "orders",
		orderId: "o-1",
		readAt: null,
		...over,
	} as NotificationInsert;
}

async function countAll(db: Db): Promise<number> {
	const { notificationsSchema } = await import(
		"@repo/core/src/database/schema"
	);
	// biome-ignore lint/suspicious/noExplicitAny: better-sqlite3 vs D1 drizzle type mismatch in tests
	const rows = await (db as any).select().from(notificationsSchema);
	return rows.length;
}

describe("NotificationsRepository.create (real-DB dedupe-key idempotency)", () => {
	let db: Db;
	let repo: NotificationsRepository;
	beforeEach(() => {
		db = createTestDb();
		repo = new NotificationsRepository(db as never);
	});

	it("the migration materialised the unique index on dedupe_key (guards the suite)", () => {
		const rows = (
			db as unknown as {
				all: (q: unknown) => Array<{ name: string }>;
			}
		).all(
			sql`SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'notifications_dedupe_key_idx'`,
		);
		expect(rows.map((r) => r.name)).toContain("notifications_dedupe_key_idx");
	});

	it("a second create with the same dedupeKey is a no-op: one row, original survivor returned", async () => {
		const key = "order:o-1:Confirmed:u-1";
		const first = await repo.create(notif({ dedupeKey: key }));
		const second = await repo.create(
			notif({ dedupeKey: key, title: "DUPLICATE retry" }),
		);

		// Same surviving row, not a freshly-inserted one; the retry's title is dropped.
		expect(second.id).toBe(first.id);
		expect(second.title).toBe("Order confirmed");
		expect(await countAll(db)).toBe(1);
	});

	it("distinct dedupeKeys insert distinct rows (e.g. successive order statuses)", async () => {
		await repo.create(notif({ dedupeKey: "order:o-1:Confirmed:u-1" }));
		await repo.create(
			notif({ dedupeKey: "order:o-1:OutForDelivery:u-1", title: "On its way" }),
		);
		expect(await countAll(db)).toBe(2);
	});

	it("keyless notifications (dedupeKey null) always insert — never deduped", async () => {
		await repo.create(notif({ dedupeKey: null }));
		await repo.create(notif({ dedupeKey: null }));
		expect(await countAll(db)).toBe(2);
	});
});
