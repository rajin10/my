import type {
	AddTeamMemberBody,
	BrandPalette,
	CreateCampaignBody,
	CreateCouponBody,
	OrderStatus,
	RecordPaymentBody,
	UpdateCampaignBody,
	UpsertBranchHoursBody,
	UpsertStaffAvailabilityBody,
} from "@repo/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

// The owner's saved brand palette (or null → Talash defaults). Reads the same
// `["business", "owner"]` cache that `AppProvider` populates — `enabled: false`
// means it never re-fetches (no duplicate or pre-auth request); it just tracks
// that cache reactively so the theme boundary repaints when the palette changes.
export function useBrandPalette(): BrandPalette | null {
	const { data } = useQuery({
		queryKey: ["business", "owner"],
		queryFn: async () =>
			(await api.businesses.list({ limit: 1 })).data[0] ?? null,
		enabled: false,
		staleTime: 60_000,
	});
	return data?.brandPalette ?? null;
}

// Persists the owner's brand palette (or `null` to revert to Talash defaults) via
// the #57 API, then refreshes the owner business so `useBrandPalette`/`ThemeBoundary`
// repaint. Contrast/hex validity is enforced server-side at save (#59).
export function useSaveBrandPalette(businessId: string | null | undefined) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (palette: BrandPalette | null) =>
			api.businesses.update(businessId ?? "", { brandPalette: palette }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["business", "owner"] }),
	});
}

export function usePendingReviews(businessId: string | null | undefined) {
	return useQuery({
		queryKey: ["reviews", "pending", businessId],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () =>
			api.reviews.listPending({ businessId: businessId!, limit: 50 }),
		enabled: !!businessId,
		staleTime: 30_000,
	});
}

export function useBusinessReviews(businessId: string | null | undefined) {
	return useQuery({
		queryKey: ["reviews", "business", businessId],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.reviews.list({ businessId: businessId!, limit: 50 }),
		enabled: !!businessId,
		staleTime: 30_000,
	});
}

export function useApproveReview() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.reviews.approve(id),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["reviews"] }),
	});
}

export function useRejectReview() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.reviews.reject(id),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["reviews"] }),
	});
}

export function useCoupons(businessId: string | null | undefined) {
	return useQuery({
		queryKey: ["coupons", businessId],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.coupons.list({ businessId: businessId!, limit: 50 }),
		enabled: !!businessId,
		staleTime: 30_000,
	});
}

export function useCreateCoupon() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: CreateCouponBody) => api.coupons.create(body),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons"] }),
	});
}

export function useDeleteCoupon() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.coupons.delete(id),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons"] }),
	});
}

export function useTeam(businessId: string | null | undefined) {
	return useQuery({
		queryKey: ["team", businessId],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.team.list({ businessId: businessId!, limit: 50 }),
		enabled: !!businessId,
		staleTime: 60_000,
	});
}

export function useAddTeamMember() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: AddTeamMemberBody) => api.team.add(body),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["team"] }),
	});
}

export function useRemoveTeamMember() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.team.remove(id),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["team"] }),
	});
}

export function useUserSearch(search: string) {
	return useQuery({
		queryKey: ["users", "search", search],
		queryFn: () => api.users.list({ search, limit: 10 }),
		enabled: search.trim().length >= 2,
		staleTime: 10_000,
	});
}

export function useUpdateBranch() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			body,
		}: {
			id: string;
			body: Parameters<typeof api.branches.update>[1];
		}) => api.branches.update(id, body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["branches"] });
			qc.invalidateQueries({ queryKey: ["business-content"] });
		},
	});
}

export function useDeleteBranch() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.branches.delete(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["branches"] });
			qc.invalidateQueries({ queryKey: ["business-content"] });
		},
	});
}

export function useBranchHours(branchId: string | null | undefined) {
	return useQuery({
		queryKey: ["branch-hours", branchId],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.branches.getHours(branchId!),
		enabled: !!branchId,
		staleTime: 120_000,
	});
}

export function useUpsertBranchHours() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, body }: { id: string; body: UpsertBranchHoursBody }) =>
			api.branches.upsertHours(id, body),
		onSuccess: (_, { id }) =>
			qc.invalidateQueries({ queryKey: ["branch-hours", id] }),
	});
}

export function useCampaigns(businessId: string | null | undefined) {
	return useQuery({
		queryKey: ["campaigns", businessId],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.campaigns.list({ businessId: businessId! }),
		enabled: !!businessId,
		staleTime: 30_000,
	});
}

export function useCustomers(businessId: string | null | undefined) {
	return useQuery({
		queryKey: ["customers", businessId],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.customers.list({ businessId: businessId! }),
		enabled: !!businessId,
		staleTime: 60_000,
	});
}

export function useCreateCampaign() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: CreateCampaignBody) => api.campaigns.create(body),
		onSuccess: (_, body) =>
			qc.invalidateQueries({ queryKey: ["campaigns", body.businessId] }),
	});
}

export function useUpdateCampaign(businessId: string | null | undefined) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, body }: { id: string; body: UpdateCampaignBody }) =>
			api.campaigns.update(id, body),
		onSuccess: () => {
			if (businessId)
				qc.invalidateQueries({ queryKey: ["campaigns", businessId] });
		},
	});
}

export function useSendCampaign(businessId: string | null | undefined) {
	const qc = useQueryClient();
	return useMutation({
		// biome-ignore lint/style/noNonNullAssertion: guarded by businessId check in caller
		mutationFn: (id: string) =>
			api.campaigns.send(id, { businessId: businessId! }),
		onSuccess: () => {
			if (businessId)
				qc.invalidateQueries({ queryKey: ["campaigns", businessId] });
		},
	});
}

export function useDeleteCampaign(businessId: string | null | undefined) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.campaigns.delete(id),
		onSuccess: () => {
			if (businessId)
				qc.invalidateQueries({ queryKey: ["campaigns", businessId] });
		},
	});
}

export function useBusinessPhotos(businessId: string | null | undefined) {
	return useQuery({
		queryKey: ["business-photos", businessId],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.businesses.listPhotos(businessId!),
		enabled: !!businessId,
		staleTime: 60_000,
	});
}

export function useRestoreVenue() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.businesses.restore(id),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["business", "owner"] }),
	});
}

export function useDeleteBusiness() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.businesses.delete(id),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["business", "owner"] }),
	});
}

export function useDeleteBusinessPhoto() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			businessId,
			photoId,
		}: {
			businessId: string;
			photoId: string;
		}) => api.businesses.deletePhoto(businessId, photoId),
		onSuccess: (_, { businessId }) =>
			qc.invalidateQueries({ queryKey: ["business-photos", businessId] }),
	});
}

export function useReorderBusinessPhotos() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			businessId,
			orders,
		}: {
			businessId: string;
			orders: { id: string; order: number }[];
		}) => api.businesses.reorderPhotos(businessId, orders),
		onSuccess: (_, { businessId }) =>
			qc.invalidateQueries({ queryKey: ["business-photos", businessId] }),
	});
}

export function useDeleteServicePhoto() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.services.deletePhoto(id),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["business-content"] }),
	});
}

export function useDeleteProductPhoto() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.products.deletePhoto(id),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["business-products"] }),
	});
}

export function useNotifications() {
	return useQuery({
		queryKey: ["notifications"],
		queryFn: () => api.notifications.list({ limit: 50 }),
		staleTime: 15_000,
	});
}

export function useMarkNotificationRead() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.notifications.markRead(id),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
	});
}

export function useMarkAllNotificationsRead() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => api.notifications.markAllRead(),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
	});
}

export function useStaffAvailability(teamMemberId: string | null | undefined) {
	return useQuery({
		queryKey: ["staff-availability", teamMemberId],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.staffAvailability.get(teamMemberId!),
		enabled: !!teamMemberId,
		staleTime: 120_000,
	});
}

export function useUpsertStaffAvailability() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			body,
		}: {
			id: string;
			body: UpsertStaffAvailabilityBody;
		}) => api.staffAvailability.upsert(id, body),
		onSuccess: (_, { id }) =>
			qc.invalidateQueries({ queryKey: ["staff-availability", id] }),
	});
}

// ── Orders (commerce) ────────────────────────────────────────────────────────

/** Orders across one or more branches (the API is per-branch; we merge). */
export function useBranchOrders(branchIds: string[]) {
	return useQuery({
		queryKey: ["branch-orders", [...branchIds].sort().join(",")],
		enabled: branchIds.length > 0,
		queryFn: async () => {
			const results = await Promise.all(
				branchIds.map((id) => api.orders.listByBranch(id)),
			);
			return results.flat();
		},
	});
}

export function useOrder(orderId: string | null) {
	return useQuery({
		queryKey: ["order", orderId],
		enabled: !!orderId,
		queryFn: () => api.orders.get(orderId as string),
	});
}

export function useUpdateOrderStatus() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
			api.orders.updateStatus(id, status),
		onSuccess: (_data, { id }) => {
			qc.invalidateQueries({ queryKey: ["branch-orders"] });
			qc.invalidateQueries({ queryKey: ["order", id] });
		},
	});
}

// ── Khata (commerce) ─────────────────────────────────────────────────────────

export function useKhataDues(businessId: string | null) {
	return useQuery({
		queryKey: ["khata-dues", businessId],
		enabled: !!businessId,
		queryFn: () => api.khata.dues(businessId as string),
	});
}

export function useKhataCustomer(
	userId: string | null,
	businessId: string | null,
) {
	return useQuery({
		queryKey: ["khata-customer", userId, businessId],
		enabled: !!userId && !!businessId,
		queryFn: () =>
			api.khata.customerLedger(userId as string, businessId as string),
	});
}

export function useRecordPayment() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: RecordPaymentBody) => api.payments.record(body),
		onSuccess: (_data, body) => {
			qc.invalidateQueries({ queryKey: ["khata-dues"] });
			qc.invalidateQueries({
				queryKey: ["khata-customer", body.userId, body.businessId],
			});
		},
	});
}

export function useVoidPayment() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.payments.void(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["khata-dues"] });
			qc.invalidateQueries({ queryKey: ["khata-customer"] });
		},
	});
}
