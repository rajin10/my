import { beforeEach, describe, expect, it, vi } from "vitest";
import { POINTS_RATE } from "../database/repositories/rewards.repository";
import { RewardsService } from "../modules/rewards/rewards.service";

const mockRepo = {
	getBalance: vi.fn(),
	getHistory: vi.fn(),
	credit: vi.fn(),
};

const service = new RewardsService(mockRepo as never);

beforeEach(() => {
	vi.resetAllMocks();
});

describe("RewardsService.getBalance", () => {
	it("returns existing balance", async () => {
		mockRepo.getBalance.mockResolvedValue({ userId: "u-1", balance: 100 });
		const result = await service.getBalance("u-1");
		expect(result).toEqual({ userId: "u-1", balance: 100 });
	});

	it("returns zero balance when no row exists", async () => {
		mockRepo.getBalance.mockResolvedValue(null);
		const result = await service.getBalance("u-1");
		expect(result).toEqual({ userId: "u-1", balance: 0 });
	});
});

describe("RewardsService.creditForBooking", () => {
	it("credits correct points based on amount paid", async () => {
		mockRepo.credit.mockResolvedValue(undefined);
		await service.creditForBooking("u-1", "b-1", POINTS_RATE * 5);
		expect(mockRepo.credit).toHaveBeenCalledWith("u-1", "b-1", 5);
	});

	it("floors fractional points", async () => {
		mockRepo.credit.mockResolvedValue(undefined);
		await service.creditForBooking("u-1", "b-1", POINTS_RATE * 2.9);
		expect(mockRepo.credit).toHaveBeenCalledWith("u-1", "b-1", 2);
	});

	it("skips credit when amount is too small for any points", async () => {
		await service.creditForBooking("u-1", "b-1", POINTS_RATE - 1);
		expect(mockRepo.credit).not.toHaveBeenCalled();
	});

	it("skips credit for zero amount", async () => {
		await service.creditForBooking("u-1", "b-1", 0);
		expect(mockRepo.credit).not.toHaveBeenCalled();
	});

	it("skips credit for negative amount", async () => {
		await service.creditForBooking("u-1", "b-1", -100);
		expect(mockRepo.credit).not.toHaveBeenCalled();
	});
});

describe("RewardsService.getHistory", () => {
	it("delegates to repo", () => {
		const history = [{ id: "tx-1" }];
		mockRepo.getHistory.mockReturnValue(history);
		const result = service.getHistory("u-1");
		expect(result).toBe(history);
		expect(mockRepo.getHistory).toHaveBeenCalledWith("u-1");
	});
});
