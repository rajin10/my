/** FK-safe deletion order: children before parents. Single source of truth for local fresh and remote truncate. */
export const TRUNCATE_ORDER = [
	"reward_transactions",
	"reward_points",
	"reviews",
	"payments",
	"order_items",
	"orders",
	"customer_addresses",
	"bookings",
	"coupons",
	"staff_availability",
	"team_members",
	"products",
	"services",
	"branch_hours",
	"business_photos",
	"favourites",
	"campaigns",
	"branches",
	"businesses",
	"notifications",
	"auth_refresh_tokens",
	"demo_requests",
	"users",
] as const;

/** FK-safe insert order for remote export/push: parents before children. */
export const EXPORT_ORDER = [...TRUNCATE_ORDER].reverse();
