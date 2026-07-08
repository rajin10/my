import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleScheduled } from "../handler";

const { MockCouponsRepository, mockExpireOld } = vi.hoisted(() => {
	const mockExpireOld = vi.fn();
	const MockCouponsRepository = vi.fn(function (this: {
		expireOld: typeof mockExpireOld;
	}) {
		this.expireOld = mockExpireOld;
	});
	return { MockCouponsRepository, mockExpireOld };
});

vi.mock("@repo/core/src/database/repositories/coupons.repository", () => ({
	CouponsRepository: MockCouponsRepository,
}));

const TEST_ENV = {} as CloudflareBindings;

function makeController(
	cron: string,
	scheduledTime = 1000,
): ScheduledController {
	return {
		cron,
		scheduledTime,
		noRetry: vi.fn(),
	} as unknown as ScheduledController;
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("handleScheduled", () => {
	it("expires coupons for the midnight cron", async () => {
		mockExpireOld.mockResolvedValue([]);
		const controller = makeController("0 0 * * *", Date.now());
		await handleScheduled(controller, TEST_ENV);
		expect(mockExpireOld).toHaveBeenCalledOnce();
		expect(mockExpireOld).toHaveBeenCalledWith(
			expect.stringMatching(/^\d{4}-/),
		);
	});

	it("does not throw for an unknown cron expression", async () => {
		const controller = makeController("*/5 * * * *");
		await expect(
			handleScheduled(controller, TEST_ENV),
		).resolves.toBeUndefined();
		expect(mockExpireOld).not.toHaveBeenCalled();
	});

	it("passes current scheduledTime as ISO string to expireOld", async () => {
		mockExpireOld.mockResolvedValue([]);
		const scheduledTime = new Date("2026-01-15T00:00:00.000Z").getTime();
		const controller = makeController("0 0 * * *", scheduledTime);
		await handleScheduled(controller, TEST_ENV);
		expect(mockExpireOld).toHaveBeenCalledWith("2026-01-15T00:00:00.000Z");
	});
});
