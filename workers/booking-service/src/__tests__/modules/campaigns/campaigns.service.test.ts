import { beforeEach, describe, expect, it, vi } from "vitest";
import { CampaignsService } from "../../../modules/campaigns/campaigns.service";

const mockRepo = {
	findByBusiness: vi.fn(),
	findOne: vi.fn(),
	create: vi.fn(),
	updateOne: vi.fn(),
	deleteOne: vi.fn(),
};
const mockCustomers = {
	listByBusiness: vi.fn(),
	getCustomerVisits: vi.fn(),
};
const mockAuthz = {
	assertBusinessOwner: vi.fn().mockResolvedValue({ id: "b1" }),
};

describe("CampaignsService.send", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mockAuthz.assertBusinessOwner.mockResolvedValue({ id: "b1" });
	});

	it("marks campaign Sent with recipient count for segment", async () => {
		mockRepo.findOne.mockResolvedValue({
			id: "c1",
			businessId: "b1",
			segment: "VIP",
			status: "Draft",
		});
		mockCustomers.listByBusiness.mockResolvedValue([
			{ tier: "VIP" },
			{ tier: "Regular" },
		]);
		mockRepo.updateOne.mockResolvedValue({
			data: { id: "c1", status: "Sent", recipientCount: 1 },
		});
		const svc = new CampaignsService(
			mockRepo as never,
			mockCustomers as never,
			mockAuthz as never,
		);
		const result = await svc.send("owner-1", "c1", "b1");
		expect(result.recipientCount).toBe(1);
	});
});
