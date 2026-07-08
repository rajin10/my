import { UserRole } from "@repo/core/src/database/schema";

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

export const DEFAULT_SIGN_IN_SOURCE = SignInSource.MOBILE_APP;

type SelfServiceRole = UserRole.USER | UserRole.OWNER;

const SOURCE_ROLE_MAP: Record<SignInSource, SelfServiceRole> = {
	[SignInSource.MARKETING_SITE]: UserRole.USER,
	[SignInSource.MOBILE_APP]: UserRole.USER,
	[SignInSource.BUSINESS_APP]: UserRole.OWNER,
};

export function roleForSource(
	source: SignInSource = DEFAULT_SIGN_IN_SOURCE,
): UserRole {
	return SOURCE_ROLE_MAP[source];
}
