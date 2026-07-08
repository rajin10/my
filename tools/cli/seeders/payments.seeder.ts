import { paymentsSchema } from "@core/database/schema/payments.schema.ts";
import { faker } from "@faker-js/faker";
import type { DbClient } from "../core/db.ts";
import type { SeedResult } from "./seeder.types.ts";

const CHUNK = 500;

interface PaymentsResult extends SeedResult {
	paymentCount: number;
}

/**
 * Seeds `payments` rows for a subset of `(business, customer)` pairs that
 * have at least one Delivered order (i.e. deliveredTotals is non-zero).
 *
 * For each pair we insert 0–2 rows:
 * - 0 rows   → customer has a full outstanding balance (no payment yet)
 * - 1 partial → amount < total, so some due remains
 * - 2 rows   → clearing payment (Σ == total) OR two partials
 *
 * `recordedBy` is set to the business owner's user id.
 * `orderId` is always null — payments are relationship-level, not per-order.
 */
export async function seedPayments(
	db: DbClient,
	/** `${businessId}:${userId}` → Σ Delivered order totals (from orders seeder). */
	deliveredTotals: Record<string, number>,
	/** businessId → ownerId (from businesses seeder). */
	businessOwnerIds: Record<string, string>,
): Promise<PaymentsResult> {
	const payments = [];

	for (const [key, total] of Object.entries(deliveredTotals)) {
		if (total <= 0) continue;

		const colonIdx = key.indexOf(":");
		const businessId = key.slice(0, colonIdx);
		const userId = key.slice(colonIdx + 1);
		const recordedBy = businessOwnerIds[businessId];
		if (!recordedBy) continue;

		const rowCount = faker.number.int({ min: 0, max: 2 });
		if (rowCount === 0) continue;

		if (rowCount === 1) {
			// Either a partial payment (leaving some due) or a clearing payment.
			const isClearing = faker.datatype.boolean(0.3);
			const amount = isClearing
				? total
				: faker.number.int({ min: 1, max: total - 1 > 0 ? total - 1 : total });
			payments.push({
				id: crypto.randomUUID(),
				businessId,
				userId,
				amount,
				note:
					faker.helpers.maybe(() => faker.finance.transactionDescription(), {
						probability: 0.4,
					}) ?? null,
				recordedBy,
				orderId: null,
				createdAt: faker.date.recent({ days: 30 }).toISOString(),
				updatedAt: new Date().toISOString(),
				deletedAt: null,
			});
		} else {
			// Two partial payments; ensure Σ <= total so balance stays non-negative.
			const first = faker.number.int({
				min: 1,
				max: Math.max(1, Math.floor(total / 2)),
			});
			const maxSecond = total - first;
			if (maxSecond <= 0) continue;
			const second = faker.number.int({ min: 1, max: maxSecond });
			const base = faker.date.recent({ days: 60 });
			for (const amount of [first, second]) {
				payments.push({
					id: crypto.randomUUID(),
					businessId,
					userId,
					amount,
					note:
						faker.helpers.maybe(() => faker.finance.transactionDescription(), {
							probability: 0.3,
						}) ?? null,
					recordedBy,
					orderId: null,
					createdAt: faker.date
						.recent({ days: 30, refDate: base })
						.toISOString(),
					updatedAt: new Date().toISOString(),
					deletedAt: null,
				});
			}
		}
	}

	for (let i = 0; i < payments.length; i += CHUNK) {
		await db
			.insert(paymentsSchema as never)
			.values(payments.slice(i, i + CHUNK));
	}

	return {
		module: "payments",
		inserted: payments.length,
		paymentCount: payments.length,
	};
}
