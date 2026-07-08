"use client";
import type {
	AppNotification,
	Favourite,
	RewardBalance,
	RewardTransaction,
	SessionInfo,
} from "@repo/api-client";
import {
	useMutation,
	useQueries,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { Bell, Coins, Gift, Heart, Shield, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { useAuth } from "@/hooks/useAuth";
import {
	useMarkAllNotificationsRead,
	useMarkNotificationRead,
	useNotifications,
} from "@/hooks/useNotifications";
import { api } from "@/lib/api";
import { BookingsSection } from "./_components/BookingsSection";
import { ProfileCard } from "./_components/ProfileCard";
import { ReviewsSection } from "./_components/ReviewsSection";

export default function AccountPage() {
	const router = useRouter();
	const qc = useQueryClient();
	const { user, isLoading, status } = useAuth();

	const [redeemPoints, setRedeemPoints] = useState("");
	const [showRedeem, setShowRedeem] = useState(false);

	useEffect(() => {
		if (status === "unauthenticated") {
			router.replace(`/login?next=/account`);
		}
	}, [status, router]);

	const { data: rewardsBalance } = useQuery({
		queryKey: ["rewards", "balance"],
		queryFn: () => api.rewards.balance(),
		enabled: !!user,
		staleTime: 60_000,
	});

	const { data: rewardsHistory } = useQuery({
		queryKey: ["rewards", "history"],
		queryFn: () => api.rewards.history({ limit: 10 }),
		enabled: !!user,
		staleTime: 60_000,
	});

	const { data: sessionsData } = useQuery({
		queryKey: ["auth", "sessions"],
		queryFn: () => api.auth.listSessions(),
		enabled: !!user,
		staleTime: 60_000,
	});

	const revokeMut = useMutation({
		mutationFn: (id: string) => api.auth.revokeSession(id),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["auth", "sessions"] }),
	});

	const redeemMut = useMutation({
		mutationFn: (points: number) => api.rewards.redeem({ points }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["rewards", "balance"] });
			qc.invalidateQueries({ queryKey: ["rewards", "history"] });
			setShowRedeem(false);
			setRedeemPoints("");
		},
	});

	const notifsQuery = useNotifications(!!user);
	const markReadMut = useMarkNotificationRead();
	const markAllMut = useMarkAllNotificationsRead();

	const { data: favouritesData } = useQuery({
		queryKey: ["favourites"],
		queryFn: () => api.favourites.list(),
		enabled: !!user,
		staleTime: 60_000,
	});

	const balance =
		(rewardsBalance as RewardBalance | undefined)?.balance ?? null;
	const transactions: RewardTransaction[] = rewardsHistory?.data ?? [];
	const sessions: SessionInfo[] =
		(sessionsData as SessionInfo[] | undefined) ?? [];
	const notifications: AppNotification[] = notifsQuery.data ?? [];
	const unreadCount = notifications.filter((n) => !n.readAt).length;
	const favourites: Favourite[] = favouritesData ?? [];

	const businessNameResults = useQueries({
		queries: favourites.map((fav) => ({
			queryKey: ["business", fav.businessId],
			queryFn: () => api.businesses.get(fav.businessId),
			staleTime: 300_000,
		})),
	});
	const businessNames: Record<string, string> = {};
	for (let i = 0; i < favourites.length; i++) {
		const name = businessNameResults[i]?.data?.data?.name;
		if (name) businessNames[favourites[i].businessId] = name;
	}

	if (isLoading) {
		return (
			<>
				<Nav />
				<main className="max-w-[800px] mx-auto px-4 md:px-8 py-12">
					<div className="h-32 rounded-xl bg-line animate-pulse" />
				</main>
				<Footer />
			</>
		);
	}

	if (!user) {
		return (
			<>
				<Nav />
				<main className="max-w-[800px] mx-auto px-4 md:px-8 py-12 text-center">
					<p className="font-sans text-ink-500 text-sm">
						Please{" "}
						<Link href="/login" className="text-primary-700">
							log in
						</Link>{" "}
						to view your account.
					</p>
				</main>
				<Footer />
			</>
		);
	}

	return (
		<>
			<Nav />
			<main className="max-w-[800px] mx-auto px-4 md:px-8 py-10 md:py-14">
				<ProfileCard />

				{/* Rewards card */}
				{balance !== null && (
					<div className="bg-surface rounded-xl border border-line overflow-hidden mb-6">
						<div className="flex items-center gap-2.5 px-6 py-4 border-b border-line">
							<Gift size={18} className="text-primary-700" />
							<h2 className="m-0 font-serif font-medium text-xl text-ink-900">
								Rewards
							</h2>
							<span className="ml-auto font-sans text-sm font-semibold text-primary-700">
								{balance} pts
							</span>
						</div>
						{transactions.length > 0 && (
							<div>
								{transactions.map((tx, i) => (
									<div
										key={tx.id}
										className={[
											"px-6 py-3 flex items-center justify-between gap-4",
											i ? "border-t border-line-soft" : "",
										].join(" ")}
									>
										<div className="font-sans text-sm text-ink-700">
											{tx.description}
										</div>
										<span
											className={[
												"font-sans text-sm font-semibold",
												tx.type === "credit"
													? "text-success-fg"
													: "text-danger-fg",
											].join(" ")}
										>
											{tx.type === "credit" ? "+" : "-"}
											{tx.points} pts
										</span>
									</div>
								))}
							</div>
						)}
						{balance !== null && balance > 0 && (
							<div className="px-6 py-4 border-t border-line">
								{!showRedeem ? (
									<button
										type="button"
										onClick={() => setShowRedeem(true)}
										className="flex items-center gap-1.5 font-sans text-sm font-semibold text-primary-700 bg-transparent border-none cursor-pointer p-0"
									>
										<Coins size={15} />
										Redeem points
									</button>
								) : (
									<div className="flex items-center gap-2">
										<input
											type="number"
											min={1}
											max={balance}
											value={redeemPoints}
											onChange={(e) => setRedeemPoints(e.target.value)}
											placeholder={`Max ${balance}`}
											className="w-32 px-3 py-1.5 border border-line rounded-md font-sans text-sm text-ink-900 bg-surface outline-none focus:border-primary-600"
										/>
										<button
											type="button"
											onClick={() => {
												const pts = Number(redeemPoints);
												if (pts > 0 && pts <= balance) redeemMut.mutate(pts);
											}}
											disabled={redeemMut.isPending || !redeemPoints}
											className="font-sans text-sm font-semibold text-white bg-primary-700 rounded-md px-3 py-1.5 cursor-pointer border-none hover:bg-primary-800 disabled:opacity-50"
										>
											{redeemMut.isPending ? "…" : "Redeem"}
										</button>
										<button
											type="button"
											onClick={() => {
												setShowRedeem(false);
												setRedeemPoints("");
											}}
											className="text-ink-400 bg-transparent border-none cursor-pointer p-0"
										>
											<X size={16} />
										</button>
									</div>
								)}
							</div>
						)}
					</div>
				)}

				{/* Sessions */}
				{sessions.length > 0 && (
					<div className="bg-surface rounded-xl border border-line overflow-hidden mb-6">
						<div className="flex items-center gap-2.5 px-6 py-4 border-b border-line">
							<Shield size={18} className="text-primary-700" />
							<h2 className="m-0 font-serif font-medium text-xl text-ink-900">
								Active sessions
							</h2>
						</div>
						<div>
							{sessions.map((s, i) => (
								<div
									key={s.id}
									className={[
										"px-6 py-3 flex items-center justify-between gap-4",
										i ? "border-t border-line-soft" : "",
									].join(" ")}
								>
									<div>
										<div className="font-sans text-sm text-ink-700 truncate max-w-xs">
											{s.deviceName ?? s.deviceId ?? "Unknown device"}
										</div>
										<div className="font-sans text-xs text-ink-400 mt-0.5">
											Last used{" "}
											{new Date(s.lastUsedAt).toLocaleDateString("en-BD", {
												dateStyle: "medium",
											})}
										</div>
									</div>
									<button
										type="button"
										onClick={() => revokeMut.mutate(s.id)}
										disabled={revokeMut.isPending}
										className="font-sans text-xs font-medium text-danger-fg bg-danger-bg border border-danger-fg/20 rounded-md px-2.5 py-1 cursor-pointer hover:bg-danger-fg/10 disabled:opacity-50"
									>
										Revoke
									</button>
								</div>
							))}
						</div>
					</div>
				)}

				<BookingsSection />

				<ReviewsSection />

				{/* Notifications */}
				{notifications.length > 0 && (
					<div className="bg-surface rounded-xl border border-line overflow-hidden mt-6">
						<div className="flex items-center gap-2.5 px-6 py-4 border-b border-line">
							<Bell size={18} className="text-primary-700" />
							<h2 className="m-0 font-serif font-medium text-xl text-ink-900">
								Notifications
								{unreadCount > 0 && (
									<span className="ml-2 font-sans text-xs font-bold text-primary-700">
										({unreadCount} new)
									</span>
								)}
							</h2>
							{unreadCount > 0 && (
								<button
									type="button"
									onClick={() => markAllMut.mutate()}
									className="ml-auto font-sans text-xs font-medium text-ink-500 hover:text-ink-900 bg-transparent border-none cursor-pointer p-0"
								>
									Mark all read
								</button>
							)}
						</div>
						<div>
							{notifications.slice(0, 10).map((n, i) => (
								<button
									key={n.id}
									type="button"
									onClick={() => {
										if (!n.readAt) markReadMut.mutate(n.id);
									}}
									className={[
										"w-full text-left px-6 py-3 flex flex-col gap-0.5 border-none cursor-pointer",
										i ? "border-t border-line-soft" : "",
										n.readAt ? "bg-transparent" : "bg-primary-50",
									].join(" ")}
								>
									<div className="font-sans text-sm font-semibold text-ink-900">
										{n.title}
									</div>
									<div className="font-sans text-xs text-ink-500 line-clamp-2">
										{n.body}
									</div>
									<div className="font-sans text-xs text-ink-400 mt-0.5">
										{new Date(n.createdAt).toLocaleDateString("en-BD", {
											day: "numeric",
											month: "short",
											hour: "2-digit",
											minute: "2-digit",
										})}
									</div>
								</button>
							))}
						</div>
					</div>
				)}

				{/* Saved businesses */}
				{favourites.length > 0 && (
					<div className="bg-surface rounded-xl border border-line overflow-hidden mt-6">
						<div className="flex items-center gap-2.5 px-6 py-4 border-b border-line">
							<Heart size={18} className="text-primary-700" />
							<h2 className="m-0 font-serif font-medium text-xl text-ink-900">
								Saved businesses
							</h2>
						</div>
						<div className="px-6 py-4 flex flex-wrap gap-3">
							{favourites.map((fav) => (
								<Link
									key={fav.id}
									href={`/businesses/${fav.businessId}`}
									className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-line bg-paper text-sm font-medium text-ink-800 no-underline hover:border-primary-500 transition-colors"
								>
									<Heart
										size={13}
										className="text-primary-600 fill-primary-600"
									/>
									{businessNames[fav.businessId] ?? "View business"}
								</Link>
							))}
						</div>
					</div>
				)}
			</main>
			<Footer />
		</>
	);
}
