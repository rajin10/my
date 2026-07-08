import { and, eq, isNull, sql } from "drizzle-orm";
import type { DbClient } from "../client";
import {
	authCredentialsSchema,
	authRefreshTokensSchema,
	UserRole,
	usersSchema,
} from "../schema";

export class EmailAlreadyRegisteredError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "EmailAlreadyRegisteredError";
	}
}

export class GoogleAccountExistsError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GoogleAccountExistsError";
	}
}

export class AuthRepository {
	constructor(private readonly db: DbClient) {}

	async findUserById(id: string) {
		const rows = await this.db
			.select()
			.from(usersSchema)
			.where(and(eq(usersSchema.id, id), isNull(usersSchema.deletedAt)))
			.limit(1);
		return rows[0] ?? null;
	}

	async createRefreshToken(
		userId: string,
		token: string,
		expiresAt: string,
		device?: { deviceId?: string; deviceName?: string },
	) {
		const [row] = await this.db
			.insert(authRefreshTokensSchema)
			.values({
				userId,
				token,
				expiresAt,
				deviceId: device?.deviceId ?? null,
				deviceName: device?.deviceName ?? null,
				lastUsedAt: new Date().toISOString(),
			})
			.returning();
		// biome-ignore lint/style/noNonNullAssertion: drizzle .returning() always yields the inserted row
		return row!;
	}

	async findRefreshToken(token: string) {
		const rows = await this.db
			.select()
			.from(authRefreshTokensSchema)
			.where(
				and(
					eq(authRefreshTokensSchema.token, token),
					isNull(authRefreshTokensSchema.deletedAt),
				),
			)
			.limit(1);
		return rows[0] ?? null;
	}

	async touchRefreshToken(token: string): Promise<void> {
		await this.db
			.update(authRefreshTokensSchema)
			.set({ lastUsedAt: new Date().toISOString() })
			.where(eq(authRefreshTokensSchema.token, token));
	}

	async deleteRefreshToken(token: string, userId: string) {
		await this.db
			.delete(authRefreshTokensSchema)
			.where(
				and(
					eq(authRefreshTokensSchema.token, token),
					eq(authRefreshTokensSchema.userId, userId),
				),
			);
	}

	async listSessionsByUser(userId: string) {
		return this.db
			.select({
				id: authRefreshTokensSchema.id,
				deviceId: authRefreshTokensSchema.deviceId,
				deviceName: authRefreshTokensSchema.deviceName,
				lastUsedAt: authRefreshTokensSchema.lastUsedAt,
				expiresAt: authRefreshTokensSchema.expiresAt,
				createdAt: authRefreshTokensSchema.createdAt,
			})
			.from(authRefreshTokensSchema)
			.where(
				and(
					eq(authRefreshTokensSchema.userId, userId),
					isNull(authRefreshTokensSchema.deletedAt),
					sql`${authRefreshTokensSchema.expiresAt} > ${new Date().toISOString()}`,
				),
			)
			.orderBy(authRefreshTokensSchema.createdAt);
	}

	async revokeSessionById(id: string, userId: string): Promise<boolean> {
		const result = await this.db
			.delete(authRefreshTokensSchema)
			.where(
				and(
					eq(authRefreshTokensSchema.id, id),
					eq(authRefreshTokensSchema.userId, userId),
					isNull(authRefreshTokensSchema.deletedAt),
				),
			)
			.returning({ id: authRefreshTokensSchema.id });
		return result.length > 0;
	}

	/**
	 * Find-or-create scoped to a single role. Identifiers (googleId, email) are unique
	 * per-role, so the same Google account / email can back one account per role. A
	 * lookup or insert here only ever touches rows whose `role` matches `role`.
	 */
	async findOrCreateUserByGoogle(
		googleId: string,
		email: string | null,
		name: string,
		role: UserRole = UserRole.USER,
	): Promise<{ user: typeof usersSchema.$inferSelect; isNew: boolean }> {
		// 1. Already linked for this role
		const byGoogle = await this.db
			.select()
			.from(usersSchema)
			.where(
				and(
					eq(usersSchema.googleId, googleId),
					eq(usersSchema.role, role),
					isNull(usersSchema.deletedAt),
				),
			)
			.limit(1);
		if (byGoogle[0]) return { user: byGoogle[0], isNew: false };

		// 2. Existing account with same verified email for this role — link the Google ID
		if (email) {
			const byEmail = await this.db
				.select()
				.from(usersSchema)
				.where(
					and(
						eq(usersSchema.email, email),
						eq(usersSchema.role, role),
						isNull(usersSchema.deletedAt),
					),
				)
				.limit(1);
			if (byEmail[0]) {
				const [updated] = await this.db
					.update(usersSchema)
					.set({ googleId })
					.where(eq(usersSchema.id, byEmail[0].id))
					.returning();
				// biome-ignore lint/style/noNonNullAssertion: drizzle .returning() always yields the updated record
				return { user: updated!, isNew: false };
			}
		}

		// 3. Brand-new account for this role
		const [created] = await this.db
			.insert(usersSchema)
			.values({ googleId, email, name, role })
			.returning();
		// biome-ignore lint/style/noNonNullAssertion: drizzle .returning() always yields the inserted record
		return { user: created!, isNew: true };
	}

	async findUserByEmailAndRole(email: string, role: UserRole) {
		const rows = await this.db
			.select()
			.from(usersSchema)
			.where(
				and(
					eq(usersSchema.email, email),
					eq(usersSchema.role, role),
					isNull(usersSchema.deletedAt),
				),
			)
			.limit(1);
		return rows[0] ?? null;
	}

	async findCredentialsByUserId(userId: string) {
		const rows = await this.db
			.select()
			.from(authCredentialsSchema)
			.where(
				and(
					eq(authCredentialsSchema.userId, userId),
					isNull(authCredentialsSchema.deletedAt),
				),
			)
			.limit(1);
		return rows[0] ?? null;
	}

	async registerWithPassword(
		email: string,
		passwordHash: string,
		name: string,
		role: UserRole = UserRole.USER,
	): Promise<{ user: typeof usersSchema.$inferSelect; isNew: true }> {
		const existing = await this.findUserByEmailAndRole(email, role);
		if (existing) {
			const credentials = await this.findCredentialsByUserId(existing.id);
			if (credentials?.passwordHash) {
				throw new EmailAlreadyRegisteredError(
					"This email is already registered.",
				);
			}
			if (existing.googleId) {
				throw new GoogleAccountExistsError(
					"An account with this email already exists. Sign in with Google or use forgot password to set a password.",
				);
			}
			throw new EmailAlreadyRegisteredError(
				"This email is already registered.",
			);
		}

		const userId = crypto.randomUUID();
		const now = new Date().toISOString();

		await this.db.batch([
			this.db.insert(usersSchema).values({
				id: userId,
				email,
				name,
				role,
			}),
			this.db.insert(authCredentialsSchema).values({
				userId,
				passwordHash,
				passwordUpdatedAt: now,
			}),
		]);

		const user = await this.findUserById(userId);
		if (!user) {
			throw new Error("Failed to create user with password credentials.");
		}

		return { user, isNew: true };
	}

	async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
		const now = new Date().toISOString();
		const existing = await this.findCredentialsByUserId(userId);

		if (existing) {
			await this.db
				.update(authCredentialsSchema)
				.set({ passwordHash, passwordUpdatedAt: now })
				.where(eq(authCredentialsSchema.userId, userId));
			return;
		}

		await this.db.insert(authCredentialsSchema).values({
			userId,
			passwordHash,
			passwordUpdatedAt: now,
		});
	}

	async savePushToken(userId: string, token: string) {
		await this.db
			.update(usersSchema)
			.set({ pushToken: token })
			.where(eq(usersSchema.id, userId));
	}

	/** Clear a stale push token (e.g. after receiving DeviceNotRegistered from Expo). */
	async clearPushToken(userId: string): Promise<void> {
		await this.db
			.update(usersSchema)
			.set({ pushToken: null })
			.where(eq(usersSchema.id, userId));
	}

	/** Delete expired refresh tokens. Returns the count of rows removed. */
	async deleteExpiredRefreshTokens(now: string): Promise<number> {
		const result = await this.db
			.delete(authRefreshTokensSchema)
			.where(sql`${authRefreshTokensSchema.expiresAt} < ${now}`)
			.returning({ id: authRefreshTokensSchema.id });
		return result.length;
	}
}
