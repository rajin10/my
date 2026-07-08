// i18n scaffold — wraps all user-visible strings so adding languages later
// is a find-replace of `t("key")` rather than a whole-codebase search.
// When ready, swap this module out for i18next or expo-localization.

const en = {
	// Today
	"today.title": "Today",
	"today.noConfirmed": "No confirmed appointments today yet.",
	"today.schedule": "Today's schedule",
	"today.pendingApprovals": "Needs your approval",
	// Bookings
	"bookings.title": "Bookings",
	"bookings.confirm": "Confirm",
	"bookings.decline": "Decline",
	"bookings.cancel": "Cancel",
	"bookings.declineConfirm": "Decline booking?",
	"bookings.cancelConfirm": "Cancel booking?",
	// Reviews
	"reviews.title": "Reviews",
	"reviews.pending": "Awaiting approval",
	"reviews.published": "Published",
	"reviews.approve": "Approve & publish",
	"reviews.reject": "Reject",
	"reviews.empty": "No published reviews",
	// Services
	"services.title": "Services",
	"services.add": "Add service",
	"services.empty": "No services yet",
	// Common
	"common.live": "Live · accepting bookings",
	"common.draft": "Draft · hidden from customers",
	"common.signOut": "Sign out",
	"common.save": "Save",
	"common.cancel": "Cancel",
	"common.retry": "Try again",
} as const;

type Key = keyof typeof en;

export function t(key: Key): string {
	return en[key];
}
