import { describe, expect, test } from "bun:test";
import {
	bumpSemver,
	compareSemver,
	maxSemver,
	parseSemver,
} from "../core/semver.ts";

describe("parseSemver", () => {
	test("parses valid versions", () => {
		expect(parseSemver("0.1.0")).toEqual([0, 1, 0]);
		expect(parseSemver("12.34.56")).toEqual([12, 34, 56]);
	});

	test("rejects invalid versions", () => {
		expect(() => parseSemver("1.0")).toThrow(/Invalid semver/);
		expect(() => parseSemver("v1.0.0")).toThrow(/Invalid semver/);
	});
});

describe("bumpSemver", () => {
	test("bumps patch", () => {
		expect(bumpSemver("0.1.0", "patch")).toBe("0.1.1");
	});

	test("bumps minor", () => {
		expect(bumpSemver("0.1.9", "minor")).toBe("0.2.0");
	});

	test("bumps major", () => {
		expect(bumpSemver("1.2.3", "major")).toBe("2.0.0");
	});
});

describe("compareSemver", () => {
	test("orders versions", () => {
		expect(compareSemver("0.1.1", "0.0.4")).toBeGreaterThan(0);
		expect(compareSemver("0.0.4", "0.1.1")).toBeLessThan(0);
		expect(compareSemver("1.0.0", "1.0.0")).toBe(0);
	});
});

describe("maxSemver", () => {
	test("picks the highest version", () => {
		expect(maxSemver(["0.0.4", "0.1.1", "0.1.0"])).toBe("0.1.1");
	});
});
