import { reviewsSchema } from "@core/database/schema/reviews.schema.ts";
import { faker } from "@faker-js/faker";
import type { DbClient } from "../core/db.ts";
import { createReview } from "../factories/review.factory.ts";
import type { BookingRef, SeedResult } from "./seeder.types.ts";

const CHUNK = 500;

export async function seedReviews(
	db: DbClient,
	bookingRefs: BookingRef[],
): Promise<SeedResult> {
	const reviews = bookingRefs
		.filter((b) => b.status === "Completed" && faker.datatype.boolean(0.6))
		.map((ref) =>
			createReview(ref.userId, ref.businessId, ref.serviceId, ref.bookingId),
		);

	for (let i = 0; i < reviews.length; i += CHUNK) {
		await db.insert(reviewsSchema as never).values(reviews.slice(i, i + CHUNK));
	}

	return { module: "reviews", inserted: reviews.length };
}
