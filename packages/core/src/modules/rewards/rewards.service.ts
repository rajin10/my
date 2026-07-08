import {
	POINTS_RATE,
	type RewardsRepository,
} from "../../database/repositories/rewards.repository";

export class RewardsService {
	constructor(private readonly repo: RewardsRepository) {}

	async getBalance(userId: string) {
		const row = await this.repo.getBalance(userId);
		return { userId, balance: row?.balance ?? 0 };
	}

	getHistory(userId: string) {
		return this.repo.getHistory(userId);
	}

	/**
	 * Credit rewards for a completed booking.
	 * Called from the queue consumer — receives raw env deps, not service context.
	 */
	async creditForBooking(
		userId: string,
		bookingId: string,
		amountPaid: number,
	): Promise<void> {
		const points = Math.floor(amountPaid / POINTS_RATE);
		if (points <= 0) return;
		await this.repo.credit(userId, bookingId, points);
	}

	/**
	 * Redeem (debit) points. Throws if balance is insufficient.
	 */
	async redeem(
		userId: string,
		points: number,
		description: string,
	): Promise<{ newBalance: number }> {
		if (points <= 0) throw new Error("Points must be positive");
		const newBalance = await this.repo.debit(userId, points, description);
		return { newBalance };
	}
}
