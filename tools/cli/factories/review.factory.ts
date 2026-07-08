import type { ReviewSelect } from "@core/database/schema/reviews.schema";
import { faker } from "@faker-js/faker";

const REVIEW_TEXT: Record<"high" | "mid" | "low", string[]> = {
	high: [
		"Absolutely loved the service! Will definitely come back.",
		"Excellent work, very professional staff. Highly recommended.",
		"Amazing experience, worth every taka. The team is so talented.",
		"Outstanding service and a relaxing ambiance. 10/10!",
		"Best salon in the city! My go-to place from now on.",
		"The staff were incredibly skilled and made me feel pampered.",
	],
	mid: [
		"Good service overall, minor wait time but acceptable.",
		"Decent experience, staff was helpful and friendly.",
		"Satisfied with the visit. Could be a bit better but overall fine.",
		"Service was okay, nothing exceptional but got the job done.",
	],
	low: [
		"Long wait time and mediocre results. Expected better.",
		"Not happy with the outcome. Won't be returning.",
		"Overpriced for the quality of service provided.",
		"Staff seemed rushed. The result was not what I asked for.",
	],
};

export function createReview(
	userId: string,
	businessId: string,
	serviceId: string,
	bookingId: string,
	overrides: Partial<ReviewSelect> = {},
): ReviewSelect {
	const rating = faker.helpers.weightedArrayElement([
		{ weight: 5, value: 5 },
		{ weight: 4, value: 4 },
		{ weight: 2, value: 3 },
		{ weight: 1, value: 2 },
		{ weight: 1, value: 1 },
	]);

	const tier = rating >= 4 ? "high" : rating === 3 ? "mid" : "low";

	return {
		id: crypto.randomUUID(),
		userId,
		businessId,
		serviceId,
		bookingId,
		rating,
		text: faker.helpers.arrayElement(REVIEW_TEXT[tier]),
		status: faker.helpers.weightedArrayElement([
			{ weight: 8, value: "Published" as const },
			{ weight: 2, value: "Pending" as const },
		]),
		createdAt: faker.date.past({ years: 1 }).toISOString(),
		updatedAt: new Date().toISOString(),
		deletedAt: null,
		...overrides,
	};
}
