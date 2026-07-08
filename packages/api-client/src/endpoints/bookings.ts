import type { ApiClient } from "../client";
import type { Booking, PaginatedResponse, SingleResponse } from "../types";

export interface CalendarBooking extends Booking {
	customerName: string;
	serviceName: string;
	serviceDuration: number;
}

export interface CreateBookingBody {
	serviceId: string;
	branchId: string;
	businessId: string;
	slot: string;
	couponCode?: string;
}

export interface AssignStaffBody {
	staffId: string;
}

export function createBookingsEndpoints(client: ApiClient) {
	return {
		list: (params?: { page?: number; limit?: number; status?: string }) =>
			client.get<PaginatedResponse<Booking>>("/api/v1/bookings", params),

		get: (id: string) =>
			client.get<SingleResponse<Booking>>(`/api/v1/bookings/${id}`),

		create: (body: CreateBookingBody) =>
			client.post<SingleResponse<Booking>>("/api/v1/bookings", body),

		confirm: (id: string) =>
			client.patch<SingleResponse<Booking>>(`/api/v1/bookings/${id}/confirm`),

		complete: (id: string) =>
			client.patch<SingleResponse<Booking>>(`/api/v1/bookings/${id}/complete`),

		cancel: (id: string) =>
			client.patch<SingleResponse<Booking>>(`/api/v1/bookings/${id}/cancel`),

		assign: (id: string, body: AssignStaffBody) =>
			client.patch<SingleResponse<Booking>>(
				`/api/v1/bookings/${id}/assign`,
				body,
			),

		listBranch: (params: {
			businessId?: string;
			branchId?: string;
			status?: string;
			page?: number;
			limit?: number;
		}) =>
			client.get<PaginatedResponse<Booking>>("/api/v1/bookings/branch", params),

		calendar: (params: { branchId: string; start: string; end: string }) =>
			client.get<CalendarBooking[]>("/api/v1/bookings/calendar", params),

		exportCsv: (params: { businessId: string; status?: string }) =>
			client.getBlob("/api/v1/bookings/export", params),
	};
}
