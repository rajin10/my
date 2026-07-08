// Talash for Business — owner dataset

import type {
	BusinessVertical,
	KhataDue,
	Order,
	OrderStatus,
} from "@repo/api-client";

export type Business = {
	name: string;
	category: string;
	city: string;
	status: "Active" | "Draft" | "Suspended";
	/** Decides which catalog experience the owner manages (ADR-0004). */
	vertical: BusinessVertical;
	rating: number;
	reviews: number;
	description: string;
	branches: string[];
	photos: string[];
	owner: { name: string; role: string; email: string };
};

export type Booking = {
	id: string;
	customer: string;
	service: string;
	branch: string;
	date: string;
	time: string;
	duration: number;
	price: number;
	status: "Pending" | "Confirmed" | "Cancelled" | "Completed";
	when: string;
};

export type Service = {
	id: string;
	name: string;
	branch: string;
	category: string;
	duration: number;
	price: number;
	desc?: string;
	photoUrl?: string | null;
};

/** Commerce vertical: a sellable physical good with stock tracked per branch. */
export type Product = {
	id: string;
	name: string;
	branch: string;
	category: string | null;
	price: number;
	stock: number;
	desc?: string;
	status: "Active" | "Inactive";
	photoUrl?: string | null;
};

export type Review = {
	id: string;
	name: string;
	service: string;
	rating: number;
	date: string;
	status: "Pending" | "Published";
	text: string;
};

export type Coupon = {
	id: string;
	code: string;
	type: "Percentage" | "Fixed";
	value: number;
	used: number;
	max: number;
	status: "Active" | "Expired";
	expires: string;
};

export type TeamMember = {
	id: string;
	name: string;
	title: string;
	role: "Owner" | "Manager" | "Staff";
	branch: string;
};

export type Notification = {
	id: string;
	type:
		| "booking"
		| "cancel"
		| "review"
		| "system"
		| "order"
		| "order_cancelled";
	group: "today" | "earlier";
	unread: boolean;
	title: string;
	body: string;
	when: string;
	go?: "bookings" | "reviews" | "orders";
};

export const CATEGORY_OPTIONS = [
	"Spa",
	"Massage",
	"Face",
	"Hair",
	"Nails",
	"Fitness",
	"Consult",
];

export const PRODUCT_CATEGORY_OPTIONS = [
	"Cylinder",
	"Regulator",
	"Stove",
	"Accessory",
	"Refill",
	"Other",
];

export const PRODUCT_STATUS_OPTIONS: string[] = ["Active", "Inactive"];

export const BUSINESS_CATEGORY_LABELS = [
	"Spa & massage",
	"Salon & hair",
	"Nails & beauty",
	"Skin & aesthetics",
	"Fitness & yoga",
	"Clinic & wellness",
];

export const BUSINESS_CATEGORIES = [
	{ label: "Spa & massage", icon: "Flower2" },
	{ label: "Salon & hair", icon: "Scissors" },
	{ label: "Nails & beauty", icon: "Sparkles" },
	{ label: "Skin & aesthetics", icon: "Gem" },
	{ label: "Fitness & yoga", icon: "Dumbbell" },
	{ label: "Clinic & wellness", icon: "Stethoscope" },
];

export const ROLE_TONES: Record<string, { bg: string; fg: string }> = {
	Owner: { bg: "#F6EEDC", fg: "#9C7634" },
	Manager: { bg: "#E8F2EE", fg: "#0B5C4B" },
	Staff: { bg: "#EEF1EF", fg: "#5E6B65" },
};

export const PHOTO_TONES: Record<string, [string, string]> = {
	forest: ["#1f6b58", "#0b4a3c"],
	clay: ["#9c7448", "#5d4327"],
	sage: ["#6f8a73", "#3e5742"],
	stone: ["#8a8170", "#544d3e"],
	rose: ["#a86b63", "#6e3f3a"],
	deep: ["#2e7d8c", "#1b5560"],
};

export function money(n: number): string {
	return `৳${Number(n).toLocaleString("en-BD")}`;
}

export function shortMoney(n: number): string {
	if (n >= 100000) return `৳${(n / 100000).toFixed(1).replace(/\.0$/, "")}L`;
	if (n >= 1000) return `৳${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
	return `৳${n}`;
}

export type BusinessStatus = Business["status"];

/**
 * The status the owner-facing toggle moves to, or `null` when the owner cannot
 * change it themselves. A binary toggle can only express Active⇄Draft;
 * "Suspended" is a Talash action and must not be flipped to Active by the owner.
 */
export function nextBusinessStatus(
	current: BusinessStatus,
): BusinessStatus | null {
	if (current === "Active") return "Draft";
	if (current === "Draft") return "Active";
	return null;
}

/** Whether the owner may toggle this business's visibility from the app. */
export function isBusinessStatusToggleable(current: BusinessStatus): boolean {
	return nextBusinessStatus(current) !== null;
}

// ── Order fulfillment helpers ────────────────────────────────────────────────

const ORDER_FLOW: Record<OrderStatus, OrderStatus | null> = {
	Pending: "Confirmed",
	Confirmed: "OutForDelivery",
	OutForDelivery: "Delivered",
	Delivered: null,
	Cancelled: null,
};

/** The single valid forward status, or null for terminal states. */
export function nextOrderStatus(status: OrderStatus): OrderStatus | null {
	return ORDER_FLOW[status];
}

const ORDER_ACTION_LABEL: Record<OrderStatus, string> = {
	Pending: "",
	Confirmed: "Confirm order",
	OutForDelivery: "Mark out for delivery",
	Delivered: "Mark delivered",
	Cancelled: "",
};

/** Button label for advancing TO `next` (pass the result of nextOrderStatus). */
export function nextOrderActionLabel(next: OrderStatus): string {
	return ORDER_ACTION_LABEL[next];
}

/** Owner-cancel is allowed only before fulfillment starts. */
export function isOrderCancellable(status: OrderStatus): boolean {
	return status === "Pending" || status === "Confirmed";
}

const ORDER_DONE: OrderStatus[] = ["Delivered", "Cancelled"];

export function partitionOrders(orders: Order[]): {
	active: Order[];
	done: Order[];
} {
	const active: Order[] = [];
	const done: Order[] = [];
	for (const o of orders) {
		(ORDER_DONE.includes(o.status) ? done : active).push(o);
	}
	return { active, done };
}

// ── Khata ────────────────────────────────────────────────────────────────────

/** Total amount owed across all debtors (the header stat on the Khata screen). */
export function totalOutstanding(dues: KhataDue[]): number {
	return dues.reduce((sum, d) => sum + d.due, 0);
}

export type CouponDraft = {
	code: string;
	type: Coupon["type"];
	value: number;
	/** Optional max-uses cap. When omitted/undefined/NaN it defaults to 100 at submit. When provided it must be an integer ≥ 1. */
	max?: number;
};

export type CouponValidation = { ok: true } | { ok: false; error: string };

/**
 * Validates coupon input before it is sent. Percentage discounts are whole
 * numbers from 1–100; fixed discounts are at least ৳1. The backend remains the
 * source of truth — this only stops obviously meaningless or harmful coupons.
 * Max-uses is optional (defaults to 100 at submit) but must be an integer ≥ 1
 * when explicitly provided.
 */
export function validateCoupon(draft: CouponDraft): CouponValidation {
	if (!draft.code.trim()) return { ok: false, error: "Enter a coupon code." };
	if (!Number.isFinite(draft.value)) {
		return { ok: false, error: "Enter a discount amount." };
	}
	if (draft.type === "Percentage") {
		if (
			!Number.isInteger(draft.value) ||
			draft.value < 1 ||
			draft.value > 100
		) {
			return {
				ok: false,
				error: "Percentage must be a whole number from 1 to 100.",
			};
		}
	} else if (draft.value < 1) {
		return { ok: false, error: "Fixed discount must be at least ৳1." };
	}
	if (draft.max !== undefined && Number.isFinite(draft.max)) {
		if (!Number.isInteger(draft.max) || draft.max < 1) {
			return { ok: false, error: "Max uses must be at least 1." };
		}
	}
	return { ok: true };
}
