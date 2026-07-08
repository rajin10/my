import { describe, expect, it, vi } from "vitest";
import {
	generateSlotCandidates,
	isBranchClosedOnDate,
} from "../../lib/booking-slots";

describe("generateSlotCandidates", () => {
	it("returns no slots when branch is closed", () => {
		const date = "2026-06-08";
		const day = new Date(`${date}T12:00:00`).getDay();
		expect(
			generateSlotCandidates(date, 60, [
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

	it("generates slots within open hours", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-08T00:00:00"));

		const date = "2026-06-08";
		const day = new Date(`${date}T12:00:00`).getDay();
		const slots = generateSlotCandidates(date, 60, [
			{
				id: "1",
				branchId: "b1",
				dayOfWeek: day,
				openTime: "10:00",
				closeTime: "12:00",
				isClosed: false,
			},
		]);

		expect(slots).toEqual(["2026-06-08T10:00:00", "2026-06-08T11:00:00"]);
		vi.useRealTimers();
	});
});

describe("isBranchClosedOnDate", () => {
	it("detects closed days", () => {
		const date = "2026-06-08";
		const day = new Date(`${date}T12:00:00`).getDay();
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
