const GUEST_PHONE_RE = /^01[3-9]\d{8}$/;

export type WalkInCustomer = {
	userId?: string;
	guestName?: string;
	guestPhone?: string;
};

/** Returns an error message when invalid; null when valid. */
export function validateWalkInCustomer(customer: WalkInCustomer): string | null {
	if (customer.userId) return null;

	const name = customer.guestName?.trim() ?? "";
	if (name.length < 2) {
		return "Guest name must be at least 2 characters";
	}
	if (!customer.guestPhone || !GUEST_PHONE_RE.test(customer.guestPhone)) {
		return "Guest phone must be a valid Bangladesh mobile number";
	}
	return null;
}
