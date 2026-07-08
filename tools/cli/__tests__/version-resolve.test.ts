import { describe, expect, test } from "bun:test";
import { resolveVersionTargets } from "../core/version-resolve.ts";

describe("resolveVersionTargets", () => {
	test("defaults to all site targets", () => {
		const targets = resolveVersionTargets({});
		expect(targets.map((t) => t.id).sort()).toEqual([
			"business-dashboard",
			"marketing-site",
		]);
	});

	test("expands multiple groups", () => {
		const targets = resolveVersionTargets({ groups: "sites,apps" });
		expect(targets.map((t) => t.id).sort()).toEqual([
			"business-dashboard",
			"marketing-site",
			"mobile-app",
			"owner-app",
		]);
	});

	test("expands all groups", () => {
		const targets = resolveVersionTargets({ groups: "all" });
		expect(targets).toHaveLength(7);
	});

	test("only overrides groups", () => {
		const targets = resolveVersionTargets({
			groups: "all",
			only: "api,mobile-app",
		});
		expect(targets.map((t) => t.id).sort()).toEqual(["api", "mobile-app"]);
	});

	test("site all keeps backward compatibility", () => {
		const targets = resolveVersionTargets({ site: "all" });
		expect(targets.map((t) => t.id).sort()).toEqual([
			"business-dashboard",
			"marketing-site",
		]);
	});

	test("rejects unknown group", () => {
		expect(() => resolveVersionTargets({ groups: "packages" })).toThrow(
			/Unknown group/,
		);
	});
});
