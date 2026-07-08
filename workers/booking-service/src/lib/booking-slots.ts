import type { BranchHoursSelect } from "@repo/core/src/database/schema";

function timeToMinutes(t: string): number {
	const [h, m] = t.split(":").map(Number);
	return h * 60 + (m ?? 0);
}

/** ISO local datetime without timezone offset. */
export function addMinutes(isoLocal: string, minutes: number): string {
	const dt = new Date(isoLocal.replace("T", " ").replace(/-/g, "/"));
	dt.setMinutes(dt.getMinutes() + minutes);
	return dt.toISOString().slice(0, 19);
}

/** Candidate bookable slots for a calendar day from branch hours (not conflict-filtered). */
export function generateSlotCandidates(
	date: string,
	durationMins: number,
	hours: BranchHoursSelect[],
): string[] {
	const slots: string[] = [];
	const d = new Date(`${date}T12:00:00`);
	const dayOfWeek = d.getDay();

	let openMin = 9 * 60;
	let closeMin = 19 * 60;

	if (hours.length > 0) {
		const dayHours = hours.find((h) => h.dayOfWeek === dayOfWeek);
		if (dayHours?.isClosed) return [];
		if (dayHours?.openTime && dayHours?.closeTime) {
			openMin = timeToMinutes(dayHours.openTime);
			closeMin = timeToMinutes(dayHours.closeTime);
		}
	}

	for (let m = openMin; m + durationMins <= closeMin; m += durationMins) {
		const start = new Date(`${date}T00:00:00`);
		start.setHours(Math.floor(m / 60), m % 60, 0, 0);
		if (start < new Date()) continue;
		const iso = `${date}T${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`;
		slots.push(iso);
	}
	return slots;
}

export function isBranchClosedOnDate(
	date: string,
	hours: BranchHoursSelect[],
): boolean {
	if (!hours.length) return false;
	const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
	return hours.find((h) => h.dayOfWeek === dayOfWeek)?.isClosed ?? false;
}
