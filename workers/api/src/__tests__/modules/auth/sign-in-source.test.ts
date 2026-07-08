import { UserRole } from "@repo/core/src/database/schema";
import { describe, expect, it } from "vitest";
import {
	roleForSource,
	SIGN_IN_SOURCES,
	SignInSource,
} from "../../../modules/auth/sign-in-source";

describe("roleForSource", () => {
	it("maps customer-facing sources to the user role", () => {
		expect(roleForSource(SignInSource.MARKETING_SITE)).toBe(UserRole.USER);
		expect(roleForSource(SignInSource.MOBILE_APP)).toBe(UserRole.USER);
	});

	it("maps the business app to the owner role", () => {
		expect(roleForSource(SignInSource.BUSINESS_APP)).toBe(UserRole.OWNER);
	});

	it("defaults to the user role when no source is supplied", () => {
		expect(roleForSource()).toBe(UserRole.USER);
		expect(roleForSource(undefined)).toBe(UserRole.USER);
	});

	// Runtime backstop for the compile-time `SelfServiceRole` constraint on
	// SOURCE_ROLE_MAP: no source may ever mint a privileged role (ADR 0002). If this
	// fails, client-declared `source` has become a privilege-escalation vector.
	it("never grants a privileged role — every source maps to user or owner", () => {
		const selfService: UserRole[] = [UserRole.USER, UserRole.OWNER];
		for (const source of SIGN_IN_SOURCES) {
			expect(selfService).toContain(roleForSource(source));
		}
	});
});
