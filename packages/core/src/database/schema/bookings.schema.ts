import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { primaryID, timestamps } from "../helpers";
import { branchesSchema } from "./branches.schema";
import { servicesSchema } from "./services.schema";
import { teamMembersSchema } from "./team.schema";
import { usersSchema } from "./users.schema";

export const BookingStatus = {
	PENDING: "Pending",
	CONFIRMED: "Confirmed",
	CANCELLED: "Cancelled",
	COMPLETED: "Completed",
} as const;
export type BookingStatusType =
	(typeof BookingStatus)[keyof typeof BookingStatus];

export const BookingSource = {
	APP: "app",
	WALK_IN: "walk_in",
	WEB: "web",
} as const;
export type BookingSourceType =
	(typeof BookingSource)[keyof typeof BookingSource];

export const bookingsSchema = sqliteTable(
	"bookings",
	{
		...primaryID(),
		userId: text("user_id").references(() => usersSchema.id),
		serviceId: text("service_id")
			.notNull()
			.references(() => servicesSchema.id),
		branchId: text("branch_id")
			.notNull()
			.references(() => branchesSchema.id),
		// ISO local datetime, e.g. "2026-06-01T11:00:00"
		staffId: text("staff_id").references(() => teamMembersSchema.id, {
			onDelete: "set null",
		}),
		slot: text().notNull(),
		status: text({ enum: ["Pending", "Confirmed", "Cancelled", "Completed"] })
			.notNull()
			.default("Pending"),
		price: integer().notNull(),
		discount: integer().notNull().default(0),
		couponCode: text("coupon_code"),
		source: text({ enum: ["app", "walk_in", "web"] })
			.notNull()
			.default("app"),
		guestName: text("guest_name"),
		guestPhone: text("guest_phone"),
		walkInLocalId: text("walk_in_local_id"),
		...timestamps(),
	},
	(table) => [
		check(
			"bookings_customer_required",
			sql`( ${table.userId} IS NOT NULL ) OR ( ${table.guestName} IS NOT NULL AND ${table.guestPhone} IS NOT NULL )`,
		),
		uniqueIndex("bookings_walk_in_local_id_unique")
			.on(table.walkInLocalId)
			.where(sql`${table.walkInLocalId} IS NOT NULL`),
		index("bookings_user_id_idx").on(table.userId),
		index("bookings_branch_id_idx").on(table.branchId),
		index("bookings_service_id_idx").on(table.serviceId),
		index("bookings_slot_idx").on(table.slot),
		// At most one active booking per (branch, service, slot) — prevents double-booking
		uniqueIndex("bookings_active_slot_unique")
			.on(table.branchId, table.serviceId, table.slot)
			.where(sql`${table.status} IN ('Pending', 'Confirmed')`),
	],
);

export type BookingSelect = typeof bookingsSchema.$inferSelect;
export type BookingInsert = Omit<
	typeof bookingsSchema.$inferInsert,
	"id" | "createdAt" | "updatedAt" | "deletedAt"
>;
