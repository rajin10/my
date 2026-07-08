import type {
	Booking as ApiBooking,
	Branch as ApiBranch,
	Coupon as ApiCoupon,
	Product as ApiProduct,
	Review as ApiReview,
	Service as ApiService,
	TeamMember as ApiTeamMember,
	AppNotification,
	CalendarBooking,
	OrderItem,
} from "@repo/api-client";
import type {
	Booking,
	Coupon,
	Notification,
	Product,
	Review,
	Service,
	TeamMember,
} from "../data";

/** Branch list rows may include customer display name from the API. */
export type ApiBranchBooking = ApiBooking & { customerName?: string };

export function formatRelativeDate(iso: string): string {
	const d = new Date(iso);
	const now = new Date();
	const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
	if (diff < 60) return "Just now";
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
	if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
	if (diff < 172800) return "Yesterday";
	return d.toLocaleDateString("en-BD", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

export function formatExpiryDate(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleDateString("en-BD", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

export function adaptService(s: ApiService, branches: ApiBranch[]): Service {
	return {
		id: s.id,
		name: s.name,
		branch: branches.find((b) => b.id === s.branchId)?.name ?? s.branchId,
		category: s.category,
		duration: s.duration,
		price: s.price,
		desc: s.description ?? undefined,
		photoUrl: s.photoUrl,
	};
}

export function adaptProduct(p: ApiProduct, branches: ApiBranch[]): Product {
	return {
		id: p.id,
		name: p.name,
		branch: branches.find((b) => b.id === p.branchId)?.name ?? p.branchId,
		category: p.category,
		price: p.price,
		stock: p.stock,
		desc: p.description ?? undefined,
		status: p.status,
		photoUrl: p.imageUrl,
	};
}

export function adaptReview(r: ApiReview, services: Service[]): Review {
	return {
		id: r.id,
		name: r.userName?.trim() || "Customer",
		service: services.find((s) => s.id === r.serviceId)?.name ?? r.serviceId,
		rating: r.rating,
		date: formatRelativeDate(r.createdAt),
		status: r.status,
		text: r.text,
	};
}

export function adaptCoupon(c: ApiCoupon): Coupon {
	return {
		id: c.id,
		code: c.code,
		type: c.type,
		value: c.value,
		used: c.usedCount,
		max: c.maxUses,
		status: c.status,
		expires: formatExpiryDate(c.expiresAt),
	};
}

export function adaptTeamMember(
	m: ApiTeamMember,
	branches: ApiBranch[],
): TeamMember {
	return {
		id: m.id,
		name: m.userName,
		title: m.title,
		role: m.role as TeamMember["role"],
		branch: branches.find((b) => b.id === m.branchId)?.name ?? "",
	};
}

export function adaptApiBooking(
	b: ApiBranchBooking,
	ctx: { services: Service[]; apiBranches: ApiBranch[] },
): Booking {
	const slotDate = b.slot.split("T")[0] ?? b.slot;
	const time = b.slot.includes("T")
		? b.slot.split("T")[1]?.slice(0, 5)
		: b.slot;
	const todayLocal = new Date().toLocaleDateString("sv");
	return {
		id: b.id,
		customer: b.customerName?.trim() || "Customer",
		service:
			ctx.services.find((s) => s.id === b.serviceId)?.name ?? b.serviceId,
		branch:
			ctx.apiBranches.find((br) => br.id === b.branchId)?.name ?? b.branchId,
		date: slotDate === todayLocal ? "Today" : slotDate,
		time,
		duration: ctx.services.find((s) => s.id === b.serviceId)?.duration ?? 60,
		price: b.price - b.discount,
		status: b.status as Booking["status"],
		when: formatRelativeDate(b.createdAt),
	};
}

export function adaptCalendarBooking(
	b: CalendarBooking,
	apiBranches: ApiBranch[],
): Booking {
	const slotDate = b.slot.split("T")[0] ?? b.slot;
	const time = b.slot.includes("T")
		? b.slot.split("T")[1]?.slice(0, 5)
		: b.slot;
	const todayLocal = new Date().toLocaleDateString("sv");
	return {
		id: b.id,
		customer: b.customerName?.trim() || "Customer",
		service: b.serviceName,
		branch: apiBranches.find((br) => br.id === b.branchId)?.name ?? b.branchId,
		date: slotDate === todayLocal ? "Today" : slotDate,
		time,
		duration: b.serviceDuration,
		price: b.price - b.discount,
		status: b.status as Booking["status"],
		when: formatRelativeDate(b.createdAt),
	};
}

export function unwrapSingle<T extends { id: string }>(
	res: { data?: T } | T,
): T {
	return ("data" in res && res.data ? res.data : res) as T;
}

function notificationGroup(createdAt: string): Notification["group"] {
	const d = new Date(createdAt);
	const startOfToday = new Date();
	startOfToday.setHours(0, 0, 0, 0);
	return d >= startOfToday ? "today" : "earlier";
}

export function adaptNotification(n: AppNotification): Notification {
	return {
		id: n.id,
		type: n.type,
		group: notificationGroup(n.createdAt),
		unread: !n.readAt,
		title: n.title,
		body: n.body,
		when: formatRelativeDate(n.createdAt),
		go: n.go ?? undefined,
	};
}

export type OrderLineVM = {
	id: string;
	name: string;
	quantity: number;
	unitPrice: number;
	lineTotal: number;
};

/** Resolve an order item's product name from the owner's commerce catalog. */
export function adaptOrderLine(
	item: OrderItem,
	products: Product[],
): OrderLineVM {
	const product = products.find((p) => p.id === item.productId);
	return {
		id: item.id,
		name: product?.name ?? "Unknown product",
		quantity: item.quantity,
		unitPrice: item.unitPrice,
		lineTotal: item.unitPrice * item.quantity,
	};
}
