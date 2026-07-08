import { describe, expect, it } from "vitest";
import { z } from "zod";
import { formatZodIssues } from "../../core/http/validation";

describe("formatZodIssues", () => {
	it("joins multiple issue messages with semicolon", () => {
		const schema = z.object({ a: z.string(), b: z.number() });
		const result = schema.safeParse({ a: 1, b: "x" });
		if (result.success) throw new Error("expected failure");
		expect(formatZodIssues(result.error.issues)).toMatch(/; /);
	});
});
