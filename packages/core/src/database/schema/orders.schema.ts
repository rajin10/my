import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	real,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { primaryID, timestamps } from "../helpers";
import { branchesSchema } from "./branches.schema";
import { businessesSchema } from "./businesses.schema";
import { usersSchema } from "./users.schema";

export const OrderStatus = {
	PENDING: "Pending",
	CONFIRMED: "Confirmed",
	OUT_FOR_DELIVERY: "OutForDelivery",
	DELIVERED: "Delivered",
	CANCELLED: "Cancelled",
} as const;
export type OrderStatusType = (typeof OrderStatus)[keyof typeof OrderStatus];

export const OrderSource = {
	APP: "app",
	WALK_IN: "walk_in",
	WEB: "web",
} as const;
export type OrderSourceType = (typeof OrderSource)[keyof typeof OrderSource];

export const OrderFulfillment = {
	DELIVERY: "delivery",
	COUNTER: "counter",
} as const;
export type OrderFulfillmentType =
	(typeof OrderFulfillment)[keyof typeof OrderFulfillment];

export const ordersSchema = sqliteTable(
	"orders",
	{
		...primaryID(),
		businessId: text("business_id")
			.notNull()
			.references(() => businessesSchema.id),
		branchId: text("branch_id")
			.notNull()
			.references(() => branchesSchema.id),
		userId: text("user_id").references(() => usersSchema.id),
		status: text({
			enum: [
				"Pending",
				"Confirmed",
				"OutForDelivery",
				"Delivered",
				"Cancelled",
			],
		})
			.notNull()
			.default("Pending"),
		total: integer().notNull(),
		fulfillment: text({ enum: ["delivery", "counter"] })
			.notNull()
			.default("delivery"),
		deliveryLine: text("delivery_line"),
		deliveryArea: text("delivery_area"),
		deliveryCity: text("delivery_city"),
		deliveryLat: real("delivery_lat"),
		deliveryLng: real("delivery_lng"),
		deliveredAt: text("delivered_at"),
		source: text({ enum: ["app", "walk_in", "web"] })
			.notNull()
			.default("app"),
		guestName: text("guest_name"),
		guestPhone: text("guest_phone"),
		walkInLocalId: text("walk_in_local_id"),
		...timestamps(),
	},
	(t) => [
		check(
			"orders_customer_required",
			sql`( ${t.userId} IS NOT NULL ) OR ( ${t.guestName} IS NOT NULL AND ${t.guestPhone} IS NOT NULL )`,
		),
		check(
			"orders_delivery_line_required",
			sql`( ${t.fulfillment} = 'counter' ) OR ( ${t.deliveryLine} IS NOT NULL )`,
		),
		uniqueIndex("orders_walk_in_local_id_unique")
			.on(t.walkInLocalId)
			.where(sql`${t.walkInLocalId} IS NOT NULL`),
		index("orders_business_id_idx").on(t.businessId),
		index("orders_branch_id_idx").on(t.branchId),
		index("orders_user_id_idx").on(t.userId),
		index("orders_status_idx").on(t.status),
		index("orders_business_user_idx").on(t.businessId, t.userId),
	],
);

export type OrderSelect = typeof ordersSchema.$inferSelect;
export type OrderInsert = Omit<
	typeof ordersSchema.$inferInsert,
	"id" | "createdAt" | "updatedAt" | "deletedAt"
>;
