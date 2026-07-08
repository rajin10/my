"use client";
import type { AppNotification } from "@repo/api-client";
import { ColorSchemeToggle } from "@repo/ui";
import { Bell, CheckCheck, Menu, User, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
	useMarkAllNotificationsRead,
	useMarkNotificationRead,
	useNotifications,
} from "@/hooks/useNotifications";
import { t } from "@/lib/i18n";
import { Button } from "./Button";

const LINKS = [
	{ label: "Discover", href: "/#businesses" },
	{ label: "How it works", href: "/#how-it-works" },
	{ label: "For business", href: "/for-business" },
];

export function Nav() {
	const [scrolled, setScrolled] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const [showNotifs, setShowNotifs] = useState(false);
	const { user, status } = useAuth();
	const notifsRef = useRef<HTMLDivElement>(null);
	const notifsQuery = useNotifications(!!user);
	const markReadMut = useMarkNotificationRead();
	const markAllMut = useMarkAllNotificationsRead();
	const notifs: AppNotification[] = notifsQuery.data ?? [];
	const unreadCount = notifs.filter((n) => !n.readAt).length;

	useEffect(() => {
		function handle(e: MouseEvent) {
			if (notifsRef.current && !notifsRef.current.contains(e.target as Node))
				setShowNotifs(false);
		}
		document.addEventListener("mousedown", handle);
		return () => document.removeEventListener("mousedown", handle);
	}, []);

	useEffect(() => {
		const fn = () => setScrolled(window.scrollY > 12);
		window.addEventListener("scroll", fn);
		return () => window.removeEventListener("scroll", fn);
	}, []);

	return (
		<header
			className={[
				"sticky top-0 z-50 transition-all duration-normal border-b",
				scrolled || menuOpen
					? "bg-paper/80 backdrop-blur-sm border-line"
					: "bg-transparent border-transparent",
			].join(" ")}
		>
			<div className="max-w-300 mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
				<Link href="/" className="flex items-center gap-2.5 no-underline">
					<Image src="/talash-mark.svg" width={30} height={30} alt="" />
					<span className="font-serif text-2xl font-semibold tracking-tight text-ink-900">
						Talash
					</span>
				</Link>

				<nav className="hidden md:flex items-center gap-8">
					{LINKS.map((l) => (
						<Link
							key={l.href}
							href={l.href}
							className="no-underline font-sans text-sm font-medium text-ink-700"
						>
							{l.label}
						</Link>
					))}
				</nav>

				<div className="hidden md:flex items-center gap-3.5">
					<ColorSchemeToggle />
					{status === "unknown" ? (
						<div className="w-9 h-9" aria-hidden />
					) : status === "authenticated" && user ? (
						<>
							{/* Notifications bell */}
							<div ref={notifsRef} className="relative">
								<button
									type="button"
									onClick={() => setShowNotifs((v) => !v)}
									className="relative w-9 h-9 rounded-full border border-line bg-surface flex items-center justify-center cursor-pointer"
									aria-label="Notifications"
								>
									<Bell size={16} className="text-ink-700" />
									{unreadCount > 0 && (
										<span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-gold-500" />
									)}
								</button>
								{showNotifs && (
									<div className="absolute right-0 top-full mt-2 w-72 bg-surface rounded-xl border border-line shadow-lg z-50 overflow-hidden">
										<div className="flex items-center justify-between px-4 py-3 border-b border-line">
											<span className="font-sans text-sm font-semibold text-ink-900">
												Notifications{" "}
												{unreadCount > 0 && (
													<span className="text-primary-600">
														({unreadCount})
													</span>
												)}
											</span>
											{unreadCount > 0 && (
												<button
													type="button"
													onClick={() => markAllMut.mutate()}
													className="flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-ink-900 bg-transparent border-none cursor-pointer p-0"
												>
													<CheckCheck size={12} />
													All read
												</button>
											)}
										</div>
										<div className="max-h-72 overflow-y-auto">
											{notifs.length === 0 ? (
												<div className="px-4 py-6 text-center font-sans text-sm text-ink-400">
													No notifications yet
												</div>
											) : (
												notifs.map((n) => (
													<button
														key={n.id}
														type="button"
														onClick={() => {
															if (!n.readAt) markReadMut.mutate(n.id);
															setShowNotifs(false);
														}}
														className={[
															"w-full text-left px-4 py-3 border-b border-line-soft last:border-0 bg-transparent border-x-0 border-t-0 cursor-pointer hover:bg-line-soft/50",
															n.readAt ? "" : "bg-primary-50",
														].join(" ")}
													>
														<div className="font-sans text-sm font-semibold text-ink-900 truncate">
															{n.title}
														</div>
														<div className="font-sans text-xs text-ink-500 mt-0.5 line-clamp-2">
															{n.body}
														</div>
													</button>
												))
											)}
										</div>
									</div>
								)}
							</div>

							<Link
								href="/account"
								className="flex items-center gap-1.5 no-underline font-sans text-sm font-semibold text-ink-800"
							>
								{user.photoUrl ? (
									<img
										src={user.photoUrl}
										alt=""
										className="w-6 h-6 rounded-full object-cover"
									/>
								) : (
									<User size={16} />
								)}
								{user.name.split(" ")[0]}
							</Link>
						</>
					) : (
						<>
							<Link
								href="/login"
								className="no-underline font-sans text-sm font-semibold text-ink-800"
							>
								Sign in
							</Link>
							<Link href="/download" className="no-underline">
								<Button size="sm" icon="Smartphone" variant={"primary"}>
									{t("nav.getApp")}
								</Button>
							</Link>
						</>
					)}
				</div>

				<button
					type="button"
					className="md:hidden p-2 -mr-2 text-ink-700"
					onClick={() => setMenuOpen((o) => !o)}
					aria-label="Toggle menu"
				>
					{menuOpen ? <X size={22} /> : <Menu size={22} />}
				</button>
			</div>

			{menuOpen && (
				<div className="md:hidden bg-paper/95 backdrop-blur-sm border-t border-line px-4 py-4 flex flex-col gap-1">
					{LINKS.map((l) => (
						<Link
							key={l.href}
							href={l.href}
							onClick={() => setMenuOpen(false)}
							className="no-underline font-sans text-base font-medium text-ink-700 py-2.5 border-b border-line-soft last:border-0"
						>
							{l.label}
						</Link>
					))}
					<div className="flex items-center gap-3 pt-3">
						<ColorSchemeToggle />
						{status === "unknown" ? null : status === "authenticated" &&
							user ? (
							<Link
								href="/account"
								onClick={() => setMenuOpen(false)}
								className="no-underline font-sans text-sm font-semibold text-ink-800 flex items-center gap-1.5"
							>
								<User size={15} />
								Account
							</Link>
						) : (
							<>
								<Link
									href="/login"
									className="no-underline font-sans text-sm font-semibold text-ink-800"
								>
									Sign in
								</Link>
								<Link
									href="/download"
									onClick={() => setMenuOpen(false)}
									className="no-underline"
								>
									<Button size="sm" icon="Smartphone">
										{t("nav.getApp")}
									</Button>
								</Link>
							</>
						)}
					</div>
				</div>
			)}
		</header>
	);
}
