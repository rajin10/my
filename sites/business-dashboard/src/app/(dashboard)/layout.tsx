"use client";
import * as Icons from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect } from "react";
import { AppFooter } from "@/components/AppFooter";
import { ScreenSkeleton } from "@/components/primitives";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { ToastProvider, useToast } from "@/context/toast";
import {
	useBranchBookings,
	useBranches,
	useMyBusiness,
} from "@/hooks/useOwnerData";
import { tokenStore } from "@/lib/api";

function Toast() {
	const { toast } = useToast();
	if (!toast) return null;
	const iconMap = Icons as unknown as Record<
		string,
		React.ComponentType<{ size: number; className?: string }>
	>;
	const IconComp = toast.icon ? iconMap[toast.icon] : null;
	return (
		<div className="fixed bottom-7 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2.5 bg-primary-900 text-white rounded-full px-5 py-3 font-sans text-sm font-medium shadow-lg whitespace-nowrap">
			{IconComp && <IconComp size={17} className="text-primary-300" />}
			{toast.msg}
		</div>
	);
}

function DashboardShell({ children }: { children: React.ReactNode }) {
	const router = useRouter();
	const pathname = usePathname();
	const isOnboarding = pathname === "/onboarding";
	const [sidebarOpen, setSidebarOpen] = React.useState(false);
	const businessQuery = useMyBusiness();
	const businessId = businessQuery.data?.id ?? null;
	const branchesQuery = useBranches(businessId);
	const branchCount = branchesQuery.data?.data?.length ?? 0;
	const bookingsQuery = useBranchBookings(businessId);
	const pendingCount = (bookingsQuery.data?.data ?? []).filter(
		(b) => b.status === "Pending",
	).length;

	useEffect(() => {
		if (!tokenStore.getAccessToken()) router.replace("/login");
	}, [router]);

	useEffect(() => {
		if (businessQuery.isLoading || !tokenStore.getAccessToken()) return;
		if (!businessQuery.data && !isOnboarding) router.replace("/onboarding");
		if (businessQuery.data && isOnboarding) router.replace("/overview");
	}, [businessQuery.isLoading, businessQuery.data, isOnboarding, router]);

	if (!tokenStore.getAccessToken()) return null;

	if (isOnboarding) {
		return (
			<div className="min-h-screen bg-paper flex flex-col">
				<main className="flex-1">{children}</main>
				<AppFooter />
			</div>
		);
	}

	if (businessQuery.isLoading) {
		return (
			<div className="min-h-screen bg-paper p-4 md:p-8">
				<ScreenSkeleton rows={3} cards={4} />
			</div>
		);
	}

	if (!businessQuery.data) return null;

	return (
		<div className="flex min-h-screen bg-paper">
			<Sidebar
				pendingCount={pendingCount}
				businessName={businessQuery.data?.name}
				branchCount={branchCount}
				businessStatus={businessQuery.data?.status}
				isOpen={sidebarOpen}
				onClose={() => setSidebarOpen(false)}
			/>
			<div className="flex-1 flex flex-col min-w-0">
				<Topbar onMenuClick={() => setSidebarOpen((o) => !o)} />
				<main className="flex-1 p-4 md:p-8 overflow-y-auto">{children}</main>
				<AppFooter />
			</div>
		</div>
	);
}

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<ToastProvider>
			<DashboardShell>{children}</DashboardShell>
			<Toast />
		</ToastProvider>
	);
}
