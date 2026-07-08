import { RewardsService } from "@repo/core/src/modules/rewards/rewards.service";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRepo = {
	getBalance: vi.fn(),
	getHistory: vi.fn(),
	credit: vi.fn(),
};

function makeService() {
	return new RewardsService(mockRepo as never);
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("RewardsService.getBalance", () => {
	it("returns balance when record exists", async () => {
		mockRepo.getBalance.mockResolvedValue({ balance: 250 });
		const svc = makeService();
		const result = await svc.getBalance("user-1");
		expect(result).toEqual({ userId: "user-1", balance: 250 });
	});

	it("returns 0 balance when no record found", async () => {
		mockRepo.getBalance.mockResolvedValue(null);
		const svc = makeService();
		const result = await svc.getBalance("user-1");
		expect(result).toEqual({ userId: "user-1", balance: 0 });
	});
});

describe("RewardsService.getHistory", () => {
	it("delegates to repository", async () => {
		const history = [{ id: "tx-1", type: "credit", points: 50 }];
		mockRepo.getHistory.mockResolvedValue(history);
		const svc = makeService();
		const result = await svc.getHistory("user-1");
		expect(result).toEqual(history);
	});
});

describe("RewardsService.creditForBooking", () => {
	it("credits correct points based on amount paid", async () => {
		mockRepo.credit.mockResolvedValue(undefined);
		const svc = makeService();
		// POINTS_RATE = 10: 1 point per 10 currency units
		await svc.creditForBooking("user-1", "booking-1", 500);
		expect(mockRepo.credit).toHaveBeenCalledWith("user-1", "booking-1", 50);
	});

	it("does not credit when points would be 0", async () => {
		const svc = makeService();
		// 5 / 10 = 0 points → no credit call
		await svc.creditForBooking("user-1", "booking-1", 5);
		expect(mockRepo.credit).not.toHaveBeenCalled();
	});
});
