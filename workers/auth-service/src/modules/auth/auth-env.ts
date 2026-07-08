import { InternalError } from "../../core/errors";

/** Fail fast when auth secrets are missing — avoids opaque 500s from hono/jwt sign(). */
export function assertAuthSecrets(env: {
	JWT_SECRET?: string;
	GOOGLE_CLIENT_SECRET?: string;
}): void {
	if (!env.JWT_SECRET?.trim()) {
		throw new InternalError("JWT_SECRET is not configured.");
	}
	if (!env.GOOGLE_CLIENT_SECRET?.trim()) {
		throw new InternalError("GOOGLE_CLIENT_SECRET is not configured.");
	}
}
