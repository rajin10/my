import { and, eq } from "drizzle-orm";
import type { DbClient } from "../client";
import type {
	StaffAvailabilityInsert,
	StaffAvailabilitySelect,
} from "../schema";
import { staffAvailabilitySchema } from "../schema";

export class StaffAvailabilityRepository {
	constructor(private readonly db: DbClient) {}

	async findByMember(teamMemberId: string): Promise<StaffAvailabilitySelect[]> {
		return this.db
			.select()
			.from(staffAvailabilitySchema)
			.where(eq(staffAvailabilitySchema.teamMemberId, teamMemberId));
	}

	async upsertDay(data: StaffAvailabilityInsert): Promise<void> {
		const existing = await this.db
			.select({ id: staffAvailabilitySchema.id })
			.from(staffAvailabilitySchema)
			.where(
				and(
					eq(staffAvailabilitySchema.teamMemberId, data.teamMemberId),
					eq(staffAvailabilitySchema.dayOfWeek, data.dayOfWeek),
				),
			)
			.limit(1);

		if (existing[0]) {
			await this.db
				.update(staffAvailabilitySchema)
				.set({
					isClosed: data.isClosed,
					startTime: data.startTime,
					endTime: data.endTime,
				})
				.where(eq(staffAvailabilitySchema.id, existing[0].id));
		} else {
			await this.db.insert(staffAvailabilitySchema).values(data);
		}
	}
}
