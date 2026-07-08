import type { StaffAvailabilityRepository } from "@repo/core/src/database/repositories/staff-availability.repository";
import type { AuthorizationService } from "../../core/authorization";

export type AvailabilitySlotInput = {
	dayOfWeek: number;
	isClosed: boolean;
	startTime?: string | null;
	endTime?: string | null;
};

export class StaffAvailabilityService {
	constructor(
		private readonly repo: StaffAvailabilityRepository,
		private readonly authz: AuthorizationService,
	) {}

	async get(
		actorId: string,
		memberId: string,
		scopedBranchIds: string[] | null,
	) {
		await this.authz.assertTeamMemberAccess(actorId, memberId, scopedBranchIds);
		return this.repo.findByMember(memberId);
	}

	async upsert(
		actorId: string,
		memberId: string,
		slots: AvailabilitySlotInput[],
		scopedBranchIds: string[] | null,
	) {
		await this.authz.assertTeamMemberAccess(actorId, memberId, scopedBranchIds);
		for (const slot of slots) {
			await this.repo.upsertDay({
				teamMemberId: memberId,
				dayOfWeek: slot.dayOfWeek,
				isClosed: slot.isClosed,
				startTime: slot.startTime ?? null,
				endTime: slot.endTime ?? null,
			});
		}
		return this.repo.findByMember(memberId);
	}
}
