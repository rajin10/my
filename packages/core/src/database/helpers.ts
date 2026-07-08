import { text } from "drizzle-orm/sqlite-core";

export const primaryID = () => ({
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
});

export const timestamps = () => ({
	createdAt: text()
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text().$onUpdateFn(() => new Date().toISOString()),
	deletedAt: text(),
});
