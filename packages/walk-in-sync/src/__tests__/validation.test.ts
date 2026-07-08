import { describe, expect, it } from "vitest";
import { validateWalkInCustomer } from "../validation";

describe("validateWalkInCustomer", () => {
	it("accepts signed-in customers", () => {
		expect(validateWalkInCustomer({ userId: "user-1" })).toBeNull();
	});

	it("accepts valid guest details", () => {
		expect(
			validateWalkInCustomer({
				guestName: "Rahim",
				guestPhone: "01712345678",
			}),
		).toBeNull();
	});

	it("rejects short guest names", () => {
		expect(
			validateWalkInCustomer({
				guestName: "A",
				guestPhone: "01712345678",
			}),
		).toBeTruthy();
	});
});
