import {
	index,
	integer,
	real,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";
import { primaryID, timestamps } from "../helpers";
import { usersSchema } from "./users.schema";

export const customerAddressesSchema = sqliteTable(
	"customer_addresses",
	{
		...primaryID(),
		userId: text("user_id")
			.notNull()
			.references(() => usersSchema.id, { onDelete: "cascade" }),
		label: text(),
		line: text().notNull(),
		area: text(),
		city: text(),
		lat: real(),
		lng: real(),
		isDefault: integer("is_default", { mode: "boolean" })
			.notNull()
			.default(false),
		...timestamps(),
	},
	(t) => [index("customer_addresses_user_id_idx").on(t.userId)],
);

export type CustomerAddressSelect = typeof customerAddressesSchema.$inferSelect;
export type CustomerAddressInsert = Omit<
	typeof customerAddressesSchema.$inferInsert,
	"id" | "createdAt" | "updatedAt" | "deletedAt"
>;
