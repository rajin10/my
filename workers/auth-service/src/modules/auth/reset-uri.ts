import { ValidationError } from "../../core/errors";

/** Parse and validate a client-supplied reset URI against the env allowlist. */
export function assertAllowedResetUri(
	resetUri: string,
	allowedResetUris: string | undefined,
): void {
	const allowed = (allowedResetUris ?? "")
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);

	if (allowed.length === 0) {
		throw new ValidationError("Password reset is not configured.");
	}

	if (!allowed.includes(resetUri)) {
		throw new ValidationError("Invalid reset_uri.");
	}
}
