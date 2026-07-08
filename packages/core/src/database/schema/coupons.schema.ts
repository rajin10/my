import { sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { primaryID, timestamps } from "../helpers";
import { businessesSchema } from "./businesses.schema";

export const couponsSchema = sqliteTable(
	"coupons",
	{
		...primaryID(),
		businessId: text("business_id")
			.notNull()
			.references(() => businessesSchema.id, { onDelete: "cascade" }),
		code: text().notNull(),
		type: text({ enum: ["Percentage", "Fixed"] }).notNull(),
		value: integer().notNull(),
		usedCount: integer("used_count").notNull().default(0),
		maxUses: integer("max_uses").notNull(),
		status: text({ enum: ["Active", "Expired"] })
			.notNull()
			.default("Active"),
		expiresAt: text("expires_at").notNull(),
		...timestamps(),
	},
	(table) => [
		// Per-business uniqueness: two businesses can use the same code string independently
		uniqueIndex("coupons_business_code_unique")
			.on(table.businessId, table.code)
			.where(sql`${table.deletedAt} IS NULL`),
		index("coupons_business_id_idx").on(table.businessId),
	],
);

export type CouponSelect = typeof couponsSchema.$inferSelect;
export type CouponInsert = Omit<
	typeof couponsSchema.$inferInsert,
	"id" | "createdAt" | "updatedAt" | "deletedAt"
>;
