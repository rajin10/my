import { afterEach, describe, expect, it, vi } from "vitest";
import {
	adaptBooking,
	adaptCoupon,
	adaptReview,
	formatDate,
} from "../lib/adapters";

afterEach(() => {
	vi.useRealTimers();
});

describe("formatDate", () => {
	it('returns "Just now" for timestamps less than a minute ago', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T12:00:30Z"));
		expect(formatDate("2026-01-01T12:00:00Z")).toBe("Just now");
	});

	it("returns minutes ago for timestamps less than an hour ago", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T12:30:00Z"));
		expect(formatDate("2026-01-01T12:00:00Z")).toBe("30 min ago");
	});

	it("returns hours ago for timestamps less than a day ago", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T15:00:00Z"));
		expect(formatDate("2026-01-01T12:00:00Z")).toBe("3 hr ago");
	});

	it('returns "Yesterday" for timestamps between 1 and 2 days ago', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-02T13:00:00Z"));
		expect(formatDate("2026-01-01T12:00:00Z")).toBe("Yesterday");
	});

	it("returns formatted date for older timestamps", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-10T00:00:00Z"));
		const result = formatDate("2026-01-01T00:00:00Z");
		expect(result).toMatch(/Jan/);
	});
});

describe("adaptBooking", () => {
	const apiBooking = {
		id: "b-1",
		serviceId: "s-1",
		branchId: "br-1",
		userId: "u-1",
		slot: "2026-06-01T10:00:00.000Z",
		price: 500,
		discount: 0,
		status: "confirmed",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		businessId: "v-1",
		notes: null,
		cancelledAt: null,
		deletedAt: null,
	};

	it("resolves service name from services list", () => {
		const services = [{ id: "s-1", name: "Hair Cut", duration: 30 }] as never[];
		const branches = [{ id: "br-1", name: "Main Branch" }] as never[];
		const booking = adaptBooking(apiBooking as never, services, branches);
		expect(booking.service).toBe("Hair Cut");
		expect(booking.branch).toBe("Main Branch");
	});

	it("falls back to IDs when service or branch is not in the list", () => {
		const booking = adaptBooking(apiBooking as never, [], []);
		expect(booking.service).toBe("s-1");
		expect(booking.branch).toBe("br-1");
	});

	it("maps price correctly", () => {
		const booking = adaptBooking(apiBooking as never, [], []);
		expect(booking.price).toBe(500);
	});
});

describe("adaptReview", () => {
	it("maps rating and status", () => {
		const apiReview = {
			id: "r-1",
			serviceId: "s-1",
			rating: 4,
			status: "published",
			text: "Great!",
			createdAt: new Date().toISOString(),
			userId: "u-1",
			businessId: "v-1",
			branchId: "br-1",
			updatedAt: new Date().toISOString(),
			deletedAt: null,
		};
		const review = adaptReview(apiReview as never);
		expect(review.rating).toBe(4);
		expect(review.status).toBe("published");
		expect(review.text).toBe("Great!");
	});
});

describe("adaptCoupon", () => {
	it("maps code, type, and value", () => {
		const apiCoupon = {
			id: "c-1",
			code: "SAVE10",
			type: "percent",
			value: 10,
			usedCount: 5,
			maxUses: 100,
			status: "active",
			expiresAt: "2026-12-31T00:00:00.000Z",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			businessId: "v-1",
			deletedAt: null,
		};
		const coupon = adaptCoupon(apiCoupon as never);
		expect(coupon.code).toBe("SAVE10");
		expect(coupon.type).toBe("percent");
		expect(coupon.value).toBe(10);
		expect(coupon.used).toBe(5);
	});
});
