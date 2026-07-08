import { UserRole } from "@repo/core/src/database/schema";

/**
 * Where a sign-in request originated. The source — not the client — decides which
 * account role is looked up / created, so a single email can hold one account per
 * role (e.g. a customer "user" account and a business "owner" account).
 */
export enum SignInSource {
	MARKETING_SITE = "marketing-site",
	MOBILE_APP = "mobile-app",
	BUSINESS_APP = "business-app",
}

export const SIGN_IN_SOURCES = [
	SignInSource.MARKETING_SITE,
	SignInSource.MOBILE_APP,
	SignInSource.BUSINESS_APP,
] as const;

/** Source clients default to when none is supplied — preserves the legacy "always a user" behaviour. */
export const DEFAULT_SIGN_IN_SOURCE = SignInSource.MOBILE_APP;

/**
 * Roles a sign-in `source` is allowed to provision. Both are self-service — any
 * visitor can already obtain them (an `owner` account owns nothing until it creates
 * a business) — which is the entire reason client-declared `source` is not a privilege
 * escalation. Privileged roles (`moderator`/`manager`/`staff`) are granted only by
 * server-side team assignment and must never be reachable from a `source`. See
 * ADR 0002.
 */
type SelfServiceRole = UserRole.USER | UserRole.OWNER;

// Typed as Record<…, SelfServiceRole> on purpose: adding e.g. `admin-app -> MODERATOR`
// fails to compile here, so the no-privesc invariant can't be broken by a later edit.
const SOURCE_ROLE_MAP: Record<SignInSource, SelfServiceRole> = {
	[SignInSource.MARKETING_SITE]: UserRole.USER,
	[SignInSource.MOBILE_APP]: UserRole.USER,
	[SignInSource.BUSINESS_APP]: UserRole.OWNER,
};

/** Resolve the account role a given sign-in source provisions. */
export function roleForSource(
	source: SignInSource = DEFAULT_SIGN_IN_SOURCE,
): UserRole {
	return SOURCE_ROLE_MAP[source];
}
