/** Prefix segments matched against TanStack Query keys (see shouldDehydrateQuery). */
export type QueryKeyPrefix = readonly (string | number)[];

/** Shared read surfaces — both apps. */
const SHARED_PREFIXES: QueryKeyPrefix[] = [
	["auth", "me"],
	["auth", "sessions"],
	["notifications"],
];

/** Customer app read surfaces. */
const CUSTOMER_PREFIXES: QueryKeyPrefix[] = [
	["bookings"],
	["booking"],
	["business"],
	["business", "detail"],
	["service"],
	["branch"],
	["search"],
	["favourites"],
	["business-photos"],
	["reviews"],
	["business-coupons"],
	["branch-hours"],
	["rewards"],
	["orders"],
	["order"],
	["products"],
	["addresses"],
	["branches"],
];

/** Owner app read surfaces. */
const OWNER_PREFIXES: QueryKeyPrefix[] = [
	["business", "owner"],
	["business-content"],
	["business-products"],
	["bookings"],
	["bookings", "calendar"],
	["booking"],
	["reviews"],
	["coupons"],
	["coupon"],
	["team"],
	["campaigns"],
	["customers"],
	["customer-visits"],
	["business-photos"],
	["branch-hours"],
	["staff-availability"],
	["branch-orders"],
	["order"],
	["khata-dues"],
	["khata-customer"],
	["analytics"],
	["branches"],
];

export const PERSIST_PREFIXES: QueryKeyPrefix[] = [
	...SHARED_PREFIXES,
	...CUSTOMER_PREFIXES,
	...OWNER_PREFIXES,
];

/** Volatile or write-only queries — never persisted. */
export const EXCLUDE_PREFIXES: QueryKeyPrefix[] = [
	["branch-availability"],
	["users", "search"],
];

export function keyMatchesPrefix(
	queryKey: readonly unknown[],
	prefix: QueryKeyPrefix,
): boolean {
	if (queryKey.length < prefix.length) return false;
	return prefix.every((segment, index) => queryKey[index] === segment);
}
