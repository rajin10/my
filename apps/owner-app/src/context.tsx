import type {
	Booking as ApiBooking,
	Branch as ApiBranch,
	AuthTokens,
	PaginatedResponse,
} from "@repo/api-client";
import type { OutboxMutationType } from "@repo/mobile-query";
import {
	clearOutbox,
	clearPersistedCache,
	OFFLINE_ACTION_MESSAGE,
	OutboxSyncProvider,
	queueOrRunSync,
	useNetworkStatus,
	useOnlineGuard,
} from "@repo/mobile-query";
import { clearWalkInQueue } from "@repo/walk-in-sync";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import type React from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { SetupFormData } from "./components/SetupFlow";
import {
	type Booking,
	type Business,
	type Coupon,
	type Notification,
	nextBusinessStatus,
	type Product,
	type Review,
	type Service,
	type TeamMember,
} from "./data";
import {
	useBusinessPhotos,
	useMarkAllNotificationsRead,
	useMarkNotificationRead,
	useNotifications,
} from "./hooks/useOwnerData";
import {
	adaptApiBooking,
	adaptCoupon,
	adaptNotification,
	adaptProduct,
	adaptReview,
	adaptService,
	adaptTeamMember,
	unwrapSingle,
} from "./lib/adapters";
import { api, authEvents } from "./lib/api";
import { tokenStore } from "./lib/native-token-store";
import { createOwnerOutboxExecutors } from "./lib/outbox-executors";
import { registerPushToken } from "./lib/push";
import { OWNER_APP_ID } from "./lib/query-client";

const DEFAULT_BUSINESS: Business = {
	name: "",
	category: "",
	city: "",
	status: "Draft",
	// Default to booking so existing salon/spa owners see the Services catalog with
	// no flicker during the load window before businessQuery resolves (ADR-0004).
	vertical: "booking",
	rating: 0,
	reviews: 0,
	description: "",
	branches: [],
	photos: [],
	owner: { name: "", role: "Owner", email: "" },
};

// ── Types ─────────────────────────────────────────────────────────────────────

export type TabId = "today" | "bookings" | "services" | "reviews" | "more";
export type OverlayId =
	| "notifications"
	| "business"
	| "team"
	| "coupons"
	| "account"
	| "help"
	| "analytics"
	| "calendar"
	| "customers"
	| "campaigns"
	| "orders"
	| "khata"
	| "branding";
export type SheetType =
	| { type: "booking"; b: Booking }
	| { type: "addService"; service?: Service }
	| { type: "addProduct"; product?: Product }
	| { type: "addStaff"; member?: TeamMember }
	| { type: "addBranch" }
	| {
			type: "editBranch";
			branchId: string;
			name: string;
			address: string;
			city: string;
	  }
	| { type: "branchHours"; branchId: string; branchName: string }
	| { type: "editBusiness" }
	| { type: "createCoupon" }
	| { type: "couponDetail"; coupon: Coupon }
	| { type: "editProfile"; userId: string; name: string; email: string }
	| { type: "staffAvailability"; teamMemberId: string; memberName: string }
	| { type: "orderDetail"; orderId: string }
	| {
			type: "recordPayment";
			businessId: string;
			userId: string;
			customerName: string;
			due: number;
	  };
export type CommsType = { type: "chat" | "call"; b: Booking };
export type ToastData = {
	msg: string;
	icon?: string;
	tone?: "success" | "danger" | "info";
};

const TAB_ROUTES: Record<TabId, string> = {
	today: "/(tabs)",
	bookings: "/(tabs)/bookings",
	services: "/(tabs)/services",
	reviews: "/(tabs)/reviews",
	more: "/(tabs)/more",
};

type AppCtx = {
	contact: string;
	enterExisting: () => void;
	goLive: (form: SetupFormData) => Promise<void>;
	handleAuthed: (tokens: AuthTokens) => void;
	signOut: () => void;

	setTab: (t: TabId) => void;
	setOverlay: (o: OverlayId | null) => void;
	sheet: SheetType | null;
	setSheet: (s: SheetType | null) => void;
	comms: CommsType | null;
	setComms: (c: CommsType | null) => void;

	businessId: string | null;
	apiBranches: ApiBranch[];
	business: Business;
	status: "Active" | "Draft" | "Suspended";
	toggleStatus: () => void;
	updateBusiness: (v: Partial<Business>) => void;
	appendBusinessPhotoUrl: (url: string) => void;
	addBranchToBusiness: (name: string, area?: string) => Promise<void>;

	branch: string;
	setBranch: (b: string) => void;
	filter: string;
	setFilter: (f: string) => void;

	bookings: Booking[];
	services: Service[];
	products: Product[];
	reviews: Review[];
	coupons: Coupon[];
	team: TeamMember[];
	notifs: Notification[];

	confirmBooking: (id: string) => void;
	declineBooking: (id: string) => void;
	cancelBooking: (id: string) => void;
	completeBooking: (id: string) => void;
	assignStaff: (bookingId: string, staffId: string) => void;

	addService: (s: Omit<Service, "id">) => Promise<void>;
	updateService: (id: string, s: Partial<Service>) => Promise<void>;
	removeService: (id: string) => void;

	addProduct: (p: Omit<Product, "id">) => Promise<void>;
	updateProduct: (id: string, p: Partial<Product>) => Promise<void>;
	removeProduct: (id: string) => void;

	approveReview: (id: string) => void;
	rejectReview: (id: string) => void;

	createCoupon: (
		c: Omit<Coupon, "id" | "used" | "status" | "expires">,
	) => Promise<void>;
	toggleCoupon: (id: string) => void;

	addStaff: (params: {
		userId: string;
		title: string;
		role: "Manager" | "Staff";
		branchId: string;
	}) => void;
	updateStaff: (id: string, m: Partial<TeamMember>) => void;
	removeStaff: (id: string) => void;

	hasUnread: boolean;
	readAll: () => void;
	tapNotif: (n: Notification) => void;

	toast: ToastData | null;
	flash: (msg: string, opts?: Partial<ToastData>) => void;

	greeting: string;
	pendingCount: number;
	pendingReviews: number;
};

// biome-ignore lint/style/noNonNullAssertion: standard React context pattern; useApp() guards access
const Ctx = createContext<AppCtx>(null!);

export function AppProvider({ children }: { children: React.ReactNode }) {
	const qc = useQueryClient();

	const [isAuthed, setIsAuthed] = useState(() => !!tokenStore.getAccessToken());
	useEffect(() => {
		if (tokenStore.getAccessToken()) setIsAuthed(true);
	}, []);

	useEffect(() => {
		authEvents.setOnUnauthorized(() => {
			setIsAuthed(false);
			setBusinessId(null);
			qc.clear();
			clearPersistedCache(OWNER_APP_ID);
			clearOutbox(OWNER_APP_ID);
			router.replace("/(auth)/sign-in");
		});
	}, [qc]);
	const [contact, setContact] = useState("");
	const [sheet, setSheet] = useState<SheetType | null>(null);
	const [comms, setComms] = useState<CommsType | null>(null);
	const [toast, setToast] = useState<ToastData | null>(null);
	const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const ensureOnline = useOnlineGuard((message) => {
		setToast({ msg: message, tone: "info" });
		if (toastRef.current) clearTimeout(toastRef.current);
		toastRef.current = setTimeout(() => setToast(null), 2600);
	});
	const { isOnline } = useNetworkStatus();
	const statusPendingRef = useRef(false);
	const businessPendingRef = useRef(false);
	const [businessId, setBusinessId] = useState<string | null>(null);
	const [branch, setBranch] = useState("All branches");
	const [filter, setFilter] = useState("Pending");
	const [localBusiness, setLocalBusiness] = useState<Business>({
		...DEFAULT_BUSINESS,
	});
	const [status, setStatus] = useState<"Active" | "Draft" | "Suspended">(
		"Draft",
	);

	// ── Server queries ────────────────────────────────────────────────────────

	const businessQuery = useQuery({
		queryKey: ["business", "owner"],
		queryFn: async () => {
			const res = await api.businesses.list({ limit: 1 });
			return res.data[0] ?? null;
		},
		enabled: isAuthed,
		staleTime: 60_000,
	});

	const meQuery = useQuery({
		queryKey: ["auth", "me"],
		queryFn: () => api.auth.me(),
		enabled: isAuthed,
		staleTime: 5 * 60_000,
	});

	useEffect(() => {
		if (meQuery.data) {
			const u = meQuery.data;
			setLocalBusiness((v) => ({
				...v,
				owner: { name: u.name, role: "Owner", email: u.email ?? contact },
			}));
		}
	}, [meQuery.data, contact]);

	useEffect(() => {
		if (businessQuery.data) {
			setBusinessId(businessQuery.data.id);
			setLocalBusiness((v) => ({
				...v,
				name: businessQuery.data?.name,
				category: businessQuery.data?.category,
				city: businessQuery.data?.city,
				description: businessQuery.data?.description ?? v.description,
				vertical: businessQuery.data?.vertical ?? v.vertical,
			}));
			setStatus(businessQuery.data.status as "Active" | "Draft" | "Suspended");
		}
	}, [businessQuery.data]);

	const businessPhotosQuery = useBusinessPhotos(businessId);

	const businessContentQuery = useQuery({
		queryKey: ["business-content", businessId],
		queryFn: async () => {
			// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
			const branchesRes = await api.branches.list(businessId!, { limit: 50 });
			const apiBranches = branchesRes.data;
			const serviceResults = await Promise.all(
				apiBranches.map((b) => api.services.list(b.id, { limit: 100 })),
			);
			return {
				branches: apiBranches,
				services: serviceResults.flatMap((r) => r.data),
			};
		},
		enabled: !!businessId,
		staleTime: 30_000,
	});

	useEffect(() => {
		const photos = businessPhotosQuery.data?.map((p) => p.url) ?? [];
		if (photos.length > 0) {
			setLocalBusiness((v) => ({ ...v, photos }));
		}
	}, [businessPhotosQuery.data]);

	const apiBranches = businessContentQuery.data?.branches ?? [];
	const services: Service[] = (businessContentQuery.data?.services ?? []).map(
		(s) => adaptService(s, apiBranches),
	);

	// Commerce catalog: only fetched for commerce businesses (ADR-0004). Booking
	// businesses never pay for this round-trip; commerce businesses harmlessly
	// over-fetch the (empty) services list above for #71.
	const isCommerce = localBusiness.vertical === "commerce";
	const productsQuery = useQuery({
		queryKey: ["business-products", businessId],
		queryFn: async () => {
			// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
			const branchesRes = await api.branches.list(businessId!, { limit: 50 });
			const branches = branchesRes.data;
			const productResults = await Promise.all(
				branches.map((b) => api.products.list(b.id, { limit: 100 })),
			);
			return {
				branches,
				products: productResults.flat(),
			};
		},
		enabled: !!businessId && isCommerce,
		staleTime: 30_000,
	});

	const products: Product[] = (productsQuery.data?.products ?? []).map((p) =>
		adaptProduct(p, productsQuery.data?.branches ?? apiBranches),
	);

	useEffect(() => {
		const branches = businessContentQuery.data?.branches ?? [];
		if (branches.length > 0) {
			setLocalBusiness((v) => ({
				...v,
				branches: branches.map((b) => b.name),
			}));
		}
	}, [businessContentQuery.data]);

	const bookingsQuery = useQuery({
		queryKey: ["bookings", "branch", businessId],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () =>
			api.bookings.listBranch({ businessId: businessId!, limit: 50 }),
		enabled: !!businessId,
		staleTime: 15_000,
	});

	const bookings: Booking[] = (bookingsQuery.data?.data ?? []).map((b) =>
		adaptApiBooking(b, { services, apiBranches }),
	);

	const pendingCount = bookings.filter((b) => b.status === "Pending").length;

	const pendingReviewsQuery = useQuery({
		queryKey: ["reviews", "pending", businessId],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () =>
			api.reviews.listPending({ businessId: businessId!, limit: 50 }),
		enabled: isAuthed && !!businessId,
		staleTime: 30_000,
	});

	const publishedReviewsQuery = useQuery({
		queryKey: ["reviews", "business", businessId],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.reviews.list({ businessId: businessId!, limit: 50 }),
		enabled: !!businessId,
		staleTime: 30_000,
	});

	const reviews: Review[] = [
		...(pendingReviewsQuery.data ?? []),
		...(publishedReviewsQuery.data?.data ?? []).filter(
			(r) => r.status === "Published",
		),
	].map((r) => adaptReview(r, services));
	const pendingReviews = reviews.filter((r) => r.status === "Pending").length;

	const couponsQuery = useQuery({
		queryKey: ["coupons", businessId],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.coupons.list({ businessId: businessId!, limit: 100 }),
		enabled: !!businessId,
		staleTime: 30_000,
	});

	const coupons: Coupon[] = (couponsQuery.data?.data ?? []).map(adaptCoupon);

	const teamQuery = useQuery({
		queryKey: ["team", businessId],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.team.list({ businessId: businessId!, limit: 50 }),
		enabled: !!businessId,
		staleTime: 60_000,
	});

	const team: TeamMember[] = (teamQuery.data?.data ?? []).map((m) =>
		adaptTeamMember(m, apiBranches),
	);

	const notificationsQuery = useNotifications();
	const markNotifReadMut = useMarkNotificationRead();
	const markAllNotifsMut = useMarkAllNotificationsRead();
	const notifs: Notification[] = (notificationsQuery.data ?? []).map(
		adaptNotification,
	);

	// ── Mutations ────────────────────────────────────────────────────────────

	async function applyBookingStatusOptimistic(
		id: string,
		status: ApiBooking["status"],
	) {
		await qc.cancelQueries({ queryKey: ["bookings"] });
		const previous = qc.getQueryData(["bookings", "branch", businessId]);
		qc.setQueryData(
			["bookings", "branch", businessId],
			(old: PaginatedResponse<ApiBooking> | undefined) => {
				if (!old?.data) return old;
				return {
					...old,
					data: old.data.map((b: ApiBooking) =>
						b.id === id ? { ...b, status } : b,
					),
				};
			},
		);
		return { previous };
	}

	function queueOrMutate(args: {
		mutationType: OutboxMutationType;
		payload: unknown;
		onlineMutate: () => void;
		optimistic?: () => void | Promise<void>;
	}) {
		queueOrRunSync({
			appId: OWNER_APP_ID,
			mutationType: args.mutationType,
			payload: args.payload,
			isOnline,
			onOnline: args.onlineMutate,
			onQueued: () => {
				void args.optimistic?.();
				flash("Saved offline — will sync when you're back online.", {
					tone: "info",
					icon: "CloudOff",
				});
			},
			onBlocked: () => flash(OFFLINE_ACTION_MESSAGE, { tone: "info" }),
		});
	}

	const confirmMut = useMutation({
		mutationFn: (id: string) => api.bookings.confirm(id),
		onMutate: async (id) => {
			const ctx = await applyBookingStatusOptimistic(id, "Confirmed");
			return ctx;
		},
		onError: (_e, _id, ctx) => {
			if (ctx?.previous)
				qc.setQueryData(["bookings", "branch", businessId], ctx.previous);
			flash("Failed to confirm booking", { tone: "danger" });
		},
		onSuccess: () =>
			flash("Booking confirmed — customer notified.", {
				tone: "success",
				icon: "CheckCircle",
			}),
		onSettled: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
	});
	const cancelMut = useMutation({
		mutationFn: (id: string) => api.bookings.cancel(id),
		onMutate: async (id) => {
			const ctx = await applyBookingStatusOptimistic(id, "Cancelled");
			return ctx;
		},
		onError: (_e, _id, ctx) => {
			if (ctx?.previous)
				qc.setQueryData(["bookings", "branch", businessId], ctx.previous);
			flash("Failed to cancel booking", { tone: "danger" });
		},
		onSuccess: () =>
			flash("Booking cancelled — customer notified.", {
				tone: "danger",
				icon: "XCircle",
			}),
		onSettled: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
	});
	const completeMut = useMutation({
		mutationFn: (id: string) => api.bookings.complete(id),
		onMutate: async (id) => {
			const ctx = await applyBookingStatusOptimistic(id, "Completed");
			return ctx;
		},
		onError: (_e, _id, ctx) => {
			if (ctx?.previous)
				qc.setQueryData(["bookings", "branch", businessId], ctx.previous);
			flash("Failed to mark booking complete", { tone: "danger" });
		},
		onSuccess: () =>
			flash("Booking marked complete.", {
				tone: "success",
				icon: "CheckCheck",
			}),
		onSettled: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
	});
	const assignMut = useMutation({
		mutationFn: ({ id, staffId }: { id: string; staffId: string }) =>
			api.bookings.assign(id, { staffId }),
		onSuccess: () =>
			flash("Staff assigned to booking.", {
				tone: "success",
				icon: "UserCheck",
			}),
		onError: (e: Error) => flash(e.message, { tone: "danger" }),
		onSettled: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
	});
	const approveMut = useMutation({
		mutationFn: (id: string) => api.reviews.approve(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["reviews"] });
			flash("Review published to your profile.", {
				tone: "success",
				icon: "CheckCircle",
			});
		},
		onError: (e: Error) => flash(e.message, { tone: "danger" }),
	});
	const rejectMut = useMutation({
		mutationFn: (id: string) => api.reviews.reject(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["reviews"] });
			flash("Review rejected.", { tone: "danger", icon: "X" });
		},
		onError: (e: Error) => flash(e.message, { tone: "danger" }),
	});
	const deleteServiceMut = useMutation({
		mutationFn: (id: string) => api.services.delete(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["business-content"] });
			flash("Service removed.", { icon: "Trash2" });
		},
		onError: (e: Error) => flash(e.message, { tone: "danger" }),
	});
	const createServiceMut = useMutation({
		mutationFn: (body: {
			branchId: string;
			name: string;
			category: string;
			duration: number;
			price: number;
			description?: string;
		}) => api.services.create(body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["business-content"] });
			flash("Service added to your menu.", { icon: "Sparkles" });
		},
		onError: (e: Error) => flash(e.message, { tone: "danger" }),
	});
	const deleteProductMut = useMutation({
		mutationFn: (id: string) => api.products.delete(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["business-products"] });
			flash("Product removed.", { icon: "Trash2" });
		},
		onError: (e: Error) => flash(e.message, { tone: "danger" }),
	});
	const createProductMut = useMutation({
		mutationFn: (body: {
			branchId: string;
			name: string;
			category?: string;
			price: number;
			stock?: number;
			description?: string;
			status?: "Active" | "Inactive";
		}) => api.products.create(body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["business-products"] });
			flash("Product added to your catalog.", { icon: "Package" });
		},
		onError: (e: Error) => flash(e.message, { tone: "danger" }),
	});
	const createCouponMut = useMutation({
		mutationFn: (body: {
			businessId: string;
			code: string;
			type: "Percentage" | "Fixed";
			value: number;
			maxUses: number;
			expiresAt: string;
		}) => api.coupons.create(body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["coupons"] });
			flash("Coupon created and active.", { icon: "Ticket" });
		},
		onError: (e: Error) => flash(e.message, { tone: "danger" }),
	});
	const deleteCouponMut = useMutation({
		mutationFn: (id: string) => api.coupons.delete(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["coupons"] });
			flash("Coupon deactivated.", { icon: "Ticket" });
		},
		onError: (e: Error) => flash(e.message, { tone: "danger" }),
	});
	const removeTeamMut = useMutation({
		mutationFn: (id: string) => api.team.remove(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["team"] });
			flash("Teammate removed.", { icon: "UserMinus" });
		},
		onError: (e: Error) => flash(e.message, { tone: "danger" }),
	});

	// ── Helpers ──────────────────────────────────────────────────────────────

	function flash(msg: string, opts: Partial<ToastData> = {}) {
		setToast({ msg, ...opts });
		if (toastRef.current) clearTimeout(toastRef.current);
		toastRef.current = setTimeout(() => setToast(null), 2600);
	}

	async function handleAuthed(tokens: AuthTokens) {
		await tokenStore.setTokens(tokens.accessToken, tokens.refreshToken);
		setContact(tokens.user.email ?? "");
		setIsAuthed(true);
		registerPushToken();
		try {
			const res = await api.businesses.list({ limit: 1 });
			const business = res.data[0] ?? null;
			if (!business) {
				router.replace("/(setup)/");
			} else {
				router.replace("/(tabs)");
			}
		} catch {
			router.replace("/(setup)/");
		}
	}

	async function signOut() {
		try {
			await api.auth.logout();
		} catch {
			/* ignore */
		}
		await tokenStore.clearTokens();
		qc.clear();
		clearPersistedCache(OWNER_APP_ID);
		clearOutbox(OWNER_APP_ID);
		clearWalkInQueue(OWNER_APP_ID);
		setIsAuthed(false);
		setBusinessId(null);
		setSheet(null);
		setComms(null);
		router.replace("/(auth)/sign-in");
	}

	function enterExisting() {
		router.replace("/(tabs)");
	}

	async function goLive(f: SetupFormData) {
		if (!ensureOnline()) return;
		let partialBusinessId: string | undefined;
		try {
			const businessRes = await api.businesses.create({
				vertical: "booking",
				name: f.businessName.trim(),
				category: f.category,
				city: f.city.trim(),
				description: f.description.trim() || undefined,
				status: "Draft",
			});
			const business = unwrapSingle(businessRes);
			partialBusinessId = business.id;

			// Branches are independent — create them concurrently, then build the
			// name → id map from the results so services can resolve their branch.
			const createdBranches = await Promise.all(
				f.branches.map(async (b) => {
					const branchRes = await api.branches.create({
						businessId: business.id,
						name: b.name.trim(),
						address: b.area.trim() || b.name.trim(),
						city: f.city.trim(),
					});
					return [b.name.trim(), unwrapSingle(branchRes).id] as const;
				}),
			);
			const branchIds = new Map<string, string>(createdBranches);

			// A service whose branch name resolves to no created branch can't be
			// created; we skip it below but must tell the owner rather than report a
			// clean success. (The setup picker normally constrains branch names.)
			const skippedService = f.services.some(
				(s) => !branchIds.get(s.branch.trim()),
			);

			// Each service only needs its own branch id — create them concurrently too.
			await Promise.all(
				f.services.map(async (s) => {
					const branchId = branchIds.get(s.branch.trim());
					if (!branchId) return;
					await api.services.create({
						branchId,
						name: s.name,
						category: s.category,
						duration: s.duration,
						price: s.price,
						description: s.desc,
					});
				}),
			);

			await qc.invalidateQueries({ queryKey: ["business", "owner"] });
			await qc.invalidateQueries({ queryKey: ["business-content"] });

			setLocalBusiness({
				name: f.businessName.trim(),
				category: f.category,
				city: f.city.trim(),
				status: "Draft",
				vertical: "booking",
				rating: 0,
				reviews: 0,
				description:
					f.description.trim() ||
					`${f.businessName.trim()} on Talash — now taking bookings.`,
				branches: f.branches.map((b) => b.name),
				photos: [],
				owner: {
					name: f.ownerName.trim(),
					role: "Owner",
					email: contact || "owner@email.com",
				},
			});
			setBusinessId(business.id);
			setStatus("Draft");
			setBranch("All branches");
			setFilter("Pending");
			if (skippedService) {
				flash("Business created — some items may need to be added manually.", {
					tone: "danger",
				});
			} else {
				flash("Business created — go live from settings when ready.", {
					tone: "success",
					icon: "Sparkles",
				});
			}
			router.replace("/(tabs)");
		} catch (e: unknown) {
			if (partialBusinessId) {
				// Business (and possibly branches) were created before the failure.
				// Navigate to tabs so the user doesn't re-submit and create a duplicate.
				setBusinessId(partialBusinessId);
				await qc.invalidateQueries({ queryKey: ["business", "owner"] });
				await qc.invalidateQueries({ queryKey: ["business-content"] });
				flash("Business created — some items may need to be added manually.", {
					tone: "danger",
				});
				router.replace("/(tabs)");
			} else {
				flash((e as Error).message ?? "Setup failed", { tone: "danger" });
			}
		}
	}

	function setTab(t: TabId) {
		router.navigate(TAB_ROUTES[t] as never);
	}

	function setOverlay(id: OverlayId | null) {
		if (id === null) {
			if (router.canGoBack()) router.back();
			else router.replace("/(tabs)");
		} else {
			router.push(`/${id}` as never);
		}
	}

	function toggleStatus() {
		if (!businessId || statusPendingRef.current || !ensureOnline()) return;
		const next = nextBusinessStatus(status);
		// Suspended businesses can only be lifted by Talash — the owner toggle is a no-op.
		if (!next) return;
		statusPendingRef.current = true;
		api.businesses
			.update(businessId, { status: next })
			.then(() => {
				setStatus(next);
				qc.invalidateQueries({ queryKey: ["business", "owner"] });
				flash(
					next === "Active"
						? "You're live — visible to customers."
						: "Switched to Draft — hidden from customers.",
					{ icon: next === "Active" ? "CircleCheck" : "CircleDashed" },
				);
			})
			.catch((e: Error) => flash(e.message, { tone: "danger" }))
			.finally(() => {
				statusPendingRef.current = false;
			});
	}

	function appendBusinessPhotoUrl(url: string) {
		setLocalBusiness((v) => ({ ...v, photos: [...v.photos, url] }));
		if (businessId)
			qc.invalidateQueries({ queryKey: ["business-photos", businessId] });
	}

	function updateBusiness(v: Partial<Business>) {
		if (!businessId || businessPendingRef.current || !ensureOnline()) return;
		businessPendingRef.current = true;
		api.businesses
			.update(businessId, {
				name: v.name,
				category: v.category,
				city: v.city,
				description: v.description,
			})
			.then(() => {
				setLocalBusiness((prev) => ({ ...prev, ...v }));
				setSheet(null);
				qc.invalidateQueries({ queryKey: ["business", "owner"] });
				flash("Business profile updated.", {
					tone: "success",
					icon: "CheckCircle",
				});
			})
			.catch((e: Error) => flash(e.message, { tone: "danger" }))
			.finally(() => {
				businessPendingRef.current = false;
			});
	}

	async function addBranchToBusiness(name: string, area?: string) {
		if (!businessId || !ensureOnline()) return;
		try {
			await api.branches.create({
				businessId,
				name: name.trim(),
				address: area?.trim() || name.trim(),
				city: localBusiness.city || "Dhaka",
			});
			qc.invalidateQueries({ queryKey: ["business-content"] });
			setSheet(null);
			flash(`${name} branch added.`, { tone: "success", icon: "MapPin" });
		} catch (e: unknown) {
			flash((e as Error).message, { tone: "danger" });
		}
	}

	function confirmBooking(id: string) {
		queueOrMutate({
			mutationType: "bookings.confirm",
			payload: { id },
			onlineMutate: () => confirmMut.mutate(id),
			optimistic: () => applyBookingStatusOptimistic(id, "Confirmed"),
		});
	}
	function declineBooking(id: string) {
		queueOrMutate({
			mutationType: "bookings.cancel",
			payload: { id },
			onlineMutate: () => cancelMut.mutate(id),
			optimistic: () => applyBookingStatusOptimistic(id, "Cancelled"),
		});
	}
	function cancelBooking(id: string) {
		queueOrMutate({
			mutationType: "bookings.cancel",
			payload: { id },
			onlineMutate: () => cancelMut.mutate(id),
			optimistic: () => applyBookingStatusOptimistic(id, "Cancelled"),
		});
	}
	function completeBooking(id: string) {
		queueOrMutate({
			mutationType: "bookings.complete",
			payload: { id },
			onlineMutate: () => completeMut.mutate(id),
			optimistic: () => applyBookingStatusOptimistic(id, "Completed"),
		});
	}
	function assignStaff(bookingId: string, staffId: string) {
		queueOrMutate({
			mutationType: "bookings.assign",
			payload: { id: bookingId, staffId },
			onlineMutate: () => assignMut.mutate({ id: bookingId, staffId }),
		});
	}

	async function addService(s: Omit<Service, "id">) {
		if (!ensureOnline()) return;
		const branchId = apiBranches.find((b) => b.name === s.branch)?.id;
		if (!branchId) {
			flash("Branch not found.", { tone: "danger" });
			return;
		}
		try {
			await createServiceMut.mutateAsync({
				branchId,
				name: s.name,
				category: s.category,
				duration: s.duration,
				price: s.price,
				description: s.desc,
			});
			setSheet(null);
		} catch {
			// createServiceMut.onError already surfaces the failure via flash()
		}
	}

	async function updateService(id: string, s: Partial<Service>) {
		if (!ensureOnline()) return;
		try {
			await api.services.update(id, {
				name: s.name,
				category: s.category,
				duration: s.duration,
				price: s.price,
				description: s.desc,
			});
			qc.invalidateQueries({ queryKey: ["business-content"] });
			flash("Service updated.", { tone: "success", icon: "CheckCircle" });
			setSheet(null);
		} catch (e: unknown) {
			flash((e as Error).message, { tone: "danger" });
		}
	}

	function removeService(id: string) {
		if (!ensureOnline()) return;
		deleteServiceMut.mutate(id);
	}

	async function addProduct(p: Omit<Product, "id">) {
		if (!ensureOnline()) return;
		const branchId = apiBranches.find((b) => b.name === p.branch)?.id;
		if (!branchId) {
			flash("Branch not found.", { tone: "danger" });
			return;
		}
		try {
			await createProductMut.mutateAsync({
				branchId,
				name: p.name,
				category: p.category ?? undefined,
				price: p.price,
				stock: p.stock,
				description: p.desc,
				status: p.status,
			});
			setSheet(null);
		} catch {
			// createProductMut.onError already surfaces the failure via flash()
		}
	}

	async function updateProduct(id: string, p: Partial<Product>) {
		if (!ensureOnline()) return;
		try {
			await api.products.update(id, {
				name: p.name,
				category: p.category ?? undefined,
				price: p.price,
				stock: p.stock,
				description: p.desc,
				status: p.status,
			});
			qc.invalidateQueries({ queryKey: ["business-products"] });
			flash("Product updated.", { tone: "success", icon: "CheckCircle" });
			setSheet(null);
		} catch (e: unknown) {
			flash((e as Error).message, { tone: "danger" });
		}
	}

	function removeProduct(id: string) {
		if (!ensureOnline()) return;
		deleteProductMut.mutate(id);
	}

	function approveReview(id: string) {
		if (!ensureOnline()) return;
		approveMut.mutate(id);
	}
	function rejectReview(id: string) {
		if (!ensureOnline()) return;
		rejectMut.mutate(id);
	}

	async function createCoupon(
		c: Omit<Coupon, "id" | "used" | "status" | "expires">,
	) {
		if (!businessId || !ensureOnline()) return;
		const oneYearFromNow = new Date();
		oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
		try {
			await createCouponMut.mutateAsync({
				businessId,
				code: c.code,
				type: c.type,
				value: c.value,
				maxUses: c.max,
				expiresAt: oneYearFromNow.toISOString(),
			});
			setSheet(null);
		} catch {
			// createCouponMut.onError already surfaces the failure via flash()
		}
	}

	function toggleCoupon(id: string) {
		if (!ensureOnline()) return;
		deleteCouponMut.mutate(id);
	}

	async function addStaff(params: {
		userId: string;
		title: string;
		role: "Manager" | "Staff";
		branchId: string;
	}) {
		if (!businessId || !ensureOnline()) return;
		try {
			await api.team.add({
				userId: params.userId,
				businessId,
				role: params.role,
				title: params.title,
				branchId: params.branchId,
			});
			qc.invalidateQueries({ queryKey: ["team"] });
			flash("Team member added.", { tone: "success", icon: "UserPlus" });
			setSheet(null);
		} catch (e: unknown) {
			flash((e as Error).message ?? "Failed to add team member", {
				tone: "danger",
			});
		}
	}
	function updateStaff(id: string, m: Partial<TeamMember>) {
		if (!ensureOnline()) return;
		const branchId = m.branch
			? apiBranches.find((b) => b.name === m.branch)?.id
			: undefined;
		api.team
			.update(id, { role: m.role as never, title: m.title, branchId })
			.then(() => {
				qc.invalidateQueries({ queryKey: ["team"] });
				flash("Teammate updated.", { tone: "success", icon: "CheckCircle" });
				setSheet(null);
			})
			.catch((e: Error) => flash(e.message, { tone: "danger" }));
	}
	function removeStaff(id: string) {
		if (!ensureOnline()) return;
		removeTeamMut.mutate(id);
	}

	const hasUnread = notifs.some((n) => n.unread);
	function readAll() {
		queueOrMutate({
			mutationType: "notifications.markAllRead",
			payload: {},
			onlineMutate: () =>
				markAllNotifsMut.mutate(undefined, {
					onError: (e: Error) => flash(e.message, { tone: "danger" }),
				}),
		});
	}
	function tapNotif(n: Notification) {
		if (n.unread) {
			queueOrMutate({
				mutationType: "notifications.markRead",
				payload: { id: n.id },
				onlineMutate: () => markNotifReadMut.mutate(n.id),
			});
		}
		setOverlay(null);
		if (n.go === "bookings") {
			setTab("bookings");
			return;
		}
		if (n.go === "reviews") {
			setTab("reviews");
		}
	}

	const h = new Date().getHours();
	const timeOfDay =
		h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
	const firstName = localBusiness.owner.name?.split(" ")[0] ?? "";
	const greeting = firstName ? `${timeOfDay}, ${firstName}` : timeOfDay;

	return (
		<OutboxSyncProvider
			appId={OWNER_APP_ID}
			executors={createOwnerOutboxExecutors(qc)}
			onConflict={() =>
				flash("This booking was already updated.", { tone: "info" })
			}
		>
			<Ctx.Provider
				value={{
					contact,
					enterExisting,
					goLive,
					handleAuthed,
					signOut,
					setTab,
					setOverlay,
					sheet,
					setSheet,
					comms,
					setComms,
					businessId,
					apiBranches,
					business: localBusiness,
					status,
					toggleStatus,
					updateBusiness,
					appendBusinessPhotoUrl,
					addBranchToBusiness,
					branch,
					setBranch,
					filter,
					setFilter,
					bookings,
					services,
					products,
					reviews,
					coupons,
					team,
					notifs,
					confirmBooking,
					declineBooking,
					cancelBooking,
					completeBooking,
					assignStaff,
					addService,
					updateService,
					removeService,
					addProduct,
					updateProduct,
					removeProduct,
					approveReview,
					rejectReview,
					createCoupon,
					toggleCoupon,
					addStaff,
					updateStaff,
					removeStaff,
					hasUnread,
					readAll,
					tapNotif,
					toast,
					flash,
					greeting,
					pendingCount,
					pendingReviews,
				}}
			>
				{children}
			</Ctx.Provider>
		</OutboxSyncProvider>
	);
}

export function useApp() {
	return useContext(Ctx);
}
