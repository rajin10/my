import { and, eq, isNull, sql } from "drizzle-orm";
import type { DbClient } from "../client";
import type { RewardPointsSelect, RewardTransactionSelect } from "../schema";
import { rewardPointsSchema, rewardTransactionsSchema } from "../schema";

// Points per currency unit — 1 point per ₹10 spent (after discount)
export const POINTS_RATE = 10;

export class RewardsRepository {
	constructor(private readonly db: DbClient) {}

	async getBalance(userId: string): Promise<RewardPointsSelect | null> {
		const rows = await this.db
			.select()
			.from(rewardPointsSchema)
			.where(eq(rewardPointsSchema.userId, userId))
			.limit(1);
		return rows[0] ?? null;
	}

	async getHistory(userId: string): Promise<RewardTransactionSelect[]> {
		return this.db
			.select()
			.from(rewardTransactionsSchema)
			.where(
				and(
					eq(rewardTransactionsSchema.userId, userId),
					isNull(rewardTransactionsSchema.deletedAt),
				),
			);
	}

	async credit(
		userId: string,
		bookingId: string,
		points: number,
	): Promise<void> {
		// Idempotency guard: skip if this booking has already been credited
		const alreadyCredited = await this.db
			.select({ id: rewardTransactionsSchema.id })
			.from(rewardTransactionsSchema)
			.where(
				and(
					eq(rewardTransactionsSchema.userId, userId),
					eq(rewardTransactionsSchema.bookingId, bookingId),
					eq(rewardTransactionsSchema.type, "credit"),
					isNull(rewardTransactionsSchema.deletedAt),
				),
			)
			.limit(1);
		if (alreadyCredited.length > 0) return;

		// Atomic upsert — avoids TOCTOU when concurrent credits land for the same user
		await this.db
			.insert(rewardPointsSchema)
			.values({ userId, balance: points })
			.onConflictDoUpdate({
				target: rewardPointsSchema.userId,
				set: {
					balance: sql`${rewardPointsSchema.balance} + ${points}`,
					updatedAt: new Date().toISOString(),
				},
			});

		// Insert transaction record
		await this.db.insert(rewardTransactionsSchema).values({
			userId,
			bookingId,
			type: "credit",
			points,
			description: `Earned ${points} points for completed booking`,
		});
	}

	/**
	 * Find users whose stored balance differs from the sum of their transactions.
	 * Used by the weekly reconciliation cron to detect and fix balance drift.
	 */
	async findDriftingBalances(): Promise<
		Array<{ userId: string; balance: number; computed: number }>
	> {
		const rows = await this.db
			.select({
				userId: rewardPointsSchema.userId,
				balance: rewardPointsSchema.balance,
				computed: sql<number>`
					coalesce(
						(select sum(case when t.type = 'credit' then t.points else -t.points end)
						 from ${rewardTransactionsSchema} t
						 where t.user_id = ${rewardPointsSchema.userId}
						   and t.deleted_at is null),
						0
					)
				`,
			})
			.from(rewardPointsSchema);

		return rows.filter((r) => r.balance !== r.computed);
	}

	/** Correct a user's stored balance to match the computed value. */
	async setBalance(userId: string, balance: number): Promise<void> {
		await this.db
			.update(rewardPointsSchema)
			.set({ balance, updatedAt: new Date().toISOString() })
			.where(eq(rewardPointsSchema.userId, userId));
	}

	/**
	 * Atomically debit points. Throws if the user does not have enough balance.
	 * Returns the new balance.
	 */
	async debit(
		userId: string,
		points: number,
		description: string,
	): Promise<number> {
		const now = new Date().toISOString();

		// Atomic UPDATE with balance guard — only succeeds when balance >= points
		const [updated] = await this.db
			.update(rewardPointsSchema)
			.set({
				balance: sql`${rewardPointsSchema.balance} - ${points}`,
				updatedAt: now,
			})
			.where(
				and(
					eq(rewardPointsSchema.userId, userId),
					sql`${rewardPointsSchema.balance} >= ${points}`,
				),
			)
			.returning({ balance: rewardPointsSchema.balance });

		if (!updated) {
			const current = await this.getBalance(userId);
			throw new Error(
				`Insufficient reward points. Available: ${current?.balance ?? 0}, requested: ${points}`,
			);
		}

		await this.db.insert(rewardTransactionsSchema).values({
			userId,
			type: "debit",
			points,
			description,
		});

		return updated.balance;
	}
}
