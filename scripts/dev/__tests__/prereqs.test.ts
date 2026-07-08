// scripts/dev/__tests__/prereqs.test.ts
import { describe, expect, test } from "bun:test";
import { meetsMinimum, parseVersion } from "../prereqs.ts";

describe("prereqs", () => {
	test("meetsMinimum compares semver tuples", () => {
		expect(meetsMinimum(parseVersion("1.3.1"), parseVersion("1.3.0"))).toBe(
			true,
		);
		expect(meetsMinimum(parseVersion("1.2.9"), parseVersion("1.3.0"))).toBe(
			false,
		);
	});
});
