"use client";
import type {
	Booking as ApiBooking,
	Branch as ApiBranch,
	TeamMember as ApiTeamMember,
} from "@repo/api-client";
import { useState } from "react";
import { ScreenSkeleton } from "@/components/primitives";
import { BookingsScreen } from "@/components/screens/BookingsScreen";
import { useToast } from "@/context/toast";
import {
	useAllBranchServices,
	useAssignStaff,
	useBranchBookings,
	useBranches,
	useCancelBooking,
	useCompleteBooking,
	useConfirmBooking,
	useMyBusiness,
	useTeam,
} from "@/hooks/useOwnerData";
import { adaptBooking, adaptService, adaptTeamMember } from "@/lib/adapters";
import { api } from "@/lib/api";

export default function BookingsPage() {
	const { flash } = useToast();
	const [exporting, setExporting] = useState(false);

	const businessQuery = useMyBusiness();
	const businessId = businessQuery.data?.id ?? null;
	const branchesQuery = useBranches(businessId);
	const apiBranches = (branchesQuery.data?.data ?? []) as ApiBranch[];
	const { services: apiServices } = useAllBranchServices(
		apiBranches.map((b) => b.id),
	);
	const services = apiServices.map((s) =>
		adaptService(s as never, apiBranches),
	);

	const bookingsQuery = useBranchBookings(businessId);
	const bookings = (bookingsQuery.data?.data ?? []).map((b) =>
		adaptBooking(b as ApiBooking, services, apiBranches),
	);

	const teamQuery = useTeam(businessId);
	const team = (teamQuery.data?.data ?? []).map((m) =>
		adaptTeamMember(m as ApiTeamMember, apiBranches),
	);

	async function handleExport() {
		if (!businessId) return;
		setExporting(true);
		try {
			const blob = await api.bookings.exportCsv({ businessId });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `bookings-${businessId}.csv`;
			a.click();
			URL.revokeObjectURL(url);
		} catch (e: unknown) {
			flash(e instanceof Error ? e.message : "Export failed");
		} finally {
			setExporting(false);
		}
	}

	const confirmMut = useConfirmBooking();
	const cancelMut = useCancelBooking();
	const completeMut = useCompleteBooking();
	const assignMut = useAssignStaff();

	if (businessQuery.isLoading || bookingsQuery.isLoading) {
		return <ScreenSkeleton rows={3} cards={4} />;
	}

	return (
		<BookingsScreen
			bookings={bookings}
			branches={apiBranches.map((b) => b.name)}
			team={team}
			onConfirm={(id) =>
				confirmMut.mutate(id, {
					onSuccess: () => flash("Booking confirmed", "CheckCircle"),
					onError: (e: Error) => flash(e.message),
				})
			}
			onDecline={(id) =>
				cancelMut.mutate(id, {
					onSuccess: () => flash("Booking declined", "XCircle"),
					onError: (e: Error) => flash(e.message),
				})
			}
			onCancel={(id) =>
				cancelMut.mutate(id, {
					onSuccess: () => flash("Booking cancelled"),
					onError: (e: Error) => flash(e.message),
				})
			}
			onComplete={(id) =>
				completeMut.mutate(id, {
					onSuccess: () => flash("Booking completed", "CheckCheck"),
					onError: (e: Error) => flash(e.message),
				})
			}
			onAssign={(bookingId, staffId) =>
				assignMut.mutate(
					{ id: bookingId, staffId },
					{
						onSuccess: () => flash("Staff assigned", "User"),
						onError: (e: Error) => flash(e.message),
					},
				)
			}
			onExport={handleExport}
			exporting={exporting}
		/>
	);
}
