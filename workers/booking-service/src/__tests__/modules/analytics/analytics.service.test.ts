import { describe, expect, it, vi } from "vitest";
import { AnalyticsService } from "../../../modules/analytics/analytics.service";

const mockRepo = {
	getOverview: vi.fn().mockResolvedValue({ totalRevenue: 1 }),
	getRevenueByDate: vi.fn(),
	getTopServices: vi.fn(),
	getPeakHours: vi.fn(),
	getReviewStats: vi.fn(),
	getCouponStats: vi.fn(),
	getStaffStats: vi.fn(),
	getEarnings: vi.fn(),
};
const mockAuthz = {
	assertBusinessOwner: vi.fn().mockResolvedValue({ id: "b1" }),
};

describe("AnalyticsService.overview", () => {
	it("asserts business ownership then calls repo", async () => {
		const svc = new AnalyticsService(mockRepo as never, mockAuthz as never);
		await svc.overview("owner-1", "b1", 30);
		expect(mockAuthz.assertBusinessOwner).toHaveBeenCalledWith("owner-1", "b1");
		expect(mockRepo.getOverview).toHaveBeenCalled();
	});
});
