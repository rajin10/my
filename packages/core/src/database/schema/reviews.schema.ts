import { sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { primaryID, timestamps } from "../helpers";
import { bookingsSchema } from "./bookings.schema";
import { servicesSchema } from "./services.schema";
import { businessesSchema } from "./businesses.schema";
import { usersSchema } from "./users.schema";

export const reviewsSchema = sqliteTable(
	"reviews",
	{
		...primaryID(),
		userId: text("user_id")
			.notNull()
			.references(() => usersSchema.id),
		businessId: text("business_id")
			.notNull()
			.references(() => businessesSchema.id),
		serviceId: text("service_id")
			.notNull()
			.references(() => servicesSchema.id),
		bookingId: text("booking_id").references(() => bookingsSchema.id),
		rating: integer().notNull(),
		text: text().notNull(),
		status: text({ enum: ["Pending", "Published"] })
			.notNull()
			.default("Pending"),
		...timestamps(),
	},
	(table) => [
		index("reviews_business_id_idx").on(table.businessId),
		index("reviews_user_id_idx").on(table.userId),
		// One review per booking (partial — booking_id is nullable for manual/legacy reviews)
		uniqueIndex("reviews_booking_id_unique")
			.on(table.bookingId)
			.where(sql`${table.bookingId} IS NOT NULL`),
	],
);

export type ReviewSelect = typeof reviewsSchema.$inferSelect;
export type ReviewInsert = Omit<
	typeof reviewsSchema.$inferInsert,
	"id" | "createdAt" | "updatedAt" | "deletedAt"
>;
