import { ApiError } from "./client";

export type AuthLoginErrorCode =
	| "oauth_failed"
	| "rate_limited"
	| "missing_params";

/** User-facing copy for `?error=` query params on login pages. */
export function authLoginErrorMessage(code: string | null): string {
	switch (code) {
		case "rate_limited":
			return "Too many sign-in attempts. Please wait a minute and try again.";
		case "missing_params":
			return "Sign-in link was incomplete. Please try again.";
		case "oauth_failed":
			return "Sign-in failed. Please try again.";
		default:
			return "";
	}
}

/** Map an OAuth callback API failure to a login-page error code. */
export function authCallbackErrorParam(error: unknown): AuthLoginErrorCode {
	if (error instanceof ApiError && error.status === 429) {
		return "rate_limited";
	}
	return "oauth_failed";
}

/** Map email/password auth API failures for inline form errors. */
export function authFormErrorMessage(error: unknown): string {
	if (error instanceof ApiError) {
		if (error.status === 429) {
			return "Too many attempts. Please wait a minute and try again.";
		}
		return error.message;
	}
	return error instanceof Error ? error.message : "Something went wrong.";
}

/** Map a sign-in-start API failure (e.g. GET /auth/google) for inline login errors. */
export function authSignInStartErrorMessage(error: unknown): string {
	if (error instanceof ApiError && error.status === 429) {
		return authLoginErrorMessage("rate_limited");
	}
	return error instanceof Error ? error.message : "Something went wrong.";
}
