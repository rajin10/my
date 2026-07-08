// Pagination — API uses `query` key (not `meta`)
export interface PaginationMeta {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
	data: T[];
	query: PaginationMeta;
}

export interface SingleResponse<T> {
	data: T;
}

// ─── Domain types (match API schema exactly) ─────────────────────────────────

export type UserRole = "user" | "staff" | "manager" | "owner" | "moderator";

/**
 * Origin of a Google sign-in. The server maps it to the account role to provision
 * (`marketing-site`/`mobile-app` → user, `business-app` → owner). Each client sends
 * its own value explicitly — the server default is a safety net, not a contract.
 * See API ADR 0002.
 */
export type SignInSource = "marketing-site" | "mobile-app" | "business-app";

export interface User {
	id: string;
	email: string | null;
	phone: string | null;
	name: string;
	role: UserRole;
	googleId: string | null;
	photoUrl: string | null;
	createdAt: string;
	updatedAt: string | null;
}

export interface AuthMethods {
	password: boolean;
	google: boolean;
}

export interface AuthUser {
	id: string;
	email: string | null;
	name: string;
	role: UserRole;
	photoUrl?: string | null;
	authMethods?: AuthMethods;
}

export type DeleteAccountProof = { password: string } | { idToken: string };

export interface AuthTokens {
	user: AuthUser;
	accessToken: string;
	refreshToken: string;
	expiresIn: number;
}

export interface GoogleAuthResponse extends AuthTokens {
	isNewUser: boolean;
}

export type BusinessStatus = "Draft" | "Active" | "Suspended";

export type BusinessVertical = "booking" | "commerce";

/**
 * Full custom white-label palette (ADR-0003): the four owner-chosen seed roles
 * (`primary`, `accent`, `foreground`, `surface`). `null` on a business means it
 * renders with Talash defaults. Saved palettes are WCAG-AA-validated server-side.
 */
export interface BrandPalette {
	primary: string;
	accent: string;
	foreground: string;
	surface: string;
}

export interface Business {
	id: string;
	name: string;
	category: string;
	city: string;
	vertical: BusinessVertical;
	status: BusinessStatus;
	description: string | null;
	phone: string | null;
	email: string | null;
	website: string | null;
	brandPalette: BrandPalette | null;
	ownerId: string;
	createdAt: string;
	updatedAt: string | null;
}

export interface BusinessPhoto {
	id: string;
	businessId: string;
	url: string;
	order: number;
}

export type AppNotificationType =
	| "booking"
	| "cancel"
	| "review"
	| "system"
	| "order"
	| "order_cancelled";

export interface AppNotification {
	id: string;
	type: AppNotificationType;
	title: string;
	body: string;
	readAt: string | null;
	businessId: string | null;
	bookingId: string | null;
	reviewId: string | null;
	orderId: string | null;
	go: "bookings" | "reviews" | "orders" | null;
	createdAt: string;
}

export interface Branch {
	id: string;
	businessId: string;
	name: string;
	address: string;
	city: string;
	lat: number | null;
	lng: number | null;
	createdAt: string;
	updatedAt: string | null;
}

export interface BranchHours {
	id: string;
	branchId: string;
	dayOfWeek: number;
	openTime: string | null;
	closeTime: string | null;
	isClosed: boolean;
}

export interface Service {
	id: string;
	branchId: string;
	name: string;
	category: string;
	duration: number;
	price: number;
	description: string | null;
	photoUrl: string | null;
	createdAt: string;
	updatedAt: string | null;
}

/** Commerce vertical: a sellable physical good with stock tracked per branch. */
export interface Product {
	id: string;
	branchId: string;
	name: string;
	category: string | null;
	price: number;
	stock: number;
	description: string | null;
	imageUrl: string | null;
	status: "Active" | "Inactive";
	createdAt: string;
	updatedAt: string | null;
}

export type BookingStatus = "Pending" | "Confirmed" | "Cancelled" | "Completed";

export interface Booking {
	id: string;
	userId: string;
	serviceId: string;
	branchId: string;
	businessId: string;
	staffId: string | null;
	slot: string;
	status: BookingStatus;
	price: number;
	discount: number;
	couponCode: string | null;
	createdAt: string;
	updatedAt: string | null;
}

export type ReviewStatus = "Pending" | "Published";

export interface Review {
	id: string;
	userId: string;
	businessId: string;
	serviceId: string;
	bookingId: string | null;
	rating: number;
	text: string;
	status: ReviewStatus;
	userName: string;
	createdAt: string;
	updatedAt: string | null;
}

export interface MyReview {
	id: string;
	userId: string;
	businessId: string;
	serviceId: string;
	bookingId: string | null;
	rating: number;
	text: string;
	status: ReviewStatus;
	businessName: string;
	serviceName: string;
	createdAt: string;
	updatedAt: string | null;
}

export type CouponType = "Percentage" | "Fixed";
export type CouponStatus = "Active" | "Expired";

export interface Coupon {
	id: string;
	businessId: string;
	code: string;
	type: CouponType;
	value: number;
	usedCount: number;
	maxUses: number;
	status: CouponStatus;
	expiresAt: string;
	createdAt: string;
	updatedAt: string | null;
}

export type TeamRole = "Owner" | "Manager" | "Staff";

export interface TeamMember {
	id: string;
	userId: string;
	businessId: string;
	branchId: string | null;
	title: string;
	role: TeamRole;
	userName: string;
	createdAt: string;
	updatedAt: string | null;
}

export interface RewardBalance {
	userId: string;
	balance: number;
}

export interface RewardTransaction {
	id: string;
	userId: string;
	bookingId: string | null;
	type: "credit" | "debit";
	points: number;
	description: string;
	createdAt: string;
}

export interface BusinessResult {
	id: string;
	name: string;
	category: string;
	city: string;
	status: BusinessStatus;
	description: string | null;
	ownerId: string;
	createdAt: string;
	updatedAt: string | null;
}

/** Commerce vertical: order status lifecycle. */
export type OrderStatus =
	| "Pending"
	| "Confirmed"
	| "OutForDelivery"
	| "Delivered"
	| "Cancelled";

export interface OrderItem {
	id: string;
	orderId: string;
	productId: string;
	quantity: number;
	unitPrice: number;
	createdAt: string;
	updatedAt: string | null;
}

export interface Order {
	id: string;
	businessId: string;
	branchId: string;
	userId: string;
	status: OrderStatus;
	total: number;
	deliveryLine: string;
	deliveryArea: string | null;
	deliveryCity: string | null;
	deliveryLat: number | null;
	deliveryLng: number | null;
	deliveredAt: string | null;
	createdAt: string;
	updatedAt: string | null;
}

export interface OrderWithItems extends Order {
	items: OrderItem[];
}

export interface CustomerAddress {
	id: string;
	userId: string;
	label: string | null;
	line: string;
	area: string | null;
	city: string | null;
	lat: number | null;
	lng: number | null;
	isDefault: boolean;
	createdAt: string;
	updatedAt: string | null;
}

export interface Payment {
	id: string;
	businessId: string;
	userId: string;
	amount: number;
	note: string | null;
	recordedBy: string;
	orderId: string | null;
	createdAt: string;
	updatedAt: string | null;
	deletedAt: string | null;
}

export interface KhataDue {
	userId: string;
	name: string;
	due: number;
}

export interface KhataCustomer {
	userId: string;
	name: string;
	due: number;
	totalDelivered: number;
	totalPaid: number;
	deliveredOrders: { id: string; total: number; deliveredAt: string | null }[];
	payments: Payment[];
}
