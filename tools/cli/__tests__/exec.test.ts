import { describe, expect, test } from "bun:test";
import { validateEnv } from "../core/exec.ts";

describe("validateEnv", () => {
	test("accepts the three known envs", () => {
		expect(validateEnv("local")).toBe("local");
		expect(validateEnv("staging")).toBe("staging");
		expect(validateEnv("production")).toBe("production");
	});
});
