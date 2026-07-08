import { describe, expect, it, vi } from "vitest";
import { generateSlots, isBranchClosedOnDate } from "../lib/booking-slots";

describe("generateSlots with branch hours", () => {
	it("returns empty when branch is closed on that day", () => {
		const date = "2026-06-08"; // Monday
		const day = new Date(date).getDay();
		expect(
			generateSlots(date, 60, [
				{
					id: "1",
					branchId: "b1",
					dayOfWeek: day,
					openTime: "09:00",
					closeTime: "18:00",
					isClosed: true,
				},
			]),
		).toEqual([]);
	});

	it("respects open and close times", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-08T00:00:00"));

		const date = "2026-06-08";
		const day = new Date(date).getDay();
		const slots = generateSlots(date, 60, [
			{
				id: "1",
				branchId: "b1",
				dayOfWeek: day,
				openTime: "10:00",
				closeTime: "12:00",
				isClosed: false,
			},
		]);

		expect(slots.length).toBe(2);
		expect(new Date(slots[0]).getHours()).toBe(10);
		expect(new Date(slots[1]).getHours()).toBe(11);
		vi.useRealTimers();
	});
});

describe("isBranchClosedOnDate", () => {
	it("returns true when hours mark the day closed", () => {
		const date = "2026-06-08";
		const day = new Date(date).getDay();
		expect(
			isBranchClosedOnDate(date, [
				{
					id: "1",
					branchId: "b1",
					dayOfWeek: day,
					openTime: null,
					closeTime: null,
					isClosed: true,
				},
			]),
		).toBe(true);
	});
});
