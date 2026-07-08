import type { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import type { BusinessesRepository } from "@repo/core/src/database/repositories/businesses.repository";
import type {
	BranchSelect,
	BusinessSelect,
} from "@repo/core/src/database/schema";
import { ForbiddenError, NotFoundError } from "./errors";

/**
 * Centralizes authorization for shell routes still served by the API gateway
 * (businesses, branches, walk-in, etc.). Booking-vertical checks live in
 * `workers/booking-service`; commerce checks live in `workers/lpg-service`.
 */
export class AuthorizationService {
	constructor(
		private readonly businessesRepo: BusinessesRepository,
		private readonly branchesRepo: BranchesRepository,
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
}
