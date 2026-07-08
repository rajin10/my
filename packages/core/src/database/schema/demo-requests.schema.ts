import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { primaryID, timestamps } from "../helpers";

export const demoRequestsSchema = sqliteTable("demo_requests", {
	...primaryID(),
	name: text().notNull(),
	email: text().notNull(),
	businessName: text("business_name").notNull(),
	message: text(),
	...timestamps(),
});

export type DemoRequestSelect = typeof demoRequestsSchema.$inferSelect;
export type DemoRequestInsert = Omit<
	typeof demoRequestsSchema.$inferInsert,
	"id" | "createdAt" | "updatedAt" | "deletedAt"
>;
