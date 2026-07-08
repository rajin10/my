import { describe, expect, it } from "vitest";
import { validateCoupon } from "../data";

describe("validateCoupon", () => {
	it("rejects an empty code", () => {
		const r = validateCoupon({ code: "  ", type: "Percentage", value: 20 });
		expect(r.ok).toBe(false);
	});

	it("rejects a missing value (NaN)", () => {
		const r = validateCoupon({
			code: "WELCOME",
			type: "Percentage",
			value: Number.NaN,
		});
		expect(r.ok).toBe(false);
	});

	describe("Percentage", () => {
		it("accepts 1 and 100 (inclusive bounds)", () => {
			expect(
				validateCoupon({ code: "A", type: "Percentage", value: 1 }).ok,
			).toBe(true);
			expect(
				validateCoupon({ code: "A", type: "Percentage", value: 100 }).ok,
			).toBe(true);
		});

		it("rejects 0%", () => {
			expect(
				validateCoupon({ code: "A", type: "Percentage", value: 0 }).ok,
			).toBe(false);
		});

		it("rejects above 100%", () => {
			expect(
				validateCoupon({ code: "A", type: "Percentage", value: 101 }).ok,
			).toBe(false);
			expect(
				validateCoupon({ code: "A", type: "Percentage", value: 150 }).ok,
			).toBe(false);
		});

		it("rejects a non-integer percentage", () => {
			expect(
				validateCoupon({ code: "A", type: "Percentage", value: 12.5 }).ok,
			).toBe(false);
		});
	});

	describe("Fixed", () => {
		it("accepts a positive amount", () => {
			expect(validateCoupon({ code: "A", type: "Fixed", value: 1 }).ok).toBe(
				true,
			);
			expect(validateCoupon({ code: "A", type: "Fixed", value: 500 }).ok).toBe(
				true,
			);
		});

		it("rejects a ৳0 fixed discount", () => {
			expect(validateCoupon({ code: "A", type: "Fixed", value: 0 }).ok).toBe(
				false,
			);
		});

		it("allows amounts above 100 (no percentage cap applies)", () => {
			expect(validateCoupon({ code: "A", type: "Fixed", value: 5000 }).ok).toBe(
				true,
			);
		});
	});

	it("returns an error message when invalid", () => {
		const r = validateCoupon({ code: "A", type: "Percentage", value: 0 });
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error).toMatch(/1 to 100/);
	});

	describe("max uses", () => {
		it("accepts a draft with no max (undefined)", () => {
			expect(
				validateCoupon({ code: "A", type: "Percentage", value: 20 }).ok,
			).toBe(true);
		});

		it("accepts max = 1", () => {
			expect(
				validateCoupon({ code: "A", type: "Percentage", value: 20, max: 1 }).ok,
			).toBe(true);
		});

		it("rejects max = 0", () => {
			const r = validateCoupon({
				code: "A",
				type: "Percentage",
				value: 20,
				max: 0,
			});
			expect(r.ok).toBe(false);
			if (!r.ok) expect(r.error).toMatch(/at least 1/);
		});

		it("rejects a negative max", () => {
			expect(
				validateCoupon({ code: "A", type: "Percentage", value: 20, max: -5 })
					.ok,
			).toBe(false);
		});

		it("rejects a non-integer max like 1.5", () => {
			expect(
				validateCoupon({ code: "A", type: "Percentage", value: 20, max: 1.5 })
					.ok,
			).toBe(false);
		});

		it("accepts a fully-valid draft with a valid max", () => {
			expect(
				validateCoupon({
					code: "SAVE20",
					type: "Percentage",
					value: 20,
					max: 50,
				}).ok,
			).toBe(true);
		});
	});
});
