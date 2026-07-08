import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { primaryID, timestamps } from "../helpers";
import { branchesSchema } from "./branches.schema";
import { businessesSchema } from "./businesses.schema";
import { usersSchema } from "./users.schema";

export const TeamRole = {
	OWNER: "Owner",
	MANAGER: "Manager",
	STAFF: "Staff",
} as const;
export type TeamRoleType = (typeof TeamRole)[keyof typeof TeamRole];

export const teamMembersSchema = sqliteTable(
	"team_members",
	{
		...primaryID(),
		userId: text("user_id")
			.notNull()
			.references(() => usersSchema.id, { onDelete: "cascade" }),
		businessId: text("business_id")
			.notNull()
			.references(() => businessesSchema.id, { onDelete: "cascade" }),
		// null = member belongs to the whole business, not a specific branch
		branchId: text("branch_id").references(() => branchesSchema.id, {
			onDelete: "set null",
		}),
		title: text().notNull().default("Staff"),
		role: text({ enum: ["Owner", "Manager", "Staff"] }).notNull(),
		...timestamps(),
	},
	(table) => [
		index("team_members_business_id_idx").on(table.businessId),
		index("team_members_user_id_idx").on(table.userId),
		// One membership record per user per business
		uniqueIndex("team_members_user_business_unique").on(
			table.userId,
			table.businessId,
		),
	],
);

export type TeamMemberSelect = typeof teamMembersSchema.$inferSelect;
export type TeamMemberInsert = Omit<
	typeof teamMembersSchema.$inferInsert,
	"id" | "createdAt" | "updatedAt" | "deletedAt"
>;
