// Shared week-schedule model for the working-hours and staff-availability
// editors. The two API surfaces use different field names (openTime/closeTime
// vs startTime/endTime); both are normalised to this common shape at the
// adapter boundary so a single editor can drive them.

export type DaySchedule = {
	dayOfWeek: number;
	isClosed: boolean;
	openTime: string;
	closeTime: string;
};

export const DAYS = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
] as const;

const DEFAULT_OPEN = "09:00";
const DEFAULT_CLOSE = "18:00";

/** A full week with weekends closed and weekdays open 09:00–18:00. */
export function defaultWeekSchedule(): DaySchedule[] {
	return DAYS.map((_, i) => ({
		dayOfWeek: i,
		isClosed: i === 0 || i === 6,
		openTime: DEFAULT_OPEN,
		closeTime: DEFAULT_CLOSE,
	}));
}

type RawDay = {
	dayOfWeek: number;
	isClosed: boolean;
	openTime?: string | null;
	closeTime?: string | null;
};

/**
 * Normalises sparse/partial API rows into a full Sunday→Saturday week, filling
 * missing days and null times with defaults. Always returns exactly 7 days.
 */
export function mergeWeekSchedule(
	rows: ReadonlyArray<RawDay> | undefined,
): DaySchedule[] {
	const base = defaultWeekSchedule();
	if (!rows) return base;
	return base.map((day) => {
		const row = rows.find((r) => r.dayOfWeek === day.dayOfWeek);
		if (!row) return day;
		return {
			dayOfWeek: day.dayOfWeek,
			isClosed: row.isClosed,
			openTime: row.openTime ?? DEFAULT_OPEN,
			closeTime: row.closeTime ?? DEFAULT_CLOSE,
		};
	});
}

export type SerializedDay = {
	dayOfWeek: number;
	isClosed: boolean;
	openTime: string | null;
	closeTime: string | null;
};

/** Serialises for saving: a closed day clears its open/close times. */
export function serializeWeekSchedule(
	schedule: DaySchedule[],
): SerializedDay[] {
	return schedule.map((day) => ({
		dayOfWeek: day.dayOfWeek,
		isClosed: day.isClosed,
		openTime: day.isClosed ? null : day.openTime,
		closeTime: day.isClosed ? null : day.closeTime,
	}));
}

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

function toMinutes(t: string): number {
	const [h, m] = t.split(":").map(Number);
	return (h ?? 0) * 60 + (m ?? 0);
}

export type ScheduleError = { dayOfWeek: number; error: string };

/**
 * Validates open days in a `DaySchedule[]`.
 * Closed days are always considered valid — their times are cleared on
 * serialization by `serializeWeekSchedule`.
 *
 * Returns one entry per invalid open day (empty array means all valid).
 */
export function validateWeekSchedule(schedule: DaySchedule[]): ScheduleError[] {
	const errors: ScheduleError[] = [];
	for (const day of schedule) {
		if (day.isClosed) continue;
		if (!HH_MM.test(day.openTime) || !HH_MM.test(day.closeTime)) {
			errors.push({
				dayOfWeek: day.dayOfWeek,
				error: "Enter times as HH:MM (24-hour).",
			});
		} else if (toMinutes(day.openTime) >= toMinutes(day.closeTime)) {
			errors.push({
				dayOfWeek: day.dayOfWeek,
				error: "Opening time must be before closing time.",
			});
		}
	}
	return errors;
}
