"use client";

import type {
	AddTeamMemberBody,
	CreateBranchBody,
	CreateBusinessBody,
	CreateCouponBody,
	CreateServiceBody,
	Service,
	UpsertBranchHoursBody,
	UpsertStaffAvailabilityBody,
} from "@repo/api-client";
import {
	useMutation,
	useQueries,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { api } from "../lib/api";

export function useMyBusiness() {
	return useQuery({
		queryKey: ["business", "owner"],
		queryFn: async () => {
			const res = await api.businesses.list({ limit: 1 });
			return res.data[0] ?? null;
		},
		staleTime: 60_000,
	});
}

export function useCreateBusiness() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: CreateBusinessBody) => api.businesses.create(body),
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

export function useCreateBranch() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: CreateBranchBody) => api.branches.create(body),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["branches"] }),
	});
}

export function useBranchBookings(
	businessId: string | null | undefined,
	params?: { status?: string },
) {
	return useQuery({
		queryKey: ["bookings", "branch", businessId, params],
		queryFn: () =>
			api.bookings.listBranch({
				businessId: businessId!,
				...params,
				limit: 100,
			}),
		enabled: !!businessId,
		staleTime: 15_000,
	});
}

export function useConfirmBooking() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.bookings.confirm(id),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
	});
}

export function useCancelBooking() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.bookings.cancel(id),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
	});
}

export function useCompleteBooking() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.bookings.complete(id),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
	});
}

export function useAssignStaff() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, staffId }: { id: string; staffId: string }) =>
			api.bookings.assign(id, { staffId }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
	});
}

export function useBranches(businessId: string | null | undefined) {
	return useQuery({
		queryKey: ["branches", businessId],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.branches.list(businessId!, { limit: 50 }),
		enabled: !!businessId,
		staleTime: 60_000,
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
		onSuccess: () => qc.invalidateQueries({ queryKey: ["branches"] }),
	});
}

export function useDeleteBranch() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.branches.delete(id),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["branches"] }),
	});
}

export function useBranchHours(branchId: string | null | undefined) {
	return useQuery({
		queryKey: ["branch-hours", branchId],
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

export function useBusinessPhotos(businessId: string | null | undefined) {
	return useQuery({
		queryKey: ["business-photos", businessId],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.businesses.listPhotos(businessId!),
		enabled: !!businessId,
		staleTime: 60_000,
	});
}

export function useUploadBusinessPhoto() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, file }: { id: string; file: File }) => {
			const fd = new FormData();
			fd.append("file", file);
			return api.businesses.uploadPhoto(id, fd);
		},
		onSuccess: (_, { id }) => {
			qc.invalidateQueries({ queryKey: ["business", "owner"] });
			qc.invalidateQueries({ queryKey: ["business-photos", id] });
		},
	});
}

export function useGetService(id: string | null | undefined) {
	return useQuery({
		queryKey: ["service", id],
		queryFn: () => api.services.get(id!),
		enabled: !!id,
		staleTime: 0,
	});
}

export function useServices(branchId: string | null | undefined) {
	return useQuery({
		queryKey: ["services", branchId],
		queryFn: () => api.services.list(branchId!, { limit: 100 }),
		enabled: !!branchId,
		staleTime: 30_000,
	});
}

export function useAllBranchServices(branchIds: string[]) {
	const results = useQueries({
		queries: branchIds.map((id) => ({
			queryKey: ["services", id],
			queryFn: () => api.services.list(id, { limit: 100 }),
			staleTime: 30_000,
		})),
	});
	const services: Service[] = results.flatMap(
		(r) => (r.data?.data ?? []) as Service[],
	);
	const isLoading = results.some((r) => r.isLoading);
	return { services, isLoading };
}

export function useCreateService() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: CreateServiceBody) => api.services.create(body),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
	});
}

export function useUpdateService() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			body,
		}: {
			id: string;
			body: Partial<Omit<CreateServiceBody, "branchId">>;
		}) => api.services.update(id, body),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
	});
}

export function useUploadServicePhoto() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, file }: { id: string; file: File }) => {
			const fd = new FormData();
			fd.append("file", file);
			return api.services.uploadPhoto(id, fd);
		},
		onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
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

export function useUpdateTeamMember() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			body,
		}: {
			id: string;
			body: Parameters<typeof api.team.update>[1];
		}) => api.team.update(id, body),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["team"] }),
	});
}

export function useSearchUsers(query: string) {
	return useQuery({
		queryKey: ["users", "search", query],
		queryFn: () => api.users.list({ search: query, limit: 10 }),
		enabled: query.length >= 2,
		staleTime: 10_000,
	});
}

export function useCurrentUser() {
	return useQuery({
		queryKey: ["auth", "me"],
		queryFn: () => api.auth.me(),
		staleTime: 5 * 60_000,
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

export function useBookingCalendar(
	branchId: string | null | undefined,
	start: string,
	end: string,
) {
	return useQuery({
		queryKey: ["bookings", "calendar", branchId, start, end],
		queryFn: () => api.bookings.calendar({ branchId: branchId!, start, end }),
		enabled: !!branchId && !!start && !!end,
		staleTime: 15_000,
	});
}

export function useRestoreBusiness() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.businesses.restore(id),
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

export function useDeleteServicePhoto() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.services.deletePhoto(id),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
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

export function useStaffAvailability(teamMemberId: string | null | undefined) {
	return useQuery({
		queryKey: ["staff-availability", teamMemberId],
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
