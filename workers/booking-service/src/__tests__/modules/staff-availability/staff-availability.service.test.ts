import { describe, expect, it, vi } from "vitest";
import { StaffAvailabilityService } from "../../../modules/staff-availability/staff-availability.service";

const mockRepo = {
	findByMember: vi.fn().mockResolvedValue([]),
	upsertDay: vi.fn(),
};
const mockAuthz = {
	assertTeamMemberAccess: vi.fn().mockResolvedValue({ id: "member-1" }),
};

describe("StaffAvailabilityService.get", () => {
	it("calls assertTeamMemberAccess then findByMember", async () => {
		const svc = new StaffAvailabilityService(
			mockRepo as never,
			mockAuthz as never,
		);
		await svc.get("owner-1", "member-1", null);
		expect(mockAuthz.assertTeamMemberAccess).toHaveBeenCalledWith(
			"owner-1",
			"member-1",
			null,
		);
		expect(mockRepo.findByMember).toHaveBeenCalledWith("member-1");
	});
});
