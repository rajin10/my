"use client";
import * as Icons from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "./data";
import { Avatar } from "./primitives";

interface SidebarProps {
	pendingCount: number;
	businessName?: string;
	branchCount?: number;
	businessStatus?: string;
	isOpen?: boolean;
	onClose?: () => void;
}

export function Sidebar({
	pendingCount,
	businessName,
	branchCount,
	businessStatus,
	isOpen,
	onClose,
}: SidebarProps) {
	const pathname = usePathname();

	return (
		<>
			{/* Mobile backdrop */}
			{isOpen && (
				<button
					type="button"
					className="fixed inset-0 z-40 bg-primary-950/50 md:hidden"
					onClick={onClose}
					aria-label="Close sidebar"
				/>
			)}
			<aside
				className={[
					"bg-primary-900 text-primary-100 flex flex-col",
					// Desktop: always visible sticky sidebar
					"md:w-64 md:shrink-0 md:sticky md:top-0 md:h-screen",
					// Mobile: fixed drawer, toggle via isOpen
					"fixed inset-y-0 left-0 z-50 w-72",
					"transition-transform duration-300",
					isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
				].join(" ")}
			>
				{/* Brand */}
				<div className="flex items-center gap-2.5 px-5 pt-6 pb-5">
					<Image src="/talash-mark-light.svg" width={30} height={30} alt="" />
					<div>
						<div className="font-serif text-xl font-medium tracking-tight text-white leading-none">
							Talash
						</div>
						<div className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-primary-400 mt-0.5">
							for business
						</div>
					</div>
				</div>

				{/* Business switcher */}
				<button
					type="button"
					className="mx-3.5 mb-4 flex items-center gap-2.5 px-3 py-2.5 rounded-md border border-white/10 bg-white/5 cursor-pointer text-left text-inherit"
				>
					<div className="w-8 h-8 rounded-[9px] bg-[linear-gradient(135deg,#1f6b58,#0b4a3c)] shrink-0" />
					<div className="flex-1 min-w-0">
						<div className="text-sm font-semibold text-white truncate">
							{businessName ?? "Your business"}
						</div>
						{branchCount !== undefined && (
							<div className="text-xs text-primary-300">
								{branchCount} {branchCount === 1 ? "branch" : "branches"} ·{" "}
								{businessStatus ?? "Draft"}
							</div>
						)}
					</div>
					<Icons.ChevronsUpDown size={15} className="text-primary-300" />
				</button>

				{/* Nav */}
				<nav className="flex flex-col gap-0.5 px-3.5">
					{NAV.map((item) => (
						<NavItem
							key={item.id}
							item={item}
							active={pathname === `/${item.id}`}
							pendingCount={pendingCount}
						/>
					))}
				</nav>

				<div className="flex-1" />

				{/* Owner */}
				<div className="border-t border-white/10 px-4 py-4 flex items-center gap-2.5">
					<Avatar
						name="You"
						size={36}
						tone="rgba(255,255,255,0.12)"
						fg="#fff"
					/>
					<div className="flex-1 min-w-0">
						<div className="text-sm font-semibold text-white">My account</div>
						<div className="text-xs text-primary-300">Owner</div>
					</div>
					<Icons.Settings
						size={17}
						className="text-primary-300 cursor-pointer"
					/>
				</div>
			</aside>
		</>
	);
}

function NavItem({
	item,
	active,
	pendingCount,
}: {
	item: { id: string; label: string; icon: string };
	active: boolean;
	pendingCount: number;
}) {
	// biome-ignore lint/suspicious/noExplicitAny: dynamic icon
	const IconComp = (Icons as any)[item.icon] as React.ComponentType<{
		size: number;
		className?: string;
	}>;

	return (
		<Link
			href={`/${item.id}`}
			className={[
				"flex items-center gap-3 px-3 py-2.5 rounded-md no-underline cursor-pointer",
				"font-sans text-sm transition-all duration-fast",
				active
					? "bg-white/10 text-white font-semibold"
					: "text-primary-200 font-medium hover:bg-white/5",
			].join(" ")}
		>
			{IconComp && (
				<IconComp
					size={19}
					className={active ? "text-primary-300" : "text-primary-400"}
				/>
			)}
			{item.label}
			{item.id === "bookings" && pendingCount > 0 && (
				<span className="ml-auto bg-gold-500 text-primary-950 text-xs font-bold rounded-full px-2 py-px">
					{pendingCount}
				</span>
			)}
		</Link>
	);
}
