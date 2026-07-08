import type { Booking } from "@repo/api-client";

export interface PartitionedBookings {
	upcoming: Booking[];
	past: Booking[];
}

/**
 * Split bookings into Upcoming (still attendable) and Past.
 *
 * - Upcoming = status Pending|Confirmed AND slot in the future ("will I still attend this?").
 * - Past = everything else: terminal statuses (Completed/Cancelled) OR an elapsed slot
 *   regardless of status (so a Confirmed-but-elapsed booking drops to Past).
 *
 * Upcoming is sorted soonest-first; Past most-recent-first.
 */
export function partitionBookings(
	bookings: Booking[],
	now: Date = new Date(),
): PartitionedBookings {
	const nowMs = now.getTime();
	const upcoming: Booking[] = [];
	const past: Booking[] = [];

	for (const b of bookings) {
		const isActive = b.status === "Pending" || b.status === "Confirmed";
		const isFuture = new Date(b.slot).getTime() >= nowMs;
		if (isActive && isFuture) upcoming.push(b);
		else past.push(b);
	}

	upcoming.sort(
		(a, b) => new Date(a.slot).getTime() - new Date(b.slot).getTime(),
	);
	past.sort((a, b) => new Date(b.slot).getTime() - new Date(a.slot).getTime());

	return { upcoming, past };
}
