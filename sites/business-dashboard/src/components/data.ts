export type Booking = {
	id: string;
	customer: string;
	service: string;
	branch: string;
	date: string;
	time: string;
	slot: string;
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
	desc: string;
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

export const NAV = [
	{ id: "overview", label: "Overview", icon: "LayoutDashboard" },
	{ id: "bookings", label: "Bookings", icon: "CalendarCheck" },
	{ id: "calendar", label: "Calendar", icon: "Calendar" },
	{ id: "services", label: "Services", icon: "Sparkles" },
	{ id: "analytics", label: "Analytics", icon: "BarChart2" },
	{ id: "reviews", label: "Reviews", icon: "MessageSquareQuote" },
	{ id: "coupons", label: "Coupons", icon: "Ticket" },
	{ id: "customers", label: "Customers", icon: "Users2" },
	{ id: "campaigns", label: "Campaigns", icon: "Megaphone" },
	{ id: "team", label: "Team", icon: "Users" },
	{ id: "settings", label: "Business settings", icon: "Settings" },
];

export const money = (n: number) => `৳${n.toLocaleString("en-BD")}`;

// ---- Team ----
export type TeamMember = {
	id: string;
	name: string;
	title: string;
	role: "Owner" | "Manager" | "Staff";
	branch: string;
	email: string;
	phone?: string;
};

// ---- Business settings ----
export type Branch = {
	id: string;
	name: string;
	address: string;
	city: string;
	phone: string;
	services: number;
	staff: number;
	isMain: boolean;
};
