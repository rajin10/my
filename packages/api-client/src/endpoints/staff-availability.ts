import type { ApiClient } from "../client";

export interface StaffAvailabilitySlot {
	id: string;
	teamMemberId: string;
	dayOfWeek: number;
	isClosed: boolean;
	startTime: string | null;
	endTime: string | null;
	createdAt: string;
}

export interface UpsertStaffAvailabilityBody {
	availability: {
		dayOfWeek: number;
		isClosed: boolean;
		startTime?: string | null;
		endTime?: string | null;
	}[];
}

export function createStaffAvailabilityEndpoints(client: ApiClient) {
	return {
		get: (teamMemberId: string) =>
			client.get<StaffAvailabilitySlot[]>(
				`/api/v1/team/${teamMemberId}/availability`,
			),

		upsert: (teamMemberId: string, body: UpsertStaffAvailabilityBody) =>
			client.put<StaffAvailabilitySlot[]>(
				`/api/v1/team/${teamMemberId}/availability`,
				body,
			),
	};
}
