import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { primaryID, timestamps } from "../helpers";
import { usersSchema } from "./users.schema";

export const NotificationType = {
	BOOKING: "booking",
	CANCEL: "cancel",
	REVIEW: "review",
	SYSTEM: "system",
	ORDER: "order",
	ORDER_CANCELLED: "order_cancelled",
} as const;
export type NotificationTypeValue =
	(typeof NotificationType)[keyof typeof NotificationType];

export const notificationsSchema = sqliteTable(
	"notifications",
	{
		...primaryID(),
		userId: text("user_id")
			.notNull()
			.references(() => usersSchema.id, { onDelete: "cascade" }),
		type: text({
			enum: [
				"booking",
				"cancel",
				"review",
				"system",
				"order",
				"order_cancelled",
			],
		}).notNull(),
		title: text().notNull(),
		body: text().notNull(),
		readAt: text("read_at"),
		businessId: text("business_id"),
		bookingId: text("booking_id"),
		reviewId: text("review_id"),
		orderId: text("order_id"),
		go: text(),
		/**
		 * Deterministic per-event idempotency key (e.g. `order:<id>:<status>:<userId>`).
		 * Null for ad-hoc notifications. A unique index makes a queue-retry of the
		 * same event a no-op instead of inserting a duplicate in-app row. SQLite
		 * treats NULLs as distinct, so keyless rows never collide.
		 */
		dedupeKey: text("dedupe_key"),
		...timestamps(),
	},
	(table) => [
		index("notifications_user_id_idx").on(table.userId),
		index("notifications_user_created_idx").on(table.userId, table.createdAt),
		uniqueIndex("notifications_dedupe_key_idx").on(table.dedupeKey),
	],
);

export type NotificationSelect = typeof notificationsSchema.$inferSelect;
export type NotificationInsert = Omit<
	typeof notificationsSchema.$inferInsert,
	"id" | "createdAt" | "updatedAt" | "deletedAt"
>;
