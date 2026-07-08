import type { BrandPalette, BusinessVertical } from "@repo/api-client";

export type Branch = {
	id: string;
	name: string;
	address: string;
	city: string;
	lat?: number | null;
	lng?: number | null;
};
export type Service = {
	id: string;
	name: string;
	cat: string;
	duration: number;
	price: number;
	desc?: string;
	branchId?: string;
	photoUrl?: string | null;
};
export type Business = {
	id: string;
	name: string;
	/** Which vertical's experience to render — booking (salon/spa) or commerce (LPG). */
	vertical: BusinessVertical;
	category: string;
	city: string;
	rating: number;
	reviews: number;
	from: number;
	tone: [string, string];
	premium?: boolean;
	blurb: string;
	coverPhotoUrl?: string | null;
	photoUrls?: string[];
	branches: Branch[];
	services: Service[];
	/** First branch with coordinates — used for map pins */
	mapLat?: number | null;
	mapLng?: number | null;
	/** Commerce discovery: nearest branch area (null for booking results). */
	area?: string | null;
	/** Commerce discovery: distance from the user in km when GPS is used. */
	distanceKm?: number | null;
	/**
	 * Venue brand palette (white-label). Drives the single-tenant reskin in the
	 * detail/booking flow and the per-item accent in cross-venue lists; `null`/
	 * absent ⇒ Talash defaults (ADR-0002).
	 */
	brandPalette?: BrandPalette | null;
};

export type Booking = {
	id: string;
	business: Business;
	service: Service;
	branch: Branch;
	day: { label: string | null; wd: string; n: number; key?: number };
	/** Display time only — "HH:MM" in business-local time */
	slot: string;
	/** Full ISO datetime from the API — used for notification scheduling */
	slotIso: string;
	status: "Pending" | "Confirmed" | "Cancelled" | "Completed";
	total: number;
	discount: number;
	coupon: string | null;
	payment?: PaymentMethod;
};

export type Review = {
	id: string;
	name: string;
	date: string;
	rating: number;
	service: string;
	text: string;
};

export type PaymentMethod = {
	id: string;
	kind: "upi" | "card" | "wallet" | "cash";
	label: string;
	detail: string;
	icon: string;
};

export type Notification = {
	id: string;
	type:
		| "reminder"
		| "reward"
		| "offer"
		| "review"
		| "confirmed"
		| "system"
		| "order"
		| "order_cancelled";
	group: "today" | "earlier";
	unread: boolean;
	title: string;
	body: string;
	when: string;
	cta?: string;
	go?: string;
	/** Target order for `go: "orders"` notifications — deep-links to its detail sheet. */
	orderId?: string | null;
};

export type OrderStatusUI =
	| "Pending"
	| "Confirmed"
	| "OutForDelivery"
	| "Delivered"
	| "Cancelled";

export type OrderItem = {
	id: string;
	productId: string;
	name: string; // resolved from product where available, else "Item"
	quantity: number;
	unitPrice: number;
	lineTotal: number; // quantity * unitPrice
};

export type Order = {
	id: string;
	businessId: string;
	branchId: string;
	status: OrderStatusUI;
	total: number;
	deliveryLine: string;
	deliveryArea: string | null;
	deliveryCity: string | null;
	deliveredAt: string | null;
	createdAt: string;
	items: OrderItem[]; // empty for list rows (detail fetch populates)
};

export type CustomerAddress = {
	id: string;
	label: string | null;
	line: string;
	area: string | null;
	city: string | null;
	lat: number | null;
	lng: number | null;
	isDefault: boolean;
};

export type CartLine = {
	productId: string;
	name: string;
	unitPrice: number;
	quantity: number;
};

export const CATEGORIES = [
	"All",
	"Hair",
	"Spa & massage",
	"Fitness",
	"Clinics",
];

/** Shown at checkout until online payments are integrated with the API. */
export const PAY_AT_BUSINESS: PaymentMethod = {
	id: "cash",
	kind: "cash",
	label: "Pay at business",
	detail: "Settle with the business when you arrive",
	icon: "Banknote",
};

/** @deprecated Mock methods — do not show in customer UI */
export const PAYMENT_METHODS: PaymentMethod[] = [
	{
		id: "upi",
		kind: "upi",
		label: "UPI",
		detail: "sara@okhdfc",
		icon: "Smartphone",
	},
	{
		id: "visa",
		kind: "card",
		label: "Visa",
		detail: "•••• 4242",
		icon: "CreditCard",
	},
	{
		id: "cash",
		kind: "cash",
		label: "Pay at business",
		detail: "Cash or card on arrival",
		icon: "Banknote",
	},
];
