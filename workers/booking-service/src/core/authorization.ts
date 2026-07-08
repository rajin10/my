import type { BookingsRepository } from "@repo/core/src/database/repositories/bookings.repository";
import type { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import type { BusinessesRepository } from "@repo/core/src/database/repositories/businesses.repository";
import type { CouponsRepository } from "@repo/core/src/database/repositories/coupons.repository";
import type { ReviewsRepository } from "@repo/core/src/database/repositories/reviews.repository";
import type { ServicesRepository } from "@repo/core/src/database/repositories/services.repository";
import type { TeamRepository } from "@repo/core/src/database/repositories/team.repository";
import type {
	BookingSelect,
	BranchSelect,
	BusinessSelect,
	CouponSelect,
	ReviewSelect,
	ServiceSelect,
	TeamMemberSelect,
} from "@repo/core/src/database/schema";
import type { AuthUser } from "../types";
import { ForbiddenError, NotFoundError } from "./errors";

/**
 * Centralizes authorization for booking-vertical routes in booking-service.
 * Shell checks (businesses, branches) live in the API gateway; commerce checks
 * live in `workers/lpg-service`.
 */
export class AuthorizationService {
	constructor(
		private readonly businessesRepo: BusinessesRepository,
		private readonly branchesRepo: BranchesRepository,
		private readonly servicesRepo: ServicesRepository,
		private readonly couponsRepo: CouponsRepository,
		private readonly bookingsRepo: BookingsRepository,
		private readonly teamRepo: TeamRepository,
		private readonly reviewsRepo: ReviewsRepository,
	) {}

	async assertBusinessOwner(
		actorId: string,
		businessId: string,
	): Promise<BusinessSelect> {
		const business = await this.businessesRepo.findOne(businessId);
		if (!business.data) throw new NotFoundError("Business not found");
		if (business.data.ownerId !== actorId) {
			throw new ForbiddenError("You do not own this business");
		}
		return business.data as BusinessSelect;
	}

	async assertBranchAccess(
		actorId: string,
		branchId: string,
		scopedBranchIds: string[] | null,
	): Promise<void> {
		if (scopedBranchIds !== null) {
			if (!scopedBranchIds.includes(branchId)) {
				throw new ForbiddenError("You are not assigned to this branch");
			}
			return;
		}
		const branch = await this.branchesRepo.findOne(branchId);
		if (!branch.data) throw new NotFoundError("Branch not found");
		await this.assertBusinessOwner(actorId, branch.data.businessId);
	}

	async assertBranchOwner(
		actorId: string,
		branchId: string,
	): Promise<BranchSelect> {
		const branch = await this.branchesRepo.findOne(branchId);
		if (!branch.data) throw new NotFoundError("Branch not found");
		await this.assertBusinessOwner(actorId, branch.data.businessId);
		return branch.data as BranchSelect;
	}

	async assertServiceAccess(
		actorId: string,
		serviceId: string,
		scopedBranchIds: string[] | null,
	): Promise<ServiceSelect> {
		const service = await this.servicesRepo.findOne(serviceId);
		if (!service.data) throw new NotFoundError("Service not found");
		await this.assertBranchAccess(
			actorId,
			service.data.branchId,
			scopedBranchIds,
		);
		return service.data as ServiceSelect;
	}

	async assertBookingAccess(
		actorId: string,
		bookingId: string,
		scopedBranchIds: string[] | null,
	): Promise<BookingSelect> {
		const booking = await this.bookingsRepo.findOne(bookingId);
		if (!booking.data) throw new NotFoundError("Booking not found");
		await this.assertBranchAccess(
			actorId,
			booking.data.branchId,
			scopedBranchIds,
		);
		return booking.data as BookingSelect;
	}

	async assertCustomerOwnsBooking(
		userId: string,
		bookingId: string,
	): Promise<BookingSelect> {
		const booking = await this.bookingsRepo.findOne(bookingId);
		if (!booking.data) throw new NotFoundError("Booking not found");
		if (booking.data.userId !== userId) {
			throw new ForbiddenError("You do not own this booking");
		}
		return booking.data as BookingSelect;
	}

	async assertCouponOwner(
		actorId: string,
		couponId: string,
	): Promise<CouponSelect> {
		const coupon = await this.couponsRepo.findOne(couponId);
		if (!coupon.data) throw new NotFoundError("Coupon not found");
		await this.assertBusinessOwner(actorId, coupon.data.businessId);
		return coupon.data as CouponSelect;
	}

	async assertReviewOwner(
		actorId: string,
		reviewId: string,
	): Promise<ReviewSelect> {
		const review = await this.reviewsRepo.findOne(reviewId);
		if (!review.data) throw new NotFoundError("Review not found");
		await this.assertBusinessOwner(actorId, review.data.businessId);
		return review.data as ReviewSelect;
	}

	async assertTeamMemberOwner(
		actorId: string,
		memberId: string,
	): Promise<TeamMemberSelect> {
		const member = await this.teamRepo.findOne(memberId);
		if (!member.data) throw new NotFoundError("Team member not found");
		await this.assertBusinessOwner(actorId, member.data.businessId);
		return member.data as TeamMemberSelect;
	}

	async assertTeamMemberAccess(
		actorId: string,
		memberId: string,
		scopedBranchIds: string[] | null,
	): Promise<TeamMemberSelect> {
		const member = await this.teamRepo.findOne(memberId);
		if (!member.data) throw new NotFoundError("Team member not found");
		if (scopedBranchIds === null) {
			await this.assertBusinessOwner(actorId, member.data.businessId);
		} else if (
			!member.data.branchId ||
			!scopedBranchIds.includes(member.data.branchId)
		) {
			throw new ForbiddenError("Not authorized to access this staff member");
		}
		return member.data as TeamMemberSelect;
	}

	async resolveBranchScope(user: AuthUser): Promise<string[] | null> {
		if (user.role === "owner") {
			return null;
		}
		return this.teamRepo.findBranchIdsByUser(user.id);
	}
}
