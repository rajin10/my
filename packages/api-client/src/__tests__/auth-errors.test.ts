import { describe, expect, it } from "vitest";
import {
	authCallbackErrorParam,
	authLoginErrorMessage,
	authSignInStartErrorMessage,
} from "../auth-errors";
import { ApiError } from "../client";

describe("authLoginErrorMessage", () => {
	it("maps known error codes", () => {
		expect(authLoginErrorMessage("rate_limited")).toContain(
			"Too many sign-in attempts",
		);
		expect(authLoginErrorMessage("oauth_failed")).toContain("Sign-in failed");
		expect(authLoginErrorMessage("missing_params")).toContain("incomplete");
	});

	it("returns empty string for unknown codes", () => {
		expect(authLoginErrorMessage(null)).toBe("");
		expect(authLoginErrorMessage("unknown")).toBe("");
	});
});

describe("authCallbackErrorParam", () => {
	it("maps 429 to rate_limited", () => {
		expect(
			authCallbackErrorParam(
				new ApiError("RATE_LIMITED", "Too many requests", 429),
			),
		).toBe("rate_limited");
	});

	it("maps other failures to oauth_failed", () => {
		expect(authCallbackErrorParam(new Error("network"))).toBe("oauth_failed");
	});
});

describe("authSignInStartErrorMessage", () => {
	it("maps 429 to rate-limited copy", () => {
		expect(
			authSignInStartErrorMessage(
				new ApiError("RATE_LIMITED", "Too many requests", 429),
			),
		).toBe(authLoginErrorMessage("rate_limited"));
	});
});
