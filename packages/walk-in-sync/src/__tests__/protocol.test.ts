import { describe, expect, it } from "vitest";
import { walkInSubmitSchema } from "../protocol";

describe("walkInSubmitSchema", () => {
	it("accepts a valid booking submission", () => {
		const parsed = walkInSubmitSchema.parse({
			localId: "abc-123",
			branchId: "branch-1",
			vertical: "booking",
			customer: { guestName: "Sam", guestPhone: "01712345678" },
			booking: { serviceId: "svc-1", slot: "2026-06-12T11:00:00" },
			total: 50000,
			submittedAt: Date.now(),
		});
		expect(parsed.vertical).toBe("booking");
	});

	it("rejects empty localId", () => {
		expect(() =>
			walkInSubmitSchema.parse({
				localId: "",
				branchId: "b",
				vertical: "booking",
				customer: {},
				total: 0,
				submittedAt: 1,
			}),
		).toThrow();
	});
});
