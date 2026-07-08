import type { BranchHours } from "@repo/api-client";

function timeToMinutes(t: string): number {
	const [h, m] = t.split(":").map(Number);
	return h * 60 + (m ?? 0);
}

/** Bookable ISO slot timestamps for a calendar day, constrained by branch hours. */
export function generateSlots(
	dateIso: string,
	durationMins: number,
	hours?: BranchHours[],
): string[] {
	const slots: string[] = [];
	const d = new Date(dateIso);
	const dayOfWeek = d.getDay();

	let openMin = 9 * 60;
	let closeMin = 19 * 60;

	if (hours && hours.length > 0) {
		const dayHours = hours.find((h) => h.dayOfWeek === dayOfWeek);
		if (dayHours?.isClosed) return [];
		if (dayHours?.openTime && dayHours?.closeTime) {
			openMin = timeToMinutes(dayHours.openTime);
			closeMin = timeToMinutes(dayHours.closeTime);
		}
	}

	for (let m = openMin; m + durationMins <= closeMin; m += durationMins) {
		const start = new Date(d);
		start.setHours(Math.floor(m / 60), m % 60, 0, 0);
		if (start < new Date()) continue;
		slots.push(start.toISOString());
	}
	return slots;
}

export function isBranchClosedOnDate(
	dateIso: string,
	hours?: BranchHours[],
): boolean {
	if (!hours?.length) return false;
	const dayOfWeek = new Date(dateIso).getDay();
	return hours.find((h) => h.dayOfWeek === dayOfWeek)?.isClosed ?? false;
}

export function todayIso(): string {
	return new Date().toLocaleDateString("sv");
}

export function addDaysIso(base: string, days: number): string {
	const [y, mo, d] = base.split("-").map(Number);
	const date = new Date(y, mo - 1, d);
	date.setDate(date.getDate() + days);
	return date.toLocaleDateString("sv");
}

export function formatSlotTime(iso: string): string {
	return new Date(iso).toLocaleTimeString("en-BD", {
		hour: "2-digit",
		minute: "2-digit",
	});
}
