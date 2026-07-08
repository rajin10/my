import type { TeamRepository } from "@repo/core/src/database/repositories/team.repository";
import type { TeamMemberInsert } from "@repo/core/src/database/schema";
import type { AuthorizationService } from "../../core/authorization";
import { ConflictError, NotFoundError } from "../../core/errors";

export class TeamService {
	constructor(
		private readonly repo: TeamRepository,
		private readonly authz: AuthorizationService,
	) {}

	async listByBusiness(ownerId: string, businessId: string) {
		await this.authz.assertBusinessOwner(ownerId, businessId);
		return this.repo.findByBusiness(businessId);
	}

	async get(id: string) {
		const result = await this.repo.findOne(id);
		if (!result.data) throw new NotFoundError("Team member not found");
		return result.data;
	}

	async add(
		ownerId: string,
		businessId: string,
		data: Omit<TeamMemberInsert, "businessId">,
	) {
		await this.authz.assertBusinessOwner(ownerId, businessId);

		const existing = await this.repo.findMembership(data.userId, businessId);
		if (existing)
			throw new ConflictError("User is already a team member of this business");

		const result = await this.repo.create({ ...data, businessId });
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	async update(
		ownerId: string,
		memberId: string,
		data: Partial<Pick<TeamMemberInsert, "title" | "role" | "branchId">>,
	) {
		await this.authz.assertTeamMemberOwner(ownerId, memberId);
		const result = await this.repo.updateOne(memberId, data);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	async remove(ownerId: string, memberId: string) {
		await this.authz.assertTeamMemberOwner(ownerId, memberId);
		const result = await this.repo.deleteOne(memberId);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}
}
