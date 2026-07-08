import { describe, expect, it } from "vitest";
import {
	defaultWeekSchedule,
	mergeWeekSchedule,
	serializeWeekSchedule,
	validateWeekSchedule,
} from "../lib/schedule";

describe("defaultWeekSchedule", () => {
	it("returns 7 days, Sunday→Saturday", () => {
		const w = defaultWeekSchedule();
		expect(w).toHaveLength(7);
		expect(w.map((d) => d.dayOfWeek)).toEqual([0, 1, 2, 3, 4, 5, 6]);
	});

	it("closes weekends and opens weekdays 09:00–18:00", () => {
		const w = defaultWeekSchedule();
		expect(w[0]?.isClosed).toBe(true); // Sunday
		expect(w[6]?.isClosed).toBe(true); // Saturday
		expect(w[1]?.isClosed).toBe(false);
		expect(w[1]?.openTime).toBe("09:00");
		expect(w[1]?.closeTime).toBe("18:00");
	});
});

describe("mergeWeekSchedule", () => {
	it("returns the default week when rows are undefined", () => {
		expect(mergeWeekSchedule(undefined)).toEqual(defaultWeekSchedule());
	});

	it("always returns exactly 7 days even from sparse input", () => {
		const merged = mergeWeekSchedule([
			{ dayOfWeek: 1, isClosed: false, openTime: "10:00", closeTime: "20:00" },
		]);
		expect(merged).toHaveLength(7);
	});

	it("overlays provided days and fills the rest with defaults", () => {
		const merged = mergeWeekSchedule([
			{ dayOfWeek: 1, isClosed: false, openTime: "10:00", closeTime: "20:00" },
		]);
		expect(merged[1]).toEqual({
			dayOfWeek: 1,
			isClosed: false,
			openTime: "10:00",
			closeTime: "20:00",
		});
		// Sunday untouched → still the default (closed)
		expect(merged[0]?.isClosed).toBe(true);
	});

	it("fills null times with defaults", () => {
		const merged = mergeWeekSchedule([
			{ dayOfWeek: 2, isClosed: false, openTime: null, closeTime: null },
		]);
		expect(merged[2]?.openTime).toBe("09:00");
		expect(merged[2]?.closeTime).toBe("18:00");
	});
});

describe("serializeWeekSchedule", () => {
	it("nulls the times of a closed day", () => {
		const out = serializeWeekSchedule([
			{ dayOfWeek: 0, isClosed: true, openTime: "09:00", closeTime: "18:00" },
		]);
		expect(out[0]).toEqual({
			dayOfWeek: 0,
			isClosed: true,
			openTime: null,
			closeTime: null,
		});
	});

	it("keeps the times of an open day", () => {
		const out = serializeWeekSchedule([
			{ dayOfWeek: 1, isClosed: false, openTime: "10:00", closeTime: "19:00" },
		]);
		expect(out[0]).toEqual({
			dayOfWeek: 1,
			isClosed: false,
			openTime: "10:00",
			closeTime: "19:00",
		});
	});
});

describe("validateWeekSchedule", () => {
	it("returns empty array for a fully valid week", () => {
		expect(validateWeekSchedule(defaultWeekSchedule())).toEqual([]);
	});

	it("flags an open day with a bad format (25:99)", () => {
		const errors = validateWeekSchedule([
			{ dayOfWeek: 1, isClosed: false, openTime: "25:99", closeTime: "18:00" },
		]);
		expect(errors).toHaveLength(1);
		expect(errors[0]?.dayOfWeek).toBe(1);
		expect(errors[0]?.error).toMatch(/HH:MM/);
	});

	it("flags an open day with a non-numeric format (9am)", () => {
		const errors = validateWeekSchedule([
			{ dayOfWeek: 2, isClosed: false, openTime: "9am", closeTime: "18:00" },
		]);
		expect(errors).toHaveLength(1);
		expect(errors[0]?.error).toMatch(/HH:MM/);
	});

	it("flags an open day where open >= close (inverted: 18:00–09:00)", () => {
		const errors = validateWeekSchedule([
			{ dayOfWeek: 3, isClosed: false, openTime: "18:00", closeTime: "09:00" },
		]);
		expect(errors).toHaveLength(1);
		expect(errors[0]?.error).toMatch(/before closing/);
	});

	it("flags an open day where open equals close (09:00–09:00)", () => {
		const errors = validateWeekSchedule([
			{ dayOfWeek: 4, isClosed: false, openTime: "09:00", closeTime: "09:00" },
		]);
		expect(errors).toHaveLength(1);
		expect(errors[0]?.error).toMatch(/before closing/);
	});

	it("flags an open day with empty or whitespace times", () => {
		const errors = validateWeekSchedule([
			{ dayOfWeek: 5, isClosed: false, openTime: "", closeTime: "18:00" },
			{ dayOfWeek: 6, isClosed: false, openTime: " ", closeTime: "18:00" },
		]);
		expect(errors).toHaveLength(2);
		expect(errors.every((e) => /HH:MM/.test(e.error))).toBe(true);
	});

	it("does NOT flag a closed day even with junk times", () => {
		const errors = validateWeekSchedule([
			{ dayOfWeek: 0, isClosed: true, openTime: "JUNK", closeTime: "NOPE" },
		]);
		expect(errors).toEqual([]);
	});

	it("returns one entry per invalid open day when multiple are bad", () => {
		const errors = validateWeekSchedule([
			{ dayOfWeek: 1, isClosed: false, openTime: "25:99", closeTime: "18:00" },
			{ dayOfWeek: 2, isClosed: false, openTime: "18:00", closeTime: "09:00" },
			{ dayOfWeek: 3, isClosed: false, openTime: "09:00", closeTime: "17:00" },
		]);
		expect(errors).toHaveLength(2);
		expect(errors.map((e) => e.dayOfWeek)).toEqual([1, 2]);
	});
});
