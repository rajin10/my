// scripts/dev/__tests__/secrets.test.ts
import { describe, expect, test } from "bun:test";
import { parseSecretsJson } from "../secrets.ts";

describe("secrets", () => {
	test("parseSecretsJson accepts jwtSecret + googleClientSecret", () => {
		const parsed = parseSecretsJson(
			'{"jwtSecret":"abc","googleClientSecret":"GOCSPX-x"}',
		);
		expect(parsed.jwtSecret).toBe("abc");
		expect(parsed.googleClientSecret).toBe("GOCSPX-x");
	});

	test("parseSecretsJson rejects missing keys", () => {
		expect(() => parseSecretsJson("{}")).toThrow();
	});
});
