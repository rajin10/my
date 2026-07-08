import type { KhataDue } from "@repo/api-client";
import { describe, expect, it } from "vitest";
import { totalOutstanding } from "../data";

const due = (over: Partial<KhataDue>): KhataDue =>
	({ userId: "u", name: "n", due: 0, ...over }) as KhataDue;

describe("totalOutstanding", () => {
	it("sums the due across all customers", () => {
		expect(
			totalOutstanding([
				due({ due: 1500 }),
				due({ due: 1000 }),
				due({ due: 250 }),
			]),
		).toBe(2750);
	});

	it("returns 0 for an empty list", () => {
		expect(totalOutstanding([])).toBe(0);
	});
});
