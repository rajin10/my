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
