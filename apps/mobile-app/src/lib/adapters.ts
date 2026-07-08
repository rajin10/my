import type {
	Booking as ApiBooking,
	Branch as ApiBranch,
	Business as ApiBusiness,
	CustomerAddress as ApiCustomerAddress,
	Order as ApiOrder,
	OrderItem as ApiOrderItem,
	OrderWithItems as ApiOrderWithItems,
	Service as ApiService,
} from "@repo/api-client";
import type {
	Booking,
	Branch,
	Business,
	CustomerAddress,
	Notification,
	Order,
	OrderItem,
	Service,
} from "../data";

const DEFAULT_TONE: [string, string] = ["#e8f5e9", "#1b5e20"];

export function adaptBranch(b: ApiBranch): Branch {
	return {
		id: b.id,
		name: b.name,
		address: b.address,
		city: b.city,
		lat: b.lat,
		lng: b.lng,
	};
}

export function adaptService(s: ApiService): Service {
	return {
		id: s.id,
		name: s.name,
		cat: s.category,
		duration: s.duration,
		price: s.price,
		desc: s.description ?? undefined,
		branchId: s.branchId,
		photoUrl: s.photoUrl,
	};
}

export function adaptBusinessDetail(
	business: ApiBusiness,
	branches: ApiBranch[],
	services: ApiService[],
	minPrice?: number,
	photoUrls?: string[],
): Business {
	const uiBranches = branches.map(adaptBranch);
	const uiServices = services.map(adaptService);
	const pinBranch = uiBranches.find((b) => b.lat != null && b.lng != null);
	return {
		id: business.id,
		name: business.name,
		vertical: business.vertical,
		category: business.category,
		city: business.city,
		rating: 0,
		reviews: 0,
		from:
			minPrice ??
			(uiServices.length ? Math.min(...uiServices.map((s) => s.price)) : 0),
		tone: DEFAULT_TONE,
		blurb: business.description ?? "",
		photoUrls,
		branches: uiBranches,
		services: uiServices,
		mapLat: pinBranch?.lat ?? null,
		mapLng: pinBranch?.lng ?? null,
		brandPalette: business.brandPalette ?? null,
	};
}

export function adaptApiBooking(
	b: ApiBooking,
	ctx?: { business?: Business; service?: Service; branch?: Branch },
): Booking {
	const slotDate = new Date(b.slot);
	const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	return {
		id: b.id,
		business: ctx?.business ?? {
			id: b.businessId,
			name: "",
			vertical: "booking",
			category: "",
			city: "",
			rating: 0,
			reviews: 0,
			from: 0,
			tone: DEFAULT_TONE,
			blurb: "",
			branches: [],
			services: [],
		},
		service: ctx?.service ?? {
			id: b.serviceId,
			name: "Service",
			cat: "",
			duration: 60,
			price: b.price,
		},
		branch: ctx?.branch ?? {
			id: b.branchId,
			name: "",
			address: "",
			city: "",
		},
		day: {
			label: formatDayLabel(slotDate),
			// biome-ignore lint/style/noNonNullAssertion: getDay() returns 0-6, always a valid index
			wd: wd[slotDate.getDay()]!,
			n: slotDate.getDate(),
		},
		slot: b.slot.includes("T")
			? (b.slot.split("T")[1]?.slice(0, 5) ?? b.slot)
			: b.slot,
		slotIso: b.slot,
		status: b.status as Booking["status"],
		total: b.price - b.discount,
		discount: b.discount,
		coupon: b.couponCode,
	};
}

export function adaptOrderItem(
	it: Pick<
		ApiOrderItem,
		"id" | "orderId" | "productId" | "quantity" | "unitPrice"
	>,
	resolveName?: (productId: string) => string | undefined,
): OrderItem {
	return {
		id: it.id,
		productId: it.productId,
		name: resolveName?.(it.productId) ?? "Item",
		quantity: it.quantity,
		unitPrice: it.unitPrice,
		lineTotal: it.quantity * it.unitPrice,
	};
}

export function adaptOrder(
	o: (ApiOrder | ApiOrderWithItems) & {
		items?: Array<
			Pick<
				ApiOrderItem,
				"id" | "orderId" | "productId" | "quantity" | "unitPrice"
			>
		>;
	},
	resolveName?: (productId: string) => string | undefined,
): Order {
	const items =
		"items" in o && o.items
			? o.items.map((i) => adaptOrderItem(i, resolveName))
			: [];
	return {
		id: o.id,
		businessId: o.businessId,
		branchId: o.branchId,
		status: o.status,
		total: o.total,
		deliveryLine: o.deliveryLine,
		deliveryArea: o.deliveryArea,
		deliveryCity: o.deliveryCity,
		deliveredAt: o.deliveredAt,
		createdAt: o.createdAt,
		items,
	};
}

export function adaptCustomerAddress(a: ApiCustomerAddress): CustomerAddress {
	return {
		id: a.id,
		label: a.label,
		line: a.line,
		area: a.area,
		city: a.city,
		lat: a.lat,
		lng: a.lng,
		isDefault: a.isDefault,
	};
}

function formatDayLabel(d: Date): string {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const target = new Date(d);
	target.setHours(0, 0, 0, 0);
	const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
	if (diff === 0) return "Today";
	if (diff === 1) return "Tomorrow";
	return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]} ${d.getDate()}`;
}

/**
 * Maps an API AppNotification.type to the local Notification view-model type.
 * Order cancellations arrive as "order_cancelled" (their own icon); booking
 * cancellations stay on "cancel" → "system". Unknown/unmapped types fall back
 * to "system". Pure — unit-tested in notification-adapters.test.ts.
 */
const NOTIF_TYPE_MAP: Record<string, Notification["type"]> = {
	booking: "confirmed",
	cancel: "system",
	review: "review",
	system: "system",
	order: "order",
	order_cancelled: "order_cancelled",
};

export function mapNotificationType(apiType: string): Notification["type"] {
	return NOTIF_TYPE_MAP[apiType] ?? "system";
}

/**
 * Navigation params for a tapped notification whose target is the orders area.
 * Order-status notifications (forward transitions and cancellations) all carry
 * `go: "orders"`; when the payload also has an `orderId` we deep-link straight
 * to that order's detail sheet, otherwise we open the My Orders list. Returns
 * `null` for every other notification (they route by their own `go` tab). Pure —
 * unit-tested in notification-adapters.test.ts.
 */
export function orderNotifParams(
	n: Pick<Notification, "go" | "orderId">,
): { view: "orders"; orderId?: string } | null {
	if (n.go !== "orders") return null;
	return n.orderId
		? { view: "orders", orderId: n.orderId }
		: { view: "orders" };
}
