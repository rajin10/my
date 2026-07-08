import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { primaryID, timestamps } from "../helpers";
import { branchesSchema } from "./branches.schema";

export const servicesSchema = sqliteTable(
	"services",
	{
		...primaryID(),
		branchId: text("branch_id")
			.notNull()
			.references(() => branchesSchema.id, { onDelete: "cascade" }),
		name: text().notNull(),
		category: text().notNull(),
		duration: integer().notNull(), // minutes
		price: integer().notNull(), // smallest currency unit (paise)
		description: text(),
		imageUrl: text("image_url"),
		...timestamps(),
	},
	(table) => [index("services_branch_id_idx").on(table.branchId)],
);

export type ServiceSelect = typeof servicesSchema.$inferSelect;
export type ServiceInsert = Omit<
	typeof servicesSchema.$inferInsert,
	"id" | "createdAt" | "updatedAt" | "deletedAt"
>;
