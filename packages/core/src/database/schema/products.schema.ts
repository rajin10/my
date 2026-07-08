import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";
import { primaryID, timestamps } from "../helpers";
import { branchesSchema } from "./branches.schema";

export const ProductStatus = {
	ACTIVE: "Active",
	INACTIVE: "Inactive",
} as const;
export type ProductStatusType =
	(typeof ProductStatus)[keyof typeof ProductStatus];

// Commerce vertical only: a sellable physical good with stock tracked per branch.
export const productsSchema = sqliteTable(
	"products",
	{
		...primaryID(),
		branchId: text("branch_id")
			.notNull()
			.references(() => branchesSchema.id, { onDelete: "cascade" }),
		name: text().notNull(),
		category: text(),
		price: integer().notNull(), // smallest currency unit (paisa)
		stock: integer().notNull().default(0),
		description: text(),
		imageUrl: text("image_url"),
		status: text({ enum: ["Active", "Inactive"] })
			.notNull()
			.default("Active"),
		...timestamps(),
	},
	(table) => [
		index("products_branch_id_idx").on(table.branchId),
		// The commerce invariant: stock never goes negative. Enforced at the DB so an
		// atomic decrement in a db.batch() aborts the whole order on oversell.
		check("products_stock_nonneg", sql`${table.stock} >= 0`),
	],
);

export type ProductSelect = typeof productsSchema.$inferSelect;
export type ProductInsert = Omit<
	typeof productsSchema.$inferInsert,
	"id" | "createdAt" | "updatedAt" | "deletedAt"
>;
