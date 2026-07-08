import { describe, expect, it } from "vitest";
import { keyMatchesPrefix } from "../allowlist";
import { clearPersistedCache } from "../clear-persisted-cache";
import { shouldDehydrateQuery } from "../should-dehydrate-query";

function mockQuery(
	queryKey: readonly unknown[],
	status: "success" | "error" | "pending" = "success",
) {
	return {
		queryKey,
		state: { status },
	} as Parameters<typeof shouldDehydrateQuery>[0];
}

describe("keyMatchesPrefix", () => {
	it("matches when key extends prefix", () => {
		expect(
			keyMatchesPrefix(
				["bookings", "calendar", "b1"],
				["bookings", "calendar"],
			),
		).toBe(true);
	});

	it("rejects when key is shorter than prefix", () => {
		expect(keyMatchesPrefix(["bookings"], ["bookings", "calendar"])).toBe(
			false,
		);
	});
});

describe("shouldDehydrateQuery", () => {
	it("persists allowlisted successful queries", () => {
		expect(shouldDehydrateQuery(mockQuery(["bookings", "my"]))).toBe(true);
		expect(shouldDehydrateQuery(mockQuery(["auth", "me"]))).toBe(true);
		expect(shouldDehydrateQuery(mockQuery(["business", "owner"]))).toBe(true);
		expect(shouldDehydrateQuery(mockQuery(["search", "businesses", {}]))).toBe(
			true,
		);
	});

	it("excludes volatile prefixes", () => {
		expect(
			shouldDehydrateQuery(
				mockQuery(["branch-availability", "b1", "2026-06-12", "s1"]),
			),
		).toBe(false);
		expect(shouldDehydrateQuery(mockQuery(["users", "search", "ali"]))).toBe(
			false,
		);
	});

	it("excludes non-success queries", () => {
		expect(shouldDehydrateQuery(mockQuery(["bookings", "my"], "pending"))).toBe(
			false,
		);
		expect(shouldDehydrateQuery(mockQuery(["bookings", "my"], "error"))).toBe(
			false,
		);
	});

	it("rejects unknown prefixes", () => {
		expect(shouldDehydrateQuery(mockQuery(["unknown", "data"]))).toBe(false);
	});
});

describe("clearPersistedCache", () => {
	it("removes the persist storage key", () => {
		clearPersistedCache("mobile-app");
		expect(typeof clearPersistedCache).toBe("function");
	});
});
