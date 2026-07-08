import type {
	Booking as ApiBooking,
	Branch as ApiBranch,
	Coupon as ApiCoupon,
	Review as ApiReview,
	Service as ApiService,
	TeamMember as ApiTeamMember,
} from "@repo/api-client";
import type {
	Booking,
	Coupon,
	Review,
	Service,
	TeamMember,
} from "@/components/data";

export function formatDate(iso: string): string {
	const d = new Date(iso);
	const diff = Math.floor((Date.now() - d.getTime()) / 1000);
	if (diff < 60) return "Just now";
	if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
	if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
	if (diff < 172800) return "Yesterday";
	return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function adaptBooking(
	b: ApiBooking,
	services: Service[],
	branches: ApiBranch[],
): Booking {
	const svc = services.find((s) => s.id === b.serviceId);
	const branch = branches.find((br) => br.id === b.branchId);
	const slotDate = new Date(b.slot);
	return {
		id: b.id,
		customer: "Customer",
		service: svc?.name ?? b.serviceId,
		branch: branch?.name ?? b.branchId,
		date: slotDate.toLocaleDateString("en-IN", {
			weekday: "short",
			day: "numeric",
			month: "short",
		}),
		time: slotDate.toLocaleTimeString("en-IN", {
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		}),
		slot: b.slot,
		duration: svc?.duration ?? 0,
		price: b.price,
		status: b.status as Booking["status"],
		when: formatDate(b.createdAt),
	};
}

export function adaptService(s: ApiService, branches: ApiBranch[]): Service {
	return {
		id: s.id,
		name: s.name,
		branch: branches.find((b) => b.id === s.branchId)?.name ?? s.branchId,
		category: s.category,
		duration: s.duration,
		price: s.price,
		desc: s.description ?? "",
		photoUrl: s.photoUrl,
	};
}

export function adaptReview(r: ApiReview): Review {
	return {
		id: r.id,
		name: "Customer",
		service: r.serviceId,
		rating: r.rating,
		date: formatDate(r.createdAt),
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
		expires: new Date(c.expiresAt).toLocaleDateString("en-IN", {
			day: "numeric",
			month: "short",
			year: "numeric",
		}),
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
		email: "",
		phone: "",
	};
}
