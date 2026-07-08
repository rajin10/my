import type { ErrorHandler, NotFoundHandler } from "hono";
import { isAppError, toHttpStatus } from "../core/errors";
import type { AppEnv } from "../types";

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
	if (isAppError(err)) {
		return c.json(
			{ ok: false, code: err.code, message: err.message },
			toHttpStatus(err),
		);
	}

	console.error(err);
	return c.json(
		{ ok: false, code: "INTERNAL_ERROR", message: "Internal server error" },
		500,
	);
};

export const notFoundHandler: NotFoundHandler<AppEnv> = (c) => {
	return c.json(
		{ ok: false, code: "NOT_FOUND", message: "Route not found" },
		404,
	);
};
