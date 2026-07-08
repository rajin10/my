import type { Context } from "hono";
import type { ZodIssue, ZodSchema } from "zod";
import type { AppEnv } from "../../types";
import { ValidationError } from "../errors";

export function formatZodIssues(issues: ZodIssue[]): string {
	return issues.map((i) => i.message).join("; ") || "Validation failed";
}

/**
 * Parse and validate the pre-parsed query object (set by query-parser middleware).
 * Throws ValidationError (422) on failure so routes don't need boilerplate safeParse checks.
 */
export function parseQuery<T>(c: Context<AppEnv>, schema: ZodSchema<T>): T {
	const result = schema.safeParse(c.get("parsedQuery"));
	if (!result.success) {
		throw new ValidationError(formatZodIssues(result.error.issues));
	}
	return result.data;
}

/**
 * Parse and validate a JSON request body.
 * Throws ValidationError (422) on failure.
 */
export async function parseBody<T>(
	c: Context<AppEnv>,
	schema: ZodSchema<T>,
): Promise<T> {
	const raw = await c.req.json().catch(() => null);
	const result = schema.safeParse(raw);
	if (!result.success) {
		throw new ValidationError(formatZodIssues(result.error.issues));
	}
	return result.data;
}
