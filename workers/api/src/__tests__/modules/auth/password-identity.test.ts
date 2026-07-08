import { describe, expect, it } from "vitest";
import { ValidationError } from "../../../core/errors";
import { PasswordIdentity } from "../../../modules/auth/password-identity";

describe("PasswordIdentity", () => {
	const identity = new PasswordIdentity();

	it("hashes and verifies a password", async () => {
		const stored = await identity.hash("password123");
		expect(stored.startsWith("pbkdf2:100000:")).toBe(true);
		expect(await identity.verify("password123", stored)).toBe(true);
	});

	it("rejects a wrong password", async () => {
		const stored = await identity.hash("password123");
		expect(await identity.verify("wrong-password", stored)).toBe(false);
	});

	it("rejects malformed stored hashes", async () => {
		expect(await identity.verify("password123", "not-a-hash")).toBe(false);
	});

	it("throws when password is too short", () => {
		expect(() => identity.validatePolicy("short")).toThrow(ValidationError);
	});

	it("accepts an 8-character password", () => {
		expect(() => identity.validatePolicy("12345678")).not.toThrow();
	});
});
