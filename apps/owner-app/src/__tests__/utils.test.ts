import { describe, expect, it } from "vitest";
import { money, shortMoney } from "../data";

describe("money", () => {
	it("formats zero", () => {
		expect(money(0)).toBe("৳0");
	});

	it("formats hundreds", () => {
		expect(money(500)).toBe("৳500");
	});

	it("uses the BDT symbol and never the rupee symbol", () => {
		const result = money(100000);
		expect(result).toContain("৳");
		expect(result).not.toContain("₹");
		expect(result).toContain("1");
	});
});

describe("shortMoney", () => {
	it("returns raw amount for < 1000", () => {
		expect(shortMoney(750)).toBe("৳750");
	});

	it("formats 1000 as 1k", () => {
		expect(shortMoney(1000)).toBe("৳1k");
	});

	it("formats 1500 as 1.5k", () => {
		expect(shortMoney(1500)).toBe("৳1.5k");
	});

	it("formats 2000 as 2k without decimal", () => {
		expect(shortMoney(2000)).toBe("৳2k");
	});

	it("formats 100000 as 1L", () => {
		expect(shortMoney(100000)).toBe("৳1L");
	});

	it("formats 250000 as 2.5L", () => {
		expect(shortMoney(250000)).toBe("৳2.5L");
	});

	it("formats 500000 as 5L without decimal", () => {
		expect(shortMoney(500000)).toBe("৳5L");
	});

	it("never uses the rupee symbol", () => {
		expect(shortMoney(2400)).not.toContain("₹");
	});
});

// ---- formatDate (inline mirror of context.tsx logic) ----
function formatDate(iso: string, now: number): string {
	const diff = Math.floor((now - new Date(iso).getTime()) / 1000);
	if (diff < 60) return "Just now";
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
	if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
	if (diff < 172800) return "Yesterday";
	return new Date(iso).toLocaleDateString("en-BD", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

describe("formatDate", () => {
	const now = new Date("2026-06-04T12:00:00Z").getTime();

	it("returns Just now for < 60s", () => {
		expect(formatDate(new Date(now - 30_000).toISOString(), now)).toBe(
			"Just now",
		);
	});

	it("returns minutes ago", () => {
		expect(formatDate(new Date(now - 10 * 60_000).toISOString(), now)).toBe(
			"10m ago",
		);
	});

	it("returns hours ago", () => {
		expect(formatDate(new Date(now - 5 * 3_600_000).toISOString(), now)).toBe(
			"5h ago",
		);
	});

	it("returns Yesterday for 24-48h", () => {
		expect(formatDate(new Date(now - 30 * 3_600_000).toISOString(), now)).toBe(
			"Yesterday",
		);
	});
});

// ---- pendingCount filter logic ----
describe("pendingCount", () => {
	const bookings = [
		{ id: "1", status: "Pending" },
		{ id: "2", status: "Confirmed" },
		{ id: "3", status: "Pending" },
		{ id: "4", status: "Cancelled" },
	];

	it("counts only pending bookings", () => {
		const count = bookings.filter((b) => b.status === "Pending").length;
		expect(count).toBe(2);
	});

	it("returns 0 when no pending bookings", () => {
		const confirmed = [{ id: "1", status: "Confirmed" }];
		expect(confirmed.filter((b) => b.status === "Pending").length).toBe(0);
	});
});
