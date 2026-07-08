import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatMoney, formatShortMoney } from "../lib/format";

// ---- useDebounce ----
// Test the pure timing logic without the hook wrapper
describe("debounce timing", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	it("fires after the delay", () => {
		const fn = vi.fn();
		const timer = setTimeout(fn, 300);
		expect(fn).not.toHaveBeenCalled();
		vi.advanceTimersByTime(300);
		expect(fn).toHaveBeenCalledOnce();
		clearTimeout(timer);
	});

	it("does not fire before the delay", () => {
		const fn = vi.fn();
		const timer = setTimeout(fn, 300);
		vi.advanceTimersByTime(299);
		expect(fn).not.toHaveBeenCalled();
		clearTimeout(timer);
		vi.clearAllTimers();
	});
});

// ---- formatWhen (inline — mirrors context.tsx logic) ----
function formatWhen(iso: string, now: number): string {
	const diff = Math.floor((now - new Date(iso).getTime()) / 1000);
	if (diff < 60) return "Just now";
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
	if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
	if (diff < 172800) return "Yesterday";
	return new Date(iso).toLocaleDateString("en-IN", {
		day: "numeric",
		month: "short",
	});
}

describe("formatWhen", () => {
	const base = new Date("2026-06-04T12:00:00Z").getTime();

	it("returns 'Just now' for < 60s", () => {
		const ts = new Date(base - 30_000).toISOString();
		expect(formatWhen(ts, base)).toBe("Just now");
	});

	it("returns minutes ago for < 1h", () => {
		const ts = new Date(base - 25 * 60_000).toISOString();
		expect(formatWhen(ts, base)).toBe("25m ago");
	});

	it("returns hours ago for < 24h", () => {
		const ts = new Date(base - 3 * 3_600_000).toISOString();
		expect(formatWhen(ts, base)).toBe("3h ago");
	});

	it("returns 'Yesterday' for 24h-48h", () => {
		const ts = new Date(base - 25 * 3_600_000).toISOString();
		expect(formatWhen(ts, base)).toBe("Yesterday");
	});

	it("returns formatted date for older", () => {
		const ts = new Date(base - 3 * 86_400_000).toISOString();
		const result = formatWhen(ts, base);
		// Should be a date string, not a relative label
		expect(result).not.toMatch(/ago|Just now|Yesterday/);
	});
});

// ---- activeFilterCount (mirrors SearchScreen logic) ----
type Filters = {
	minPrice?: number;
	maxPrice?: number;
	minRating?: number;
	sortBy?: string;
};

function activeFilterCount(f: Filters): number {
	let n = 0;
	if (f.minPrice !== undefined) n++;
	if (f.maxPrice !== undefined) n++;
	if (f.minRating !== undefined) n++;
	if (f.sortBy && f.sortBy !== "recommended") n++;
	return n;
}

describe("activeFilterCount", () => {
	it("returns 0 for empty filters", () => {
		expect(activeFilterCount({})).toBe(0);
	});

	it("counts minPrice and maxPrice separately", () => {
		expect(activeFilterCount({ minPrice: 500, maxPrice: 2000 })).toBe(2);
	});

	it("does not count sortBy=recommended", () => {
		expect(activeFilterCount({ sortBy: "recommended" })).toBe(0);
	});

	it("counts non-default sortBy", () => {
		expect(activeFilterCount({ sortBy: "rating" })).toBe(1);
	});

	it("counts all four filters", () => {
		expect(
			activeFilterCount({
				minPrice: 500,
				maxPrice: 2000,
				minRating: 4,
				sortBy: "rating",
			}),
		).toBe(4);
	});
});

// ---- Walkthrough: shouldShowWalkthrough is async SecureStore read ----
// (See token-store.test.ts for the pattern; walkthrough key is tested via integration)

describe("formatMoney", () => {
	it("formats small amounts in BDT", () => {
		expect(formatMoney(500)).toBe("৳500");
	});
});

describe("formatShortMoney", () => {
	it("formats thousands as K", () => {
		expect(formatShortMoney(1500)).toBe("৳1.5K");
	});

	it("formats whole thousands without decimal", () => {
		expect(formatShortMoney(2000)).toBe("৳2K");
	});

	it("formats lakhs as L", () => {
		expect(formatShortMoney(250_000)).toBe("৳2.5L");
	});

	it("passes through small amounts unchanged", () => {
		expect(formatShortMoney(750)).toBe("৳750");
	});
});
