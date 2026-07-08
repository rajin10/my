import type {
	Booking as ApiBooking,
	AppNotification,
	AuthTokens,
	AuthUser,
	CreateBookingBody,
	Favourite,
	PaginatedResponse,
	RewardTransaction,
} from "@repo/api-client";
import { ApiError } from "@repo/api-client";
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
import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { toast } from "./components/Toast";
import type { Booking, Business, Notification, Order, Service } from "./data";
import { useEnrichedBookings } from "./hooks/useEnrichedBookings";
import { useWalkInDeepLink } from "./hooks/useWalkInDeepLink";
import {
	adaptApiBooking,
	mapNotificationType,
	orderNotifParams,
} from "./lib/adapters";
import { api, authEvents } from "./lib/api";
import { formatDate } from "./lib/format";
import { tokenStore } from "./lib/native-token-store";
import { createMobileOutboxExecutors } from "./lib/outbox-executors";
import { registerPushToken } from "./lib/push";
import { MOBILE_APP_ID } from "./lib/query-client";
import { addReviewedId, loadReviewedIds } from "./lib/reviewed-store";

export type Modal =
	| { type: "review"; booking: Booking }
	| { type: "bookingDetail"; booking: Booking }
	| { type: "orderDetail"; order: Order }
	| null;

type HistoryEntry = { label: string; when: string; points: number };

const TAB_ROUTES: Record<string, string> = {
	search: "/(tabs)",
	bookings: "/(tabs)/bookings",
	favourites: "/(tabs)/favourites",
	rewards: "/(tabs)/rewards",
	account: "/(tabs)/account",
};

type AppState = {
	authedUser: AuthUser | null;
	authLoading: boolean;
	isAuthed: boolean;
	signIn: (tokens: AuthTokens) => Promise<void>;
	signOut: () => Promise<void>;

	saved: Set<string>;
	bookings: Booking[];
	points: number;
	history: HistoryEntry[];
	notifications: Notification[];

	selectedBusiness: Business | null;
	pendingBooking: {
		business: Business;
		service: Service;
		branch: Business["branches"][0];
	} | null;
	confirmedBooking: Booking | null;
	modal: Modal;
	reviewed: Set<string>;
	bookingPending: boolean;

	toggleSave: (business: Business) => void;
	openBusiness: (business: Business) => void;
	primeBusiness: (business: Business) => void;
	startBooking: (
		business: Business,
		service: Service,
		branch: Business["branches"][0],
	) => void;
	confirmBooking: (details: {
		business: Business;
		service: Service;
		branch: Business["branches"][0];
		slotIso: string;
		total: number;
		discount: number;
		coupon: string | null;
		payment?: Booking["payment"];
	}) => void;
	cancelBooking: (id: string) => void;
	fetchMoreBookings: () => void;
	hasMoreBookings: boolean;
	openNotifications: () => void;
	closeOverlay: () => void;
	goTab: (tab: string) => void;
	readNotif: (id: string) => void;
	readAllNotifs: () => void;
	tapNotif: (n: Notification) => void;
	submitReview: (bookingId: string, rating: number, text: string) => void;
	setModal: (m: Modal) => void;
};

const AppContext = createContext<AppState | null>(null);

function formatWhen(iso: string): string {
	const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
	if (diff < 60) return "Just now";
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
	if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
	if (diff < 172800) return "Yesterday";
	return formatDate(iso, {
		day: "numeric",
		month: "short",
	});
}

function adaptTransaction(t: RewardTransaction): HistoryEntry {
	return {
		label: t.description,
		when: formatWhen(t.createdAt),
		points: t.points,
	};
}

function adaptNotification(n: AppNotification): Notification {
	const isToday = Date.now() - new Date(n.createdAt).getTime() < 86_400_000;
	return {
		id: n.id,
		type: mapNotificationType(n.type),
		group: isToday ? "today" : "earlier",
		unread: n.readAt === null,
		title: n.title,
		body: n.body,
		when: formatWhen(n.createdAt),
		...(n.go ? { go: n.go } : {}),
		...(n.orderId ? { orderId: n.orderId } : {}),
	};
}

function unwrapBooking(res: { data?: ApiBooking } | ApiBooking): ApiBooking {
	return ("data" in res && res.data ? res.data : res) as ApiBooking;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
	useWalkInDeepLink();
	const qc = useQueryClient();
	const { isOnline } = useNetworkStatus();
	const ensureOnline = useOnlineGuard((message) =>
		toast.show({ message, tone: "info" }),
	);
	const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);
	const [hasToken, setHasToken] = useState(() => !!tokenStore.getAccessToken());

	useEffect(() => {
		setHasToken(!!tokenStore.getAccessToken());
	}, []);

	useEffect(() => {
		authEvents.setOnUnauthorized(() => {
			setSessionUser(null);
			setHasToken(false);
			qc.clear();
			clearPersistedCache(MOBILE_APP_ID);
			clearOutbox(MOBILE_APP_ID);
			router.replace("/(tabs)/account");
		});
	}, [qc]);

	const meQuery = useQuery({
		queryKey: ["auth", "me"],
		queryFn: () => api.auth.me(),
		enabled: hasToken,
		retry: false,
		staleTime: 5 * 60_000,
	});

	useEffect(() => {
		if (meQuery.data) {
			setSessionUser(meQuery.data);
			registerPushToken();
		}
	}, [meQuery.data]);

	useEffect(() => {
		if (!meQuery.isError) return;
		if (!isOnline) return;
		async function clearStaleToken() {
			await tokenStore.clearTokens();
			setHasToken(false);
			setSessionUser(null);
		}
		void clearStaleToken();
	}, [meQuery.isError, isOnline]);

	const authedUser = sessionUser;
	const authLoading = hasToken && meQuery.isLoading && !sessionUser;

	async function signIn(tokens: AuthTokens) {
		await tokenStore.setTokens(tokens.accessToken, tokens.refreshToken);
		setSessionUser(tokens.user);
		setHasToken(true);
		await qc.invalidateQueries();
		registerPushToken();
	}

	async function signOut() {
		try {
			await api.auth.logout();
		} catch {
			/* ignore */
		}
		await tokenStore.clearTokens();
		setSessionUser(null);
		setHasToken(false);
		qc.clear();
		clearPersistedCache(MOBILE_APP_ID);
		clearOutbox(MOBILE_APP_ID);
		clearWalkInQueue(MOBILE_APP_ID);
	}

	const isAuthed = hasToken;

	const bookingsQuery = useInfiniteQuery({
		queryKey: ["bookings", "my"],
		queryFn: ({ pageParam = 1 }) =>
			api.bookings.list({ limit: 20, page: pageParam as number }),
		initialPageParam: 1,
		getNextPageParam: (
			lastPage: PaginatedResponse<ApiBooking>,
			pages: PaginatedResponse<ApiBooking>[],
		) => {
			const total = lastPage?.query?.total ?? 0;
			const fetched = pages.reduce(
				(s: number, p: PaginatedResponse<ApiBooking>) =>
					s + (p?.data?.length ?? 0),
				0,
			);
			return fetched < total ? pages.length + 1 : undefined;
		},
		enabled: isAuthed,
		staleTime: 15_000,
	});

	const balanceQuery = useQuery({
		queryKey: ["rewards", "balance"],
		queryFn: () => api.rewards.balance(),
		enabled: isAuthed,
		staleTime: 30_000,
	});

	const historyQuery = useQuery({
		queryKey: ["rewards", "history"],
		queryFn: () => api.rewards.history({ limit: 20 }),
		enabled: isAuthed,
		staleTime: 30_000,
	});

	const apiBookings: ApiBooking[] = (bookingsQuery.data?.pages ?? []).flatMap(
		(p: PaginatedResponse<ApiBooking>) => p?.data ?? [],
	);

	const bookings = useEnrichedBookings(apiBookings, isAuthed);

	const points = balanceQuery.data?.balance ?? 0;
	const history: HistoryEntry[] = (historyQuery.data?.data ?? []).map(
		adaptTransaction,
	);

	function queueOrMutate(args: {
		mutationType: OutboxMutationType;
		payload: unknown;
		onlineMutate: () => void;
		optimistic?: () => void | Promise<void>;
	}) {
		queueOrRunSync({
			appId: MOBILE_APP_ID,
			mutationType: args.mutationType,
			payload: args.payload,
			isOnline,
			onOnline: args.onlineMutate,
			onQueued: () => {
				void args.optimistic?.();
				toast.show({
					message: "Saved offline — will sync when you're back online.",
					tone: "info",
				});
			},
			onBlocked: () =>
				toast.show({ message: OFFLINE_ACTION_MESSAGE, tone: "info" }),
		});
	}

	async function applyCancelBookingOptimistic(id: string) {
		await qc.cancelQueries({ queryKey: ["bookings", "my"] });
		const previous = qc.getQueryData(["bookings", "my"]);
		qc.setQueryData(
			["bookings", "my"],
			(old: { pages?: PaginatedResponse<ApiBooking>[] } | undefined) => {
				if (!old?.pages) return old;
				return {
					...old,
					pages: old.pages.map((page: PaginatedResponse<ApiBooking>) => ({
						...page,
						data: (page.data ?? []).map((b: ApiBooking) =>
							b.id === id ? { ...b, status: "Cancelled" } : b,
						),
					})),
				};
			},
		);
		return { previous };
	}

	async function applyAddFavouriteOptimistic(businessId: string) {
		await qc.cancelQueries({ queryKey: ["favourites", "list"] });
		const prev = qc.getQueryData(["favourites", "list"]);
		qc.setQueryData<Favourite[]>(["favourites", "list"], (old) => [
			...(old ?? []),
			{ id: "", userId: "", businessId, createdAt: new Date().toISOString() },
		]);
		return { prev };
	}

	async function applyRemoveFavouriteOptimistic(businessId: string) {
		await qc.cancelQueries({ queryKey: ["favourites", "list"] });
		const prev = qc.getQueryData(["favourites", "list"]);
		qc.setQueryData<Favourite[]>(["favourites", "list"], (old) =>
			(old ?? []).filter((f) => f.businessId !== businessId),
		);
		return { prev };
	}

	const cancelMut = useMutation({
		mutationFn: (id: string) => api.bookings.cancel(id),
		onMutate: async (id) => applyCancelBookingOptimistic(id),
		onError: (_err, _id, ctx) => {
			if (ctx?.previous) qc.setQueryData(["bookings", "my"], ctx.previous);
		},
		onSettled: () => qc.invalidateQueries({ queryKey: ["bookings", "my"] }),
	});

	const createBookingMut = useMutation({
		mutationFn: (body: CreateBookingBody) => api.bookings.create(body),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings", "my"] }),
	});

	const submitReviewMut = useMutation({
		mutationFn: ({
			bookingId,
			rating,
			text,
			businessId,
			serviceId,
		}: {
			bookingId: string;
			rating: number;
			text: string;
			businessId: string;
			serviceId: string;
		}) =>
			api.reviews.create({ bookingId, rating, text, businessId, serviceId }),
		onSuccess: (_, { bookingId }) => {
			setReviewed((s) => new Set(s).add(bookingId));
			void addReviewedId(bookingId);
			qc.invalidateQueries({ queryKey: ["bookings", "my"] });
		},
		onError: (_, { bookingId }) => {
			setReviewed((s) => {
				const next = new Set(s);
				next.delete(bookingId);
				return next;
			});
		},
	});

	const notificationsQuery = useQuery({
		queryKey: ["notifications"],
		queryFn: () => api.notifications.list({ limit: 50 }),
		enabled: isAuthed,
		staleTime: 30_000,
	});

	const markReadMut = useMutation({
		mutationFn: (id: string) => api.notifications.markRead(id),
		onMutate: async (id) => {
			await qc.cancelQueries({ queryKey: ["notifications"] });
			qc.setQueryData<AppNotification[]>(
				["notifications"],
				(ns) =>
					ns?.map((n) =>
						n.id === id ? { ...n, readAt: new Date().toISOString() } : n,
					) ?? [],
			);
		},
		onSettled: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
	});

	const markAllReadMut = useMutation({
		mutationFn: () => api.notifications.markAllRead(),
		onMutate: async () => {
			await qc.cancelQueries({ queryKey: ["notifications"] });
			const ts = new Date().toISOString();
			qc.setQueryData<AppNotification[]>(
				["notifications"],
				(ns) => ns?.map((n) => ({ ...n, readAt: n.readAt ?? ts })) ?? [],
			);
		},
		onSettled: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
	});

	const notifications: Notification[] = (notificationsQuery.data ?? []).map(
		adaptNotification,
	);

	const favListQuery = useQuery({
		queryKey: ["favourites", "list"],
		queryFn: () => api.favourites.list(),
		enabled: isAuthed,
		staleTime: 60_000,
	});
	const saved = new Set((favListQuery.data ?? []).map((f) => f.businessId));

	const addFavMut = useMutation({
		mutationFn: (businessId: string) => api.favourites.add(businessId),
		onMutate: async (businessId) => applyAddFavouriteOptimistic(businessId),
		onError: (_err, _id, ctx) => {
			if (ctx?.prev) qc.setQueryData(["favourites", "list"], ctx.prev);
		},
		onSettled: () => qc.invalidateQueries({ queryKey: ["favourites", "list"] }),
	});

	const removeFavMut = useMutation({
		mutationFn: (businessId: string) => api.favourites.remove(businessId),
		onMutate: async (businessId) => applyRemoveFavouriteOptimistic(businessId),
		onError: (_err, _id, ctx) => {
			if (ctx?.prev) qc.setQueryData(["favourites", "list"], ctx.prev);
		},
		onSettled: () => qc.invalidateQueries({ queryKey: ["favourites", "list"] }),
	});

	const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(
		null,
	);
	const [pendingBooking, setPendingBooking] = useState<{
		business: Business;
		service: Service;
		branch: Business["branches"][0];
	} | null>(null);
	const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(
		null,
	);
	const [modal, setModal] = useState<Modal>(null);
	const [reviewed, setReviewed] = useState<Set<string>>(new Set());

	useEffect(() => {
		if (!isAuthed) {
			setReviewed(new Set());
			return;
		}
		loadReviewedIds().then(setReviewed);
	}, [isAuthed]);

	function toggleSave(business: Business) {
		if (saved.has(business.id)) {
			queueOrMutate({
				mutationType: "favourites.remove",
				payload: { businessId: business.id },
				onlineMutate: () => removeFavMut.mutate(business.id),
				optimistic: () => applyRemoveFavouriteOptimistic(business.id),
			});
		} else {
			queueOrMutate({
				mutationType: "favourites.add",
				payload: { businessId: business.id },
				onlineMutate: () => addFavMut.mutate(business.id),
				optimistic: () => applyAddFavouriteOptimistic(business.id),
			});
		}
	}

	function primeBusiness(business: Business) {
		setSelectedBusiness(business);
	}

	function openBusiness(business: Business) {
		setSelectedBusiness(business);
		router.push({ pathname: "/business", params: { id: business.id } });
	}

	function startBooking(
		business: Business,
		service: Service,
		branch: Business["branches"][0],
	) {
		if (!isAuthed) {
			router.navigate("/(tabs)/account");
			return;
		}
		if (!ensureOnline()) return;
		setPendingBooking({ business, service, branch });
		router.push("/booking");
	}

	function confirmBooking(details: {
		business: Business;
		service: Service;
		branch: Business["branches"][0];
		slotIso: string;
		total: number;
		discount: number;
		coupon: string | null;
		payment?: Booking["payment"];
	}) {
		if (!ensureOnline()) return;
		createBookingMut.mutate(
			{
				serviceId: details.service.id,
				branchId: details.branch.id,
				businessId: details.business.id,
				slot: details.slotIso,
				...(details.coupon ? { couponCode: details.coupon } : {}),
			},
			{
				onSuccess: (res) => {
					const apiBooking = unwrapBooking(res);
					const booking = adaptApiBooking(apiBooking, {
						business: details.business,
						service: details.service,
						branch: details.branch,
					});
					setConfirmedBooking({
						...booking,
						total: details.total,
						discount: details.discount,
						payment: details.payment,
					});
					setPendingBooking(null);
					scheduleBookingReminder(booking);
					router.push("/confirm");
				},
				onError: (err) => {
					const message =
						err instanceof ApiError
							? err.message
							: "Could not complete your booking. Try again.";
					toast.show({
						message,
						tone:
							err instanceof ApiError && err.code === "CONFLICT"
								? "info"
								: "danger",
					});
				},
			},
		);
	}

	async function scheduleBookingReminder(booking: Booking) {
		try {
			const { status } = await Notifications.getPermissionsAsync();
			if (status !== "granted") return;
			const slotDate = new Date(booking.slotIso);
			const trigger = new Date(slotDate.getTime() - 60 * 60 * 1000);
			if (trigger.getTime() > Date.now()) {
				await Notifications.scheduleNotificationAsync({
					content: {
						title: "Upcoming appointment",
						body: `${booking.service.name} at ${booking.business.name} in 1 hour`,
						data: { bookingId: booking.id },
					},
					trigger: {
						type: Notifications.SchedulableTriggerInputTypes.DATE,
						date: trigger,
					},
				});
			}
		} catch {
			// Scheduling is best-effort; silently ignore errors
		}
	}

	function cancelBooking(id: string) {
		if (!isAuthed) return;
		queueOrMutate({
			mutationType: "bookings.cancel",
			payload: { id },
			onlineMutate: () => cancelMut.mutate(id),
			optimistic: () => applyCancelBookingOptimistic(id),
		});
	}

	function openNotifications() {
		router.push("/notifications");
	}

	function closeOverlay() {
		if (router.canGoBack()) router.back();
		else router.replace("/(tabs)");
	}

	function goTab(tab: string) {
		router.navigate((TAB_ROUTES[tab] ?? "/(tabs)") as never);
	}

	function readNotif(id: string) {
		queueOrMutate({
			mutationType: "notifications.markRead",
			payload: { id },
			onlineMutate: () => markReadMut.mutate(id),
		});
	}

	function readAllNotifs() {
		queueOrMutate({
			mutationType: "notifications.markAllRead",
			payload: {},
			onlineMutate: () => markAllReadMut.mutate(),
		});
	}

	function tapNotif(n: Notification) {
		readNotif(n.id);
		const orderParams = orderNotifParams(n);
		if (orderParams) {
			// Order notifications deep-link to the specific order's detail sheet
			// (via the orderId param) when present, else the My Orders list.
			router.navigate({ pathname: "/(tabs)/account", params: orderParams });
		} else if (n.go) {
			goTab(n.go);
		}
	}

	function submitReview(bookingId: string, rating: number, text: string) {
		if (!ensureOnline()) return;
		const booking = bookings.find((b) => b.id === bookingId);
		if (booking) {
			submitReviewMut.mutate({
				bookingId,
				rating,
				text,
				businessId: booking.business.id,
				serviceId: booking.service.id,
			});
		}
	}

	return (
		<OutboxSyncProvider
			appId={MOBILE_APP_ID}
			executors={createMobileOutboxExecutors(qc)}
			onConflict={() =>
				toast.show({
					message: "This booking was already updated.",
					tone: "info",
				})
			}
		>
			<AppContext.Provider
				value={{
					authedUser,
					authLoading,
					isAuthed,
					signIn,
					signOut,
					saved,
					bookings,
					points,
					history,
					notifications,
					selectedBusiness,
					pendingBooking,
					confirmedBooking,
					modal,
					reviewed,
					bookingPending: createBookingMut.isPending,
					toggleSave,
					openBusiness,
					primeBusiness,
					startBooking,
					confirmBooking,
					cancelBooking,
					fetchMoreBookings: () => bookingsQuery.fetchNextPage(),
					hasMoreBookings: !!bookingsQuery.hasNextPage,
					openNotifications,
					closeOverlay,
					goTab,
					readNotif,
					readAllNotifs,
					tapNotif,
					submitReview,
					setModal,
				}}
			>
				{children}
			</AppContext.Provider>
		</OutboxSyncProvider>
	);
}

export function useApp() {
	const ctx = useContext(AppContext);
	if (!ctx) throw new Error("useApp must be used within AppProvider");
	return ctx;
}
