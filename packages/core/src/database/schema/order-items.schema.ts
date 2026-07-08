import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";
import { primaryID, timestamps } from "../helpers";
import { ordersSchema } from "./orders.schema";
import { productsSchema } from "./products.schema";

export const orderItemsSchema = sqliteTable(
	"order_items",
	{
		...primaryID(),
		orderId: text("order_id")
			.notNull()
			.references(() => ordersSchema.id, { onDelete: "cascade" }),
		productId: text("product_id")
			.notNull()
			.references(() => productsSchema.id),
		quantity: integer().notNull(),
		unitPrice: integer("unit_price").notNull(),
		...timestamps(),
	},
	(t) => [
		index("order_items_order_id_idx").on(t.orderId),
		index("order_items_product_id_idx").on(t.productId),
		check("order_items_qty_positive", sql`${t.quantity} > 0`),
	],
);

export type OrderItemSelect = typeof orderItemsSchema.$inferSelect;
export type OrderItemInsert = Omit<
	typeof orderItemsSchema.$inferInsert,
	"id" | "createdAt" | "updatedAt" | "deletedAt"
>;
