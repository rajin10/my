import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { primaryID, timestamps } from "../helpers";
import { usersSchema } from "./users.schema";

export const authRefreshTokensSchema = sqliteTable(
	"auth_refresh_tokens",
	{
		...primaryID(),
		// Opaque token looked up by value — unique, not the PK
		token: text("token").notNull().unique(),
		userId: text("user_id")
			.notNull()
			.references(() => usersSchema.id, { onDelete: "cascade" }),
		expiresAt: text("expires_at").notNull(),
		// Device tracking for multi-device session management
		deviceId: text("device_id"),
		deviceName: text("device_name"),
		lastUsedAt: text("last_used_at"),
		...timestamps(),
	},
	(table) => [index("auth_refresh_tokens_user_id_idx").on(table.userId)],
);

export type AuthRefreshTokenSelect =
	typeof authRefreshTokensSchema.$inferSelect;

/** Password and other auth secrets — kept separate from the public user profile. */
export const authCredentialsSchema = sqliteTable(
	"auth_credentials",
	{
		...primaryID(),
		userId: text("user_id")
			.notNull()
			.unique()
			.references(() => usersSchema.id, { onDelete: "cascade" }),
		passwordHash: text("password_hash"),
		passwordUpdatedAt: text("password_updated_at"),
		...timestamps(),
	},
	(table) => [index("auth_credentials_user_id_idx").on(table.userId)],
);

export type AuthCredentialsSelect = typeof authCredentialsSchema.$inferSelect;
