import {
	UserRole,
	type UserSelect,
	usersSchema,
} from "@core/database/schema/users.schema.ts";
import type { DbClient } from "../core/db.ts";
import { createUser } from "../factories/user.factory.ts";
import type { SeedOptions, SeedResult } from "./seeder.types.ts";

const CHUNK = 500;

interface UsersResult extends SeedResult {
	userIds: string[];
	ownerIds: string[];
	staffIds: string[];
}

export async function seedUsers(
	db: DbClient,
	opts: SeedOptions,
): Promise<UsersResult> {
	const ownerCount = Math.max(1, Math.floor(opts.count * 0.12));
	const staffCount = Math.max(2, Math.floor(opts.count * 0.15));
	const plainCount = Math.max(1, Math.floor(opts.count * 0.05));
	const customerCount = Math.max(
		1,
		opts.count - ownerCount - staffCount - plainCount,
	);

	const rows: UserSelect[] = [
		...Array.from({ length: ownerCount }, () =>
			createUser({ role: UserRole.MANAGER }),
		),
		...Array.from({ length: staffCount }, () =>
			createUser({ role: UserRole.STAFF }),
		),
		...Array.from({ length: customerCount }, () =>
			createUser({ role: UserRole.USER }),
		),
		...Array.from({ length: plainCount }, () =>
			createUser({ role: UserRole.USER }),
		),
	];

	for (let i = 0; i < rows.length; i += CHUNK) {
		await db.insert(usersSchema as never).values(rows.slice(i, i + CHUNK));
	}

	return {
		module: "users",
		inserted: rows.length,
		userIds: rows.filter((r) => r.role === UserRole.USER).map((r) => r.id),
		ownerIds: rows.filter((r) => r.role === UserRole.MANAGER).map((r) => r.id),
		staffIds: rows.filter((r) => r.role === UserRole.STAFF).map((r) => r.id),
	};
}
