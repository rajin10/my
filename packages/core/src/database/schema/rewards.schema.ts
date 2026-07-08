import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { primaryID, timestamps } from "../helpers";
import { bookingsSchema } from "./bookings.schema";
import { usersSchema } from "./users.schema";

export const rewardPointsSchema = sqliteTable(
	"reward_points",
	{
		...primaryID(),
		userId: text("user_id")
			.notNull()
			.references(() => usersSchema.id, { onDelete: "cascade" }),
		balance: integer().notNull().default(0),
		...timestamps(),
	},
	(table) => [uniqueIndex("reward_points_user_id_unique").on(table.userId)],
);

export const rewardTransactionsSchema = sqliteTable(
	"reward_transactions",
	{
		...primaryID(),
		userId: text("user_id")
			.notNull()
			.references(() => usersSchema.id),
		bookingId: text("booking_id").references(() => bookingsSchema.id, {
			onDelete: "set null",
		}),
		type: text({ enum: ["credit", "debit"] }).notNull(),
		points: integer().notNull(),
		description: text().notNull(),
		...timestamps(),
	},
	(table) => [index("reward_transactions_user_id_idx").on(table.userId)],
);

export type RewardPointsSelect = typeof rewardPointsSchema.$inferSelect;
export type RewardTransactionSelect =
	typeof rewardTransactionsSchema.$inferSelect;
export type RewardTransactionInsert = Omit<
	typeof rewardTransactionsSchema.$inferInsert,
	"id" | "createdAt" | "updatedAt" | "deletedAt"
>;
