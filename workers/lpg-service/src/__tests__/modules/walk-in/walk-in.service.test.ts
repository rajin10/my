import { describe, expect, it } from "vitest";
import { signBranchQr, verifyBranchQr } from "../../../modules/walk-in/qr-sign";
import { validateWalkInCustomer } from "@repo/walk-in-sync/validation";

const SECRET = "test-walk-in-secret";
const PAYLOAD = {
	branchId: "branch-1",
	businessId: "biz-1",
	vertical: "commerce" as const,
	version: 1,
};

describe("qr-sign", () => {
	it("signs and verifies a commerce branch QR payload", async () => {
		const signature = await signBranchQr(PAYLOAD, SECRET);
		expect(signature).toMatch(/^[0-9a-f]{64}$/);
		expect(await verifyBranchQr(PAYLOAD, signature, SECRET)).toBe(true);
	});
});

describe("validateWalkInCustomer", () => {
	it("accepts valid guest details for commerce walk-in", () => {
		expect(
			validateWalkInCustomer({
				guestName: "Karim",
				guestPhone: "01812345678",
			}),
		).toBeNull();
	});
});
