import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../types";
import { formatZodIssues } from "./http/validation";

export function createApp(opts?: { strict?: boolean }) {
	return new OpenAPIHono<AppEnv>({
		...opts,
		defaultHook: (result, c) => {
			if (!result.success) {
				const message = formatZodIssues(result.error.issues);
				return c.json(
					{ ok: false as const, code: "VALIDATION_ERROR", message },
					422,
				);
			}
		},
	});
}
