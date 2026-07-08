import { and, eq, isNull, sql } from "drizzle-orm";
import type { ApiResponse, BaseQueryDto } from "../../http/response";
import type { DbClient } from "../client";
import type { TeamMemberInsert, TeamMemberSelect } from "../schema";
import { teamMembersSchema, usersSchema } from "../schema";
import { BaseRepository } from "./base.repository";

export class TeamRepository {
	constructor(private readonly db: DbClient) {}

	async findByBusiness(
		businessId: string,
	): Promise<(TeamMemberSelect & { userName: string })[]> {
		const rows = await this.db
			.select({
				id: teamMembersSchema.id,
				userId: teamMembersSchema.userId,
				businessId: teamMembersSchema.businessId,
				branchId: teamMembersSchema.branchId,
				title: teamMembersSchema.title,
				role: teamMembersSchema.role,
				createdAt: teamMembersSchema.createdAt,
				updatedAt: teamMembersSchema.updatedAt,
				deletedAt: teamMembersSchema.deletedAt,
				userName: sql<string>`coalesce(${usersSchema.name}, '')`,
			})
			.from(teamMembersSchema)
			.leftJoin(usersSchema, eq(teamMembersSchema.userId, usersSchema.id))
			.where(
				and(
					eq(teamMembersSchema.businessId, businessId),
					isNull(teamMembersSchema.deletedAt),
				),
			);
		return rows;
	}

	async findOne(
		id: string,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<TeamMemberSelect | null>> {
		return BaseRepository.findOne(this.db, teamMembersSchema, id, query, [
			"id",
		]) as Promise<ApiResponse<TeamMemberSelect | null>>;
	}

	async findBranchIdsByUser(userId: string): Promise<string[]> {
		const rows = await this.db
			.select({ branchId: teamMembersSchema.branchId })
			.from(teamMembersSchema)
			.where(
				and(
					eq(teamMembersSchema.userId, userId),
					isNull(teamMembersSchema.deletedAt),
				),
			);
		return rows.flatMap((r) => (r.branchId ? [r.branchId] : []));
	}

	async findMembership(
		userId: string,
		businessId: string,
	): Promise<TeamMemberSelect | null> {
		const rows = await this.db
			.select()
			.from(teamMembersSchema)
			.where(
				and(
					eq(teamMembersSchema.userId, userId),
					eq(teamMembersSchema.businessId, businessId),
					isNull(teamMembersSchema.deletedAt),
				),
			)
			.limit(1);
		return rows[0] ?? null;
	}

	async create(
		data: TeamMemberInsert,
	): Promise<ApiResponse<TeamMemberSelect | null>> {
		return BaseRepository.create(this.db, teamMembersSchema, data) as Promise<
			ApiResponse<TeamMemberSelect | null>
		>;
	}

	async updateOne(
		id: string,
		data: Partial<TeamMemberInsert>,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<TeamMemberSelect | null>> {
		return BaseRepository.updateOne(
			this.db,
			teamMembersSchema,
			id,
			data,
			query,
			["id"],
		) as Promise<ApiResponse<TeamMemberSelect | null>>;
	}

	async deleteOne(
		id: string,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<TeamMemberSelect | null>> {
		return BaseRepository.deleteOne(this.db, teamMembersSchema, id, query, [
			"id",
		]) as Promise<ApiResponse<TeamMemberSelect | null>>;
	}
}
