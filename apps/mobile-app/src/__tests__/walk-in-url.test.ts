import { describe, expect, it } from "vitest";
import { parseWalkInUrl, walkInRouteParams } from "../lib/walk-in-url";

describe("parseWalkInUrl", () => {
	it("parses universal branch QR with signature", () => {
		expect(
			parseWalkInUrl("https://talash.app/w/branch-abc?sig=signed-token"),
		).toEqual({
			branchId: "branch-abc",
			signature: "signed-token",
		});
	});

	it("parses universal session QR", () => {
		expect(
			parseWalkInUrl("https://talash.app/w/branch-abc?s=session-123"),
		).toEqual({
			branchId: "branch-abc",
			session: "session-123",
		});
	});

	it("parses app deep link with session", () => {
		expect(
			parseWalkInUrl(
				"mobileapp://walk-in?branchId=branch-abc&session=session-123",
			),
		).toEqual({
			branchId: "branch-abc",
			session: "session-123",
		});
	});

	it("parses app deep link with signature", () => {
		expect(
			parseWalkInUrl(
				"mobileapp://walk-in?branchId=branch-abc&signature=signed-token",
			),
		).toEqual({
			branchId: "branch-abc",
			signature: "signed-token",
		});
	});

	it("returns null for unrelated URLs", () => {
		expect(parseWalkInUrl("https://example.com/w/abc")).toBeNull();
		expect(parseWalkInUrl("mobileapp://auth/callback")).toBeNull();
	});
});

describe("walkInRouteParams", () => {
	it("maps params for expo-router", () => {
		expect(
			walkInRouteParams({
				branchId: "b1",
				session: "s1",
				signature: "sig1",
			}),
		).toEqual({
			branchId: "b1",
			session: "s1",
			signature: "sig1",
		});
	});
});
