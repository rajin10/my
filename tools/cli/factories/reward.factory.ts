import type { RewardTransactionSelect } from "@core/database/schema/rewards.schema";
import { faker } from "@faker-js/faker";

export function createRewardTransaction(
	userId: string,
	bookingId: string,
	overrides: Partial<RewardTransactionSelect> = {},
): RewardTransactionSelect {
	const type = faker.helpers.weightedArrayElement([
		{ weight: 8, value: "credit" as const },
		{ weight: 2, value: "debit" as const },
	]);
	const points =
		type === "credit"
			? faker.number.int({ min: 10, max: 200 })
			: faker.number.int({ min: 5, max: 50 });

	return {
		id: crypto.randomUUID(),
		userId,
		bookingId,
		type,
		points,
		description:
			type === "credit"
				? `Earned ${points} reward points for your booking`
				: `Redeemed ${points} reward points`,
		createdAt: faker.date.past({ years: 1 }).toISOString(),
		updatedAt: new Date().toISOString(),
		deletedAt: null,
		...overrides,
	};
}
