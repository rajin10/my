import { sql } from "drizzle-orm";
import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { primaryID, timestamps } from "../helpers";

export enum UserRole {
	MANAGER = "manager",
	MODERATOR = "moderator",
	OWNER = "owner",
	STAFF = "staff",
	USER = "user",
}

export const usersSchema = sqliteTable(
	"users",
	{
		...primaryID(),
		email: text(),
		phone: text(),
		name: text().notNull(),
		role: text({
			enum: [
				UserRole.MANAGER,
				UserRole.MODERATOR,
				UserRole.OWNER,
				UserRole.STAFF,
				UserRole.USER,
			],
		}).notNull(),
		googleId: text(),
		pushToken: text(),
		photoUrl: text(),
		...timestamps(),
	},
	(table) => [
		// Uniqueness is scoped per-role: the same email / phone / Google account may
		// back at most one account per role (e.g. a "user" customer account and an
		// "owner" business account can share an email). Partial indexes still exclude
		// soft-deleted rows so a deleted account's email/phone can be re-registered
		uniqueIndex("users_email_idx")
			.on(table.email, table.role)
			.where(sql`${table.email} IS NOT NULL AND ${table.deletedAt} IS NULL`),
		uniqueIndex("users_phone_idx")
			.on(table.phone, table.role)
			.where(sql`${table.phone} IS NOT NULL AND ${table.deletedAt} IS NULL`),
		uniqueIndex("users_google_id_idx")
			.on(table.googleId, table.role)
			.where(sql`${table.googleId} IS NOT NULL AND ${table.deletedAt} IS NULL`),
	],
);

export type UserSelect = typeof usersSchema.$inferSelect;

export type UserInsert = Omit<
	typeof usersSchema.$inferInsert,
	"id" | "createdAt" | "updatedAt" | "deletedAt"
>;
