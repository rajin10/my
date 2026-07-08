import { and, eq, isNull } from "drizzle-orm";
import type {
	ApiResponse,
	BaseQueryDto,
	PaginatedQueryDto,
	PaginatedResponse,
} from "../../http/response";
import type { DbClient } from "../client";
import type {
	BranchHoursInsert,
	BranchHoursSelect,
	BranchInsert,
	BranchSelect,
} from "../schema";
import { branchesSchema } from "../schema";
import { BaseRepository, type QueryAllowlist } from "./base.repository";
import { BranchHoursRepository } from "./branch-hours.repository";

export class BranchesRepository {
	private static readonly queryAllowlist: QueryAllowlist = {
		filterable: ["businessId", "city"],
		searchable: ["name", "city", "address"],
		sortable: ["createdAt", "name", "city"],
	};

	constructor(private readonly db: DbClient) {}

	async findAll(
		query: PaginatedQueryDto,
	): Promise<PaginatedResponse<BranchSelect>> {
		return BaseRepository.findAll(
			this.db,
			branchesSchema,
			query,
			BranchesRepository.queryAllowlist,
		) as Promise<PaginatedResponse<BranchSelect>>;
	}

	async findOne(
		id: string,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<BranchSelect | null>> {
		return BaseRepository.findOne(this.db, branchesSchema, id, query, [
			"id",
		]) as Promise<ApiResponse<BranchSelect | null>>;
	}

	async findByBusiness(businessId: string): Promise<BranchSelect[]> {
		return this.db
			.select()
			.from(branchesSchema)
			.where(
				and(
					eq(branchesSchema.businessId, businessId),
					isNull(branchesSchema.deletedAt),
				),
			);
	}

	async create(data: BranchInsert): Promise<ApiResponse<BranchSelect | null>> {
		return BaseRepository.create(this.db, branchesSchema, data) as Promise<
			ApiResponse<BranchSelect | null>
		>;
	}

	async updateOne(
		id: string,
		data: Partial<BranchInsert>,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<BranchSelect | null>> {
		return BaseRepository.updateOne(this.db, branchesSchema, id, data, query, [
			"id",
		]) as Promise<ApiResponse<BranchSelect | null>>;
	}

	async deleteOne(
		id: string,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<BranchSelect | null>> {
		return BaseRepository.deleteOne(this.db, branchesSchema, id, query, [
			"id",
		]) as Promise<ApiResponse<BranchSelect | null>>;
	}

	findHours(branchId: string): Promise<BranchHoursSelect[]> {
		return new BranchHoursRepository(this.db).findByBranch(branchId);
	}

	upsertHour(data: BranchHoursInsert): Promise<BranchHoursSelect> {
		return new BranchHoursRepository(this.db).upsertDay(data);
	}

	findHoursForSlot(
		branchId: string,
		dayOfWeek: number,
	): Promise<BranchHoursSelect | undefined> {
		return new BranchHoursRepository(this.db).findForSlot(branchId, dayOfWeek);
	}
}
