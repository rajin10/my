import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { primaryID, timestamps } from "../helpers";
import { teamMembersSchema } from "./team.schema";

export const staffAvailabilitySchema = sqliteTable(
	"staff_availability",
	{
		...primaryID(),
		teamMemberId: text("team_member_id")
			.notNull()
			.references(() => teamMembersSchema.id, { onDelete: "cascade" }),
		dayOfWeek: integer("day_of_week").notNull(), // 0=Sun..6=Sat
		isClosed: integer("is_closed", { mode: "boolean" })
			.notNull()
			.default(false),
		startTime: text("start_time"), // HH:MM
		endTime: text("end_time"), // HH:MM
		...timestamps(),
	},
	(table) => [index("staff_availability_member_idx").on(table.teamMemberId)],
);

export type StaffAvailabilitySelect =
	typeof staffAvailabilitySchema.$inferSelect;
export type StaffAvailabilityInsert = Omit<
	typeof staffAvailabilitySchema.$inferInsert,
	"id" | "createdAt" | "updatedAt" | "deletedAt"
>;
