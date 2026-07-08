import {
	index,
	integer,
	real,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { primaryID, timestamps } from "../helpers";
import { businessesSchema } from "./businesses.schema";

export const branchesSchema = sqliteTable(
	"branches",
	{
		...primaryID(),
		businessId: text("business_id")
			.notNull()
			.references(() => businessesSchema.id, { onDelete: "cascade" }),
		name: text().notNull(),
		address: text().notNull(),
		city: text().notNull(),
		area: text(),
		lat: real(),
		lng: real(),
		walkInQrVersion: integer("walk_in_qr_version").notNull().default(0),
		...timestamps(),
	},
	(table) => [
		index("branches_business_id_idx").on(table.businessId),
		index("branches_area_idx").on(table.area),
	],
);

// 0 = Sunday, 1 = Monday, ..., 6 = Saturday
export const branchHoursSchema = sqliteTable(
	"branch_hours",
	{
		...primaryID(),
		branchId: text("branch_id")
			.notNull()
			.references(() => branchesSchema.id, { onDelete: "cascade" }),
		dayOfWeek: integer("day_of_week").notNull(), // 0–6
		openTime: text("open_time"), // "HH:MM" in 24-h, null when isClosed
		closeTime: text("close_time"), // "HH:MM" in 24-h, null when isClosed
		isClosed: integer("is_closed", { mode: "boolean" })
			.notNull()
			.default(false),
		...timestamps(),
	},
	(table) => [
		index("branch_hours_branch_id_idx").on(table.branchId),
		uniqueIndex("branch_hours_branch_day_unique").on(
			table.branchId,
			table.dayOfWeek,
		),
	],
);

export type BranchSelect = typeof branchesSchema.$inferSelect;
export type BranchInsert = Omit<
	typeof branchesSchema.$inferInsert,
	"id" | "createdAt" | "updatedAt" | "deletedAt"
>;
export type BranchHoursSelect = typeof branchHoursSchema.$inferSelect;
export type BranchHoursInsert = Omit<
	typeof branchHoursSchema.$inferInsert,
	"id" | "createdAt" | "updatedAt" | "deletedAt"
>;
