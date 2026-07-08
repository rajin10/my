import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { DbClient } from "../client";
import type { NotificationInsert, NotificationSelect } from "../schema";
import { notificationsSchema } from "../schema";

export class NotificationsRepository {
	constructor(private readonly db: DbClient) {}

	/**
	 * Insert a notification, idempotent on `dedupeKey`. A queue-retry of the same
	 * event carries the same key; the unique index turns the re-insert into a
	 * no-op (`ON CONFLICT DO NOTHING`) so no duplicate in-app row is written, and
	 * we return the row that survived. Keyless rows (`dedupeKey` null) never
	 * conflict (SQLite treats NULLs as distinct), so they always insert.
	 */
	async create(data: NotificationInsert): Promise<NotificationSelect> {
		const id = crypto.randomUUID();
		const createdAt = new Date().toISOString();
		await this.db
			.insert(notificationsSchema)
			.values({ ...data, id, createdAt })
			.onConflictDoNothing({ target: notificationsSchema.dedupeKey });
		// On a dedupe-key conflict the insert no-ops, so the row we want is the
		// pre-existing one — fetch it by key. Keyless inserts can't conflict, so
		// fetch by the id we just generated.
		const rows = data.dedupeKey
			? await this.db
					.select()
					.from(notificationsSchema)
					.where(eq(notificationsSchema.dedupeKey, data.dedupeKey))
					.limit(1)
			: await this.db
					.select()
					.from(notificationsSchema)
					.where(eq(notificationsSchema.id, id))
					.limit(1);
		// biome-ignore lint/style/noNonNullAssertion: keyed → survivor exists; keyless → just inserted
		return rows[0]!;
	}

	async listByUser(userId: string, limit = 50): Promise<NotificationSelect[]> {
		return this.db
			.select()
			.from(notificationsSchema)
			.where(
				and(
					eq(notificationsSchema.userId, userId),
					isNull(notificationsSchema.deletedAt),
				),
			)
			.orderBy(desc(notificationsSchema.createdAt))
			.limit(limit);
	}

	async markRead(
		id: string,
		userId: string,
	): Promise<NotificationSelect | null> {
		const readAt = new Date().toISOString();
		await this.db
			.update(notificationsSchema)
			.set({ readAt, updatedAt: readAt })
			.where(
				and(
					eq(notificationsSchema.id, id),
					eq(notificationsSchema.userId, userId),
					isNull(notificationsSchema.deletedAt),
				),
			);
		const rows = await this.db
			.select()
			.from(notificationsSchema)
			.where(
				and(
					eq(notificationsSchema.id, id),
					eq(notificationsSchema.userId, userId),
				),
			)
			.limit(1);
		return rows[0] ?? null;
	}

	async markAllRead(userId: string): Promise<number> {
		const readAt = new Date().toISOString();
		const result = await this.db
			.update(notificationsSchema)
			.set({ readAt, updatedAt: readAt })
			.where(
				and(
					eq(notificationsSchema.userId, userId),
					isNull(notificationsSchema.readAt),
					isNull(notificationsSchema.deletedAt),
				),
			);
		return Number((result as { changes?: number }).changes ?? 0);
	}

	async countUnread(userId: string): Promise<number> {
		const rows = await this.db
			.select({ count: sql<number>`count(*)` })
			.from(notificationsSchema)
			.where(
				and(
					eq(notificationsSchema.userId, userId),
					isNull(notificationsSchema.readAt),
					isNull(notificationsSchema.deletedAt),
				),
			);
		return rows[0]?.count ?? 0;
	}
}
