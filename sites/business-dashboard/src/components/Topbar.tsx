"use client";
import type { AppNotification } from "@repo/api-client";
import { ColorSchemeToggle } from "@repo/ui";
import { Bell, CheckCheck, Menu, Search, Settings, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
	useCurrentUser,
	useMarkAllNotificationsRead,
	useMarkNotificationRead,
	useNotifications,
} from "@/hooks/useOwnerData";
import { Button } from "./primitives";

interface TopbarProps {
	onMenuClick?: () => void;
}

function NotificationsDropdown({ onClose }: { onClose: () => void }) {
	const notifsQuery = useNotifications();
	const markReadMut = useMarkNotificationRead();
	const markAllMut = useMarkAllNotificationsRead();
	const notifs: AppNotification[] = notifsQuery.data ?? [];
	const unreadCount = notifs.filter((n) => !n.readAt).length;

	function tap(n: AppNotification) {
		if (!n.readAt) markReadMut.mutate(n.id);
		onClose();
	}

	return (
		<div className="absolute right-0 top-full mt-2 w-80 bg-surface rounded-xl border border-line shadow-lg z-50 overflow-hidden">
			<div className="flex items-center justify-between px-4 py-3 border-b border-line">
				<span className="font-sans text-sm font-semibold text-ink-900">
					Notifications{" "}
					{unreadCount > 0 && (
						<span className="ml-1 text-xs text-primary-600">
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
						<CheckCheck size={13} />
						Mark all read
					</button>
				)}
			</div>
			<div className="max-h-80 overflow-y-auto">
				{notifs.length === 0 ? (
					<div className="px-4 py-8 text-center font-sans text-sm text-ink-400">
						No notifications yet
					</div>
				) : (
					notifs.map((n) => (
						<button
							key={n.id}
							type="button"
							onClick={() => tap(n)}
							className={[
								"w-full text-left px-4 py-3 border-b border-line-soft last:border-0 cursor-pointer bg-transparent border-x-0 border-t-0",
								n.readAt ? "bg-transparent" : "bg-primary-50",
							].join(" ")}
						>
							<div className="font-sans text-sm font-semibold text-ink-900 truncate">
								{n.title}
							</div>
							<div className="font-sans text-xs text-ink-500 mt-0.5 line-clamp-2">
								{n.body}
							</div>
							<div className="font-sans text-xs text-ink-400 mt-1">
								{new Date(n.createdAt).toLocaleDateString("en-IN", {
									day: "numeric",
									month: "short",
									hour: "2-digit",
									minute: "2-digit",
								})}
							</div>
						</button>
					))
				)}
			</div>
		</div>
	);
}

function UserDropdown({
	name,
	onClose,
}: {
	name: string;
	onClose: () => void;
}) {
	const router = useRouter();

	return (
		<div className="absolute right-0 top-full mt-2 w-52 bg-surface rounded-xl border border-line shadow-lg z-50 overflow-hidden">
			<div className="px-4 py-3 border-b border-line">
				<div className="font-sans text-sm font-semibold text-ink-900 truncate">
					{name}
				</div>
			</div>
			<button
				type="button"
				onClick={() => {
					router.push("/account");
					onClose();
				}}
				className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left font-sans text-sm text-ink-700 hover:bg-line-soft bg-transparent border-none cursor-pointer"
			>
				<Settings size={15} />
				Account settings
			</button>
		</div>
	);
}

function useClickOutside(
	ref: React.RefObject<HTMLElement | null>,
	onClose: () => void,
) {
	useEffect(() => {
		function handle(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) onClose();
		}
		document.addEventListener("mousedown", handle);
		return () => document.removeEventListener("mousedown", handle);
	}, [ref, onClose]);
}

export function Topbar({ onMenuClick }: TopbarProps) {
	const router = useRouter();
	const [showNotifs, setShowNotifs] = useState(false);
	const [showUser, setShowUser] = useState(false);
	const [searchQ, setSearchQ] = useState("");
	const notifsRef = useRef<HTMLDivElement>(null);
	const userRef = useRef<HTMLDivElement>(null);
	const userQuery = useCurrentUser();
	const notifsQuery = useNotifications();
	const unreadCount = (notifsQuery.data ?? []).filter((n) => !n.readAt).length;
	const userName = userQuery.data?.name ?? "";

	useClickOutside(notifsRef, () => setShowNotifs(false));
	useClickOutside(userRef, () => setShowUser(false));

	return (
		<header className="sticky top-0 z-20 flex items-center gap-3 md:gap-4 px-4 md:px-8 py-3.5 bg-paper/80 backdrop-blur-sm border-b border-line">
			<button
				type="button"
				onClick={onMenuClick}
				className="md:hidden w-9 h-9 rounded-md border border-line bg-surface cursor-pointer flex items-center justify-center shrink-0"
				aria-label="Open menu"
			>
				<Menu size={18} className="text-ink-700" />
			</button>
			<form
				className="relative flex-1 max-w-[380px]"
				onSubmit={(e) => {
					e.preventDefault();
					if (searchQ.trim())
						router.push(
							`/customers?search=${encodeURIComponent(searchQ.trim())}`,
						);
				}}
			>
				<Search
					size={17}
					className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
				/>
				<input
					value={searchQ}
					onChange={(e) => setSearchQ(e.target.value)}
					placeholder="Search customers…"
					className="w-full box-border py-2 pl-9 pr-3 rounded-full border border-line outline-none font-sans text-sm bg-surface text-ink-900"
				/>
			</form>
			<div className="flex-1" />

			<ColorSchemeToggle />

			{/* Notifications bell */}
			<div ref={notifsRef} className="relative">
				<button
					type="button"
					onClick={() => {
						setShowNotifs((v) => !v);
						setShowUser(false);
					}}
					className="w-10 h-10 rounded-full border border-line bg-surface cursor-pointer flex items-center justify-center relative"
				>
					<Bell size={18} className="text-ink-700" />
					{unreadCount > 0 && (
						<span className="absolute top-2 right-2.5 w-1.5 h-1.5 rounded-full bg-gold-500 ring-2 ring-surface" />
					)}
				</button>
				{showNotifs && (
					<NotificationsDropdown onClose={() => setShowNotifs(false)} />
				)}
			</div>

			{/* User avatar */}
			<div ref={userRef} className="relative">
				<button
					type="button"
					onClick={() => {
						setShowUser((v) => !v);
						setShowNotifs(false);
					}}
					className="w-10 h-10 rounded-full border border-line bg-primary-900 cursor-pointer flex items-center justify-center"
					aria-label="Account"
				>
					{userName ? (
						<span className="font-serif text-base font-medium text-white">
							{userName.charAt(0).toUpperCase()}
						</span>
					) : (
						<User size={17} className="text-white" />
					)}
				</button>
				{showUser && (
					<UserDropdown name={userName} onClose={() => setShowUser(false)} />
				)}
			</div>

			<Button icon="Plus" size="md" onClick={() => router.push("/bookings")}>
				<span className="hidden sm:inline">New booking</span>
			</Button>
		</header>
	);
}
