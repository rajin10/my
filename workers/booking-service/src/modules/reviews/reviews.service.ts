import type { BookingsRepository } from "@repo/core/src/database/repositories/bookings.repository";
import type { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import type { ReviewsRepository } from "@repo/core/src/database/repositories/reviews.repository";
import type { ReviewInsert } from "@repo/core/src/database/schema";
import type { AuthorizationService } from "../../core/authorization";
import {
	ConflictError,
	ForbiddenError,
	NotFoundError,
	ValidationError,
} from "../../core/errors";

export interface SubmitReviewInput {
	bookingId: string;
	rating: number;
	text: string;
}

export class ReviewsService {
	constructor(
		private readonly repo: ReviewsRepository,
		private readonly bookingsRepo: BookingsRepository,
		private readonly branchesRepo: BranchesRepository,
		private readonly authz: AuthorizationService,
	) {}

	listPublished(businessId: string) {
		return this.repo.findPublishedByBusiness(businessId);
	}

	listMine(userId: string) {
		return this.repo.findByUser(userId);
	}

	async listPending(ownerId: string, businessId: string) {
		await this.authz.assertBusinessOwner(ownerId, businessId);
		return this.repo.findPendingByBusiness(businessId);
	}

	async submit(userId: string, input: SubmitReviewInput) {
		if (input.rating < 1 || input.rating > 5)
			throw new ValidationError("Rating must be 1–5");

		const booking = await this.bookingsRepo.findOne(input.bookingId);
		if (!booking.data) throw new NotFoundError("Booking not found");
		if (booking.data.userId !== userId)
			throw new ForbiddenError("You cannot review this booking");
		if (booking.data.status !== "Completed")
			throw new ValidationError("Only completed bookings can be reviewed");

		const branch = await this.branchesRepo.findOne(booking.data.branchId);
		if (!branch.data) throw new NotFoundError("Branch not found");

		const data: ReviewInsert = {
			userId,
			businessId: branch.data.businessId,
			serviceId: booking.data.serviceId,
			bookingId: input.bookingId,
			rating: input.rating,
			text: input.text,
			status: "Pending",
		};

		try {
			const result = await this.repo.create(data);
			// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
			return result.data!;
		} catch (err) {
			if (
				err instanceof Error &&
				err.message.includes("UNIQUE constraint failed") &&
				err.message.includes("booking_id")
			) {
				throw new ConflictError("A review for this booking already exists");
			}
			throw err;
		}
	}

	async approve(ownerId: string, reviewId: string) {
		await this.authz.assertReviewOwner(ownerId, reviewId);
		const updated = await this.repo.updateStatus(reviewId, "Published");
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return updated.data!;
	}

	async reject(ownerId: string, reviewId: string) {
		await this.authz.assertReviewOwner(ownerId, reviewId);
		const deleted = await this.repo.softDelete(reviewId);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return deleted.data!;
	}
}
