import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { primaryID, timestamps } from "../helpers";
import { businessesSchema } from "./businesses.schema";
import { usersSchema } from "./users.schema";

export const favouritesSchema = sqliteTable(
	"favourites",
	{
		...primaryID(),
		userId: text("user_id")
			.notNull()
			.references(() => usersSchema.id, { onDelete: "cascade" }),
		businessId: text("business_id")
			.notNull()
			.references(() => businessesSchema.id, { onDelete: "cascade" }),
		...timestamps(),
	},
	(table) => [
		uniqueIndex("favourites_user_business_unique").on(
			table.userId,
			table.businessId,
		),
		index("favourites_user_id_idx").on(table.userId),
		index("favourites_business_id_idx").on(table.businessId),
	],
);

export type FavouriteSelect = typeof favouritesSchema.$inferSelect;
export type FavouriteInsert = Omit<
	typeof favouritesSchema.$inferInsert,
	"id" | "createdAt" | "updatedAt" | "deletedAt"
>;
