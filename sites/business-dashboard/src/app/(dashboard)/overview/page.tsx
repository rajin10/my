"use client";
import type {
	Booking as ApiBooking,
	Branch as ApiBranch,
} from "@repo/api-client";
import { useRouter } from "next/navigation";
import { ScreenSkeleton } from "@/components/primitives";
import { OverviewScreen } from "@/components/screens/OverviewScreen";
import { useToast } from "@/context/toast";
import {
	useAllBranchServices,
	useBranchBookings,
	useBranches,
	useCancelBooking,
	useConfirmBooking,
	useCurrentUser,
	useMyBusiness,
	usePendingReviews,
} from "@/hooks/useOwnerData";
import { adaptBooking, adaptReview, adaptService } from "@/lib/adapters";

const MARKETING_URL = process.env.NEXT_PUBLIC_MARKETING_URL ?? "";

export default function OverviewPage() {
	const router = useRouter();
	const { flash } = useToast();

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

	const reviewsQuery = usePendingReviews(businessId);
	const reviews = (reviewsQuery.data ?? []).map(adaptReview);

	const userQuery = useCurrentUser();

	const confirmMut = useConfirmBooking();
	const cancelMut = useCancelBooking();

	if (businessQuery.isLoading || bookingsQuery.isLoading) {
		return <ScreenSkeleton rows={2} cards={4} />;
	}

	const branchCity = apiBranches[0]?.city;
	const businessUrl =
		businessId && MARKETING_URL
			? `${MARKETING_URL}/businesses/${businessId}`
			: undefined;

	return (
		<OverviewScreen
			bookings={bookings}
			reviews={reviews}
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
			goto={(screen) => router.push(`/${screen}`)}
			businessName={businessQuery.data?.name}
			ownerName={userQuery.data?.name ?? undefined}
			branchCity={branchCity}
			businessUrl={businessUrl}
		/>
	);
}
