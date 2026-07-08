import type {
	ApiResponse,
	BaseQueryDto,
	PaginatedQueryDto,
	PaginatedResponse,
} from "../../http/response";
import type { DbClient } from "../client";
import type { UserInsert, UserSelect } from "../schema";
import { usersSchema } from "../schema";
import { BaseRepository, type QueryAllowlist } from "./base.repository";

// BaseRepository uses Partial<T> to support field-selection queries.
// Domain repositories cast to the full type since they never use partial field selection.
type FullResponse<T> = ApiResponse<T | null>;
type FullPaginatedResponse<T> = PaginatedResponse<T>;

export class UsersRepository {
	private static readonly queryAllowlist: QueryAllowlist = {
		filterable: ["role"],
		// googleId and pushToken are excluded — PII / device credentials, must not be externally filterable
		searchable: ["name", "email", "phone"],
		sortable: ["createdAt", "name", "role"],
		// Response projection for the user list excludes googleId (OAuth subject),
		// pushToken (device credential), and deletedAt — they must never appear in a
		// listing, by default or via ?fields=.
		selectable: [
			"id",
			"name",
			"email",
			"phone",
			"role",
			"createdAt",
			"updatedAt",
		],
	};

	constructor(private readonly db: DbClient) {}

	async findAll(
		query: PaginatedQueryDto,
	): Promise<FullPaginatedResponse<UserSelect>> {
		const result = await BaseRepository.findAll(
			this.db,
			usersSchema,
			query,
			UsersRepository.queryAllowlist,
		);
		return result as FullPaginatedResponse<UserSelect>;
	}

	async findOne(
		id: string,
		query: BaseQueryDto,
	): Promise<FullResponse<UserSelect>> {
		const result = await BaseRepository.findOne(
			this.db,
			usersSchema,
			id,
			query,
			["id"],
		);
		return result as FullResponse<UserSelect>;
	}

	async create(data: UserInsert): Promise<FullResponse<UserSelect>> {
		const result = await BaseRepository.create(this.db, usersSchema, data);
		return result as FullResponse<UserSelect>;
	}

	async updateOne(
		id: string,
		data: Partial<UserInsert>,
		query: BaseQueryDto,
	): Promise<FullResponse<UserSelect>> {
		const result = await BaseRepository.updateOne(
			this.db,
			usersSchema,
			id,
			data,
			query,
			["id"],
		);
		return result as FullResponse<UserSelect>;
	}

	async deleteOne(
		id: string,
		query: BaseQueryDto,
	): Promise<FullResponse<UserSelect>> {
		const result = await BaseRepository.deleteOne(
			this.db,
			usersSchema,
			id,
			query,
			["id"],
		);
		return result as FullResponse<UserSelect>;
	}

	async restoreOne(
		id: string,
		query: BaseQueryDto = {},
	): Promise<FullResponse<UserSelect>> {
		const result = await BaseRepository.restoreOne(
			this.db,
			usersSchema,
			id,
			query,
			["id"],
		);
		return result as FullResponse<UserSelect>;
	}
}
