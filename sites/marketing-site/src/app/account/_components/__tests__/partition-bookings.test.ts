import type { Booking } from "@repo/api-client";
import { describe, expect, it } from "vitest";
import { partitionBookings } from "../partition-bookings";

const NOW = new Date("2026-06-08T12:00:00Z");

function booking(over: Partial<Booking>): Booking {
	return {
		id: "b",
		userId: "u1",
		serviceId: "s1",
		branchId: "br1",
		businessId: "v1",
		staffId: null,
		slot: "2026-06-10T10:00:00Z",
		status: "Confirmed",
		price: 100,
		discount: 0,
		couponCode: null,
		createdAt: "2026-06-01T00:00:00Z",
		updatedAt: null,
		...over,
	};
}

describe("partitionBookings", () => {
	it("puts active future bookings (Pending/Confirmed) in upcoming", () => {
		const pending = booking({
			id: "p",
			status: "Pending",
			slot: "2026-06-09T10:00:00Z",
		});
		const confirmed = booking({
			id: "c",
			status: "Confirmed",
			slot: "2026-06-11T10:00:00Z",
		});
		const { upcoming, past } = partitionBookings([pending, confirmed], NOW);
		expect(upcoming.map((b) => b.id)).toEqual(["p", "c"]);
		expect(past).toEqual([]);
	});

	it("puts an elapsed Confirmed booking in past (time wins over status)", () => {
		const elapsed = booking({
			id: "e",
			status: "Confirmed",
			slot: "2026-06-05T10:00:00Z",
		});
		const { upcoming, past } = partitionBookings([elapsed], NOW);
		expect(upcoming).toEqual([]);
		expect(past.map((b) => b.id)).toEqual(["e"]);
	});

	it("puts terminal statuses (Completed/Cancelled) in past regardless of date", () => {
		const completed = booking({
			id: "done",
			status: "Completed",
			slot: "2026-06-04T10:00:00Z",
		});
		const cancelledFuture = booking({
			id: "cx",
			status: "Cancelled",
			slot: "2026-06-20T10:00:00Z",
		});
		const { upcoming, past } = partitionBookings(
			[completed, cancelledFuture],
			NOW,
		);
		expect(upcoming).toEqual([]);
		expect(past.map((b) => b.id).sort()).toEqual(["cx", "done"]);
	});

	it("sorts upcoming soonest-first and past most-recent-first", () => {
		const soon = booking({
			id: "soon",
			status: "Confirmed",
			slot: "2026-06-09T10:00:00Z",
		});
		const later = booking({
			id: "later",
			status: "Confirmed",
			slot: "2026-06-15T10:00:00Z",
		});
		const oldDone = booking({
			id: "old",
			status: "Completed",
			slot: "2026-06-01T10:00:00Z",
		});
		const recentDone = booking({
			id: "recent",
			status: "Completed",
			slot: "2026-06-06T10:00:00Z",
		});
		const { upcoming, past } = partitionBookings(
			[later, soon, oldDone, recentDone],
			NOW,
		);
		expect(upcoming.map((b) => b.id)).toEqual(["soon", "later"]);
		expect(past.map((b) => b.id)).toEqual(["recent", "old"]);
	});
});
