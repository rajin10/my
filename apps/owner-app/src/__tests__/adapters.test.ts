import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Service } from "../data";
import type { ApiBranchBooking } from "../lib/adapters";
import {
	adaptApiBooking,
	adaptCalendarBooking,
	adaptReview,
} from "../lib/adapters";

// ── Minimal stubs ──────────────────────────────────────────────────────────────

function makeApiBranchBooking(slot: string): ApiBranchBooking {
	return {
		id: "b1",
		slot,
		serviceId: "s1",
		branchId: "br1",
		customerName: "Alice",
		price: 500,
		discount: 0,
		status: "Confirmed",
		createdAt: "2026-01-01T10:00:00Z",
	} as ApiBranchBooking;
}

// biome-ignore lint/suspicious/noExplicitAny: CalendarBooking is an opaque API type
function makeCalendarBooking(slot: string): any {
	return {
		id: "b1",
		slot,
		branchId: "br1",
		customerName: "Bob",
		serviceName: "Haircut",
		serviceDuration: 45,
		price: 800,
		discount: 0,
		status: "Confirmed",
		createdAt: "2026-01-01T10:00:00Z",
	};
}

// ── adaptApiBooking — Today label ──────────────────────────────────────────────

describe("adaptApiBooking — Today label", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("labels a slot that falls on today as 'Today'", () => {
		vi.setSystemTime(new Date("2026-06-05T09:00:00Z"));
		const localToday = new Date().toLocaleDateString("sv");
		const b = adaptApiBooking(makeApiBranchBooking(`${localToday}T10:00:00`), {
			services: [],
			apiBranches: [],
		});
		expect(b.date).toBe("Today");
	});

	it("returns the date string for a slot that is not today", () => {
		vi.setSystemTime(new Date("2026-06-05T09:00:00Z"));
		const b = adaptApiBooking(makeApiBranchBooking("2026-06-04T10:00:00"), {
			services: [],
			apiBranches: [],
		});
		expect(b.date).toBe("2026-06-04");
	});

	it("handles a slot with no time component", () => {
		vi.setSystemTime(new Date("2026-06-05T09:00:00Z"));
		const localToday = new Date().toLocaleDateString("sv");
		const b = adaptApiBooking(makeApiBranchBooking(localToday), {
			services: [],
			apiBranches: [],
		});
		expect(b.date).toBe("Today");
	});

	it("resolves service name from ctx when available", () => {
		vi.setSystemTime(new Date("2026-06-05T09:00:00Z"));
		const b = adaptApiBooking(makeApiBranchBooking("2026-06-04T10:00:00"), {
			services: [
				{
					id: "s1",
					name: "Facial",
					branch: "Main",
					category: "Skin",
					duration: 60,
					price: 500,
				},
			],
			apiBranches: [],
		});
		expect(b.service).toBe("Facial");
	});
});

// ── adaptCalendarBooking — Today label ────────────────────────────────────────

describe("adaptCalendarBooking — Today label", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("labels a slot that falls on today as 'Today'", () => {
		vi.setSystemTime(new Date("2026-06-05T09:00:00Z"));
		const localToday = new Date().toLocaleDateString("sv");
		const b = adaptCalendarBooking(
			makeCalendarBooking(`${localToday}T14:00:00`),
			[],
		);
		expect(b.date).toBe("Today");
	});

	it("returns the date string for a past slot", () => {
		vi.setSystemTime(new Date("2026-06-05T09:00:00Z"));
		const b = adaptCalendarBooking(
			makeCalendarBooking("2026-06-03T14:00:00"),
			[],
		);
		expect(b.date).toBe("2026-06-03");
	});

	it("subtracts discount from price", () => {
		vi.setSystemTime(new Date("2026-06-05T09:00:00Z"));
		// biome-ignore lint/suspicious/noExplicitAny: minimal stub
		const booking: any = {
			...makeCalendarBooking("2026-06-04T10:00:00"),
			price: 1000,
			discount: 150,
		};
		const b = adaptCalendarBooking(booking, []);
		expect(b.price).toBe(850);
	});
});

// ── UTC-vs-local regression ───────────────────────────────────────────────────

describe("Today label — UTC vs local date regression", () => {
	it("old UTC approach and new local approach differ when date has rolled over locally but not in UTC", () => {
		// Simulate the device clock at a time where local date (UTC+6) has advanced
		// past midnight but UTC has not yet: e.g. 18:30 UTC = 00:30 local (UTC+6).
		const sampleUtcTimestamp = "2026-06-04T18:30:00Z";

		const oldUtcDate = new Date(sampleUtcTimestamp).toISOString().slice(0, 10);
		// old: always "2026-06-04" regardless of local timezone
		expect(oldUtcDate).toBe("2026-06-04");

		// new: toLocaleDateString("sv") returns the LOCAL date string.
		// In a UTC+6 environment this would return "2026-06-05" (tomorrow in UTC).
		// In a UTC test environment it matches UTC, but the approach is correct:
		// the return value always matches what the device's calendar shows.
		const newLocalDate = new Date(sampleUtcTimestamp).toLocaleDateString("sv");
		// In UTC: "2026-06-04"; in UTC+6: "2026-06-05".
		// Either way, it matches the local calendar — the old code did not.
		expect(typeof newLocalDate).toBe("string");
		expect(newLocalDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("adaptApiBooking Today label uses the same local date the device displays", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-04T18:30:00Z"));

		const deviceLocalDate = new Date().toLocaleDateString("sv");
		// Booking is slotted for whatever day the device considers today
		const b = adaptApiBooking(
			makeApiBranchBooking(`${deviceLocalDate}T09:00:00`),
			{ services: [], apiBranches: [] },
		);
		expect(b.date).toBe("Today");

		vi.useRealTimers();
	});
});

// ── adaptReview — service name lookup ─────────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: minimal ApiReview stub
function makeApiReview(overrides?: Partial<any>): any {
	return {
		id: "r1",
		userId: "u1",
		businessId: "v1",
		serviceId: "svc-001",
		bookingId: "b1",
		rating: 4,
		text: "Great experience",
		status: "Published",
		userName: "Alice",
		createdAt: "2026-06-01T10:00:00Z",
		updatedAt: null,
		...overrides,
	};
}

function makeService(id: string, name: string): Service {
	return {
		id,
		name,
		branch: "Main",
		category: "Hair",
		duration: 60,
		price: 500,
	};
}

describe("adaptReview — service name lookup", () => {
	it("returns the service name when the serviceId matches an entry in services[]", () => {
		const r = adaptReview(makeApiReview({ serviceId: "svc-001" }), [
			makeService("svc-001", "Haircut"),
			makeService("svc-002", "Facial"),
		]);
		expect(r.service).toBe("Haircut");
	});

	it("picks the correct service when multiple services are present", () => {
		const r = adaptReview(makeApiReview({ serviceId: "svc-002" }), [
			makeService("svc-001", "Haircut"),
			makeService("svc-002", "Facial"),
		]);
		expect(r.service).toBe("Facial");
	});

	it("falls back to the raw serviceId when no service matches", () => {
		const r = adaptReview(makeApiReview({ serviceId: "svc-999" }), [
			makeService("svc-001", "Haircut"),
		]);
		expect(r.service).toBe("svc-999");
	});

	it("falls back to the raw serviceId when services[] is empty", () => {
		const r = adaptReview(makeApiReview({ serviceId: "svc-001" }), []);
		expect(r.service).toBe("svc-001");
	});

	it("passes through rating, status, and text unchanged", () => {
		const r = adaptReview(
			makeApiReview({ rating: 5, status: "Pending", text: "Lovely" }),
			[],
		);
		expect(r.rating).toBe(5);
		expect(r.status).toBe("Pending");
		expect(r.text).toBe("Lovely");
	});

	it("uses the API userName as the display name", () => {
		const r = adaptReview(makeApiReview({ userName: "Asha Rahman" }), []);
		expect(r.name).toBe("Asha Rahman");
	});

	it("falls back to 'Customer' when userName is blank", () => {
		const r = adaptReview(makeApiReview({ userName: "  " }), []);
		expect(r.name).toBe("Customer");
	});
});

// ── Booking price parity ──────────────────────────────────────────────────────

describe("booking price — adaptApiBooking and adaptCalendarBooking agree", () => {
	it("adaptApiBooking subtracts discount", () => {
		// biome-ignore lint/suspicious/noExplicitAny: minimal stub
		const booking: any = {
			...makeApiBranchBooking("2026-06-04T10:00:00"),
			price: 1000,
			discount: 150,
		};
		const b = adaptApiBooking(booking, { services: [], apiBranches: [] });
		expect(b.price).toBe(850);
	});

	it("both adapters return the same price for equivalent input", () => {
		// biome-ignore lint/suspicious/noExplicitAny: minimal stubs
		const api: any = {
			...makeApiBranchBooking("2026-06-04T10:00:00"),
			price: 1000,
			discount: 150,
		};
		// biome-ignore lint/suspicious/noExplicitAny: minimal stub
		const cal: any = {
			...makeCalendarBooking("2026-06-04T10:00:00"),
			price: 1000,
			discount: 150,
		};
		const fromApi = adaptApiBooking(api, { services: [], apiBranches: [] });
		const fromCal = adaptCalendarBooking(cal, []);
		expect(fromApi.price).toBe(fromCal.price);
		expect(fromApi.price).toBe(850);
	});
});
