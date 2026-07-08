import {
	rewardPointsSchema,
	rewardTransactionsSchema,
} from "@core/database/schema/rewards.schema.ts";
import type { DbClient } from "../core/db.ts";
import { createRewardTransaction } from "../factories/reward.factory.ts";
import type { BookingRef, SeedResult } from "./seeder.types.ts";

const CHUNK = 500;

export async function seedRewards(
	db: DbClient,
	allUserIds: string[],
	bookingRefs: BookingRef[],
): Promise<SeedResult> {
	const completedBookings = bookingRefs.filter((b) => b.status === "Completed");

	const transactions = completedBookings.map((ref) =>
		createRewardTransaction(ref.userId, ref.bookingId),
	);

	for (let i = 0; i < transactions.length; i += CHUNK) {
		await db
			.insert(rewardTransactionsSchema as never)
			.values(transactions.slice(i, i + CHUNK));
	}

	// Compute running balance per user from the transactions we just created
	const balanceByUser: Record<string, number> = {};
	for (const tx of transactions) {
		balanceByUser[tx.userId] =
			(balanceByUser[tx.userId] ?? 0) +
			(tx.type === "credit" ? tx.points : -tx.points);
	}

	// One reward_points row per user (unique constraint on user_id)
	const now = new Date().toISOString();
	const rewardPoints = allUserIds.map((userId) => ({
		id: crypto.randomUUID(),
		userId,
		balance: Math.max(0, balanceByUser[userId] ?? 0),
		createdAt: now,
		updatedAt: now,
		deletedAt: null,
	}));

	for (let i = 0; i < rewardPoints.length; i += CHUNK) {
		await db
			.insert(rewardPointsSchema as never)
			.values(rewardPoints.slice(i, i + CHUNK));
	}

	return {
		module: "rewards",
		inserted: transactions.length + rewardPoints.length,
	};
}
