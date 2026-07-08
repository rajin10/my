import type { MiddlewareHandler } from "hono";
import { parseQueryString } from "../core/http/query-parse";
import type { AppEnv } from "../types";

export const queryParserMiddleware: MiddlewareHandler<AppEnv> = async (
	c,
	next,
) => {
	const [, queryString = ""] = c.req.url.split("?");
	const parsedQuery = parseQueryString(queryString, {
		allowDots: true,
		comma: true,
	});

	c.set("parsedQuery", parsedQuery as Record<string, unknown>);
	await next();
};
