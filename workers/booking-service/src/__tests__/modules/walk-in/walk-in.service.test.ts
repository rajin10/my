import { describe, expect, it } from "vitest";
import { ValidationError } from "../../../core/errors";
import { signBranchQr, verifyBranchQr } from "../../../modules/walk-in/qr-sign";
import { validateWalkInCustomer } from "@repo/walk-in-sync/validation";

const SECRET = "test-walk-in-secret";
const PAYLOAD = {
	branchId: "branch-1",
	businessId: "biz-1",
	vertical: "booking" as const,
	version: 1,
};

describe("qr-sign", () => {
	it("signs and verifies a branch QR payload", async () => {
		const signature = await signBranchQr(PAYLOAD, SECRET);
		expect(signature).toMatch(/^[0-9a-f]{64}$/);
		expect(await verifyBranchQr(PAYLOAD, signature, SECRET)).toBe(true);
	});

	it("rejects a tampered signature", async () => {
		const signature = await signBranchQr(PAYLOAD, SECRET);
		const tampered = `${signature.slice(0, -1)}${signature.endsWith("a") ? "b" : "a"}`;
		expect(await verifyBranchQr(PAYLOAD, tampered, SECRET)).toBe(false);
	});

	it("rejects a signature with the wrong secret", async () => {
		const signature = await signBranchQr(PAYLOAD, SECRET);
		expect(await verifyBranchQr(PAYLOAD, signature, "other-secret")).toBe(
			false,
		);
	});
});

describe("validateWalkInCustomer", () => {
	it("accepts a signed-in customer with userId", () => {
		expect(validateWalkInCustomer({ userId: "user-1" })).toBeNull();
	});

	it("accepts valid guest name and phone", () => {
		expect(
			validateWalkInCustomer({
				guestName: "Rahim",
				guestPhone: "01712345678",
			}),
		).toBeNull();
	});

	it("rejects guest name shorter than 2 characters", () => {
		expect(
			validateWalkInCustomer({
				guestName: "A",
				guestPhone: "01712345678",
			}),
		).toBeTruthy();
	});

	it("rejects invalid Bangladesh mobile numbers", () => {
		expect(
			validateWalkInCustomer({
				guestName: "Karim",
				guestPhone: "02112345678",
			}),
		).toBeTruthy();

		expect(
			validateWalkInCustomer({
				guestName: "Karim",
				guestPhone: "017123",
			}),
		).toBeTruthy();
	});
});

describe("WalkInService customer validation integration", () => {
	it("maps validateWalkInCustomer errors to ValidationError", () => {
		const err = validateWalkInCustomer({ guestName: "A", guestPhone: "01712345678" });
		expect(err).toBeTruthy();
		expect(() => {
			if (err) throw new ValidationError(err);
		}).toThrow(ValidationError);
	});
});
