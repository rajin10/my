import type { ContentfulStatusCode } from "hono/utils/http-status";

export class AppError extends Error {
	constructor(
		public readonly status: number,
		public readonly code: string,
		message: string,
	) {
		super(message);
		this.name = this.constructor.name;
	}
}

export class NotFoundError extends AppError {
	constructor(message = "Not found") {
		super(404, "NOT_FOUND", message);
	}
}

export class UnauthorizedError extends AppError {
	constructor(message = "Unauthorized") {
		super(401, "UNAUTHORIZED", message);
	}
}

export class ForbiddenError extends AppError {
	constructor(message = "Forbidden") {
		super(403, "FORBIDDEN", message);
	}
}

export class ConflictError extends AppError {
	constructor(message: string) {
		super(409, "CONFLICT", message);
	}
}

export class ValidationError extends AppError {
	constructor(message: string) {
		super(422, "VALIDATION_ERROR", message);
	}
}

export class TooManyRequestsError extends AppError {
	constructor(message = "Too many requests. Try again later.") {
		super(429, "RATE_LIMITED", message);
	}
}

export class InternalError extends AppError {
	constructor(message = "Internal server error") {
		super(500, "INTERNAL_ERROR", message);
	}
}

export class GatewayTimeoutError extends AppError {
	constructor(message = "Request timed out") {
		super(504, "GATEWAY_TIMEOUT", message);
	}
}

export function isAppError(err: unknown): err is AppError {
	return err instanceof AppError;
}

export function toHttpStatus(err: AppError): ContentfulStatusCode {
	return err.status as ContentfulStatusCode;
}
