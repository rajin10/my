"use client";
import { useQuery } from "@tanstack/react-query";
import { ReviewsScreen } from "@/components/screens/ReviewsScreen";
import { useToast } from "@/context/toast";
import {
	useApproveReview,
	useMyBusiness,
	usePendingReviews,
	useRejectReview,
} from "@/hooks/useOwnerData";
import { adaptReview } from "@/lib/adapters";
import { api } from "@/lib/api";

export default function ReviewsPage() {
	const { flash } = useToast();

	const businessQ = useMyBusiness();
	const businessId = businessQ.data?.id ?? null;

	const pendingQ = usePendingReviews(businessId);
	const publishedQ = useQuery({
		queryKey: ["reviews", "published", businessId],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.reviews.list({ businessId: businessId!, limit: 50 }),
		enabled: !!businessId,
		staleTime: 60_000,
	});

	const pending = (pendingQ.data ?? []).map(adaptReview);
	const published = (publishedQ.data?.data ?? []).map(adaptReview);
	const reviews = [...pending, ...published];

	const approveMut = useApproveReview();
	const rejectMut = useRejectReview();

	return (
		<ReviewsScreen
			reviews={reviews}
			onApprove={(id) =>
				approveMut.mutate(id, {
					onSuccess: () => flash("Review published", "Check"),
					onError: (e: Error) => flash(e.message),
				})
			}
			onReject={(id) =>
				rejectMut.mutate(id, {
					onSuccess: () => flash("Review rejected"),
					onError: (e: Error) => flash(e.message),
				})
			}
		/>
	);
}
