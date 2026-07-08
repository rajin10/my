import {
	and,
	asc,
	desc,
	eq,
	getTableColumns as getColumns,
	gt,
	type InferInsertModel,
	type InferSelectModel,
	lt,
	or,
	sql,
} from "drizzle-orm";
import type { AnySQLiteTable } from "drizzle-orm/sqlite-core";
import { decodeCursor, encodeCursor } from "../../http/cursor";
import type {
	ApiResponse,
	BaseQueryDto,
	PaginatedQueryDto,
	PaginatedResponse,
} from "../../http/response";
import type { DbClient } from "../client";

export interface QueryAllowlist {
	/**
	 * Column names allowed as `?filter[col]=` keys. An explicit `[]` denies all
	 * filters; `undefined` means "all columns" and is reserved for the by-id lookup
	 * paths (findOne/updateOne/deleteOne). `findAll` substitutes an empty allowlist
	 * when none is supplied, so list filtering is opt-in.
	 */
	filterable?: string[];
	/**
	 * Column names the generic `?search=` may scan. When set, an explicit `?fields=`
	 * is intersected with this list — it can narrow the search but never widen it
	 * past the allowlist. `undefined` means "all columns" (lookup paths only).
	 */
	searchable?: string[];
	/**
	 * Column names accepted for `?sort=`. When set, a request for a column outside
	 * this list falls back to the default order instead of sorting by it.
	 * `undefined` means "any available column" (lookup paths / backward compat).
	 */
	sortable?: string[];
	/**
	 * Column names `findAll` may return. When set, the list response projects only
	 * these columns and `?fields=` is intersected with them — so an internal column
	 * (e.g. PII like `googleId`/`pushToken`) is never returned, by default or via
	 * `?fields=`. An empty intersection floors to the full `selectable` set; it never
	 * falls through to `SELECT *`. `undefined` = all columns (projection unconstrained),
	 * so column-limiting stays opt-in like `searchable`.
	 */
	selectable?: string[];
}

/**
 * Safe default for `findAll` when a repository supplies no allowlist: no column
 * is filterable, searchable, or sortable until explicitly opted in. Defense-in-depth
 * so a new list route can't accidentally expose internal columns.
 */
const EMPTY_ALLOWLIST: QueryAllowlist = {
	filterable: [],
	searchable: [],
	sortable: [],
};

// biome-ignore lint/complexity/noStaticOnlyClass: intentional static utility namespace; converting to module functions would require changes across all callers
export class BaseRepository {
	private static getTableContext<TTable extends AnySQLiteTable>(table: TTable) {
		const tableColumns = getColumns(table) as Record<string, unknown>;
		const availableColumnKeys = Object.keys(tableColumns);

		return {
			tableColumns,
			availableColumnKeys,
		};
	}

	private static resolveSortExpr(
		tableColumns: Record<string, unknown>,
		availableColumnKeys: string[],
		query: BaseQueryDto,
		allowlist?: QueryAllowlist,
	) {
		const defaultSortKey = availableColumnKeys.includes("createdAt")
			? "createdAt"
			: availableColumnKeys.includes("id")
				? "id"
				: availableColumnKeys[0];

		// A requested sort column is honored only if it exists AND (when a sortable
		// allowlist is declared) is in that allowlist. Otherwise fall back to the
		// default order. `undefined` sortable = any available column (lookup paths).
		const requestedSortKey = query.sort;
		const isRequestAllowed =
			!!requestedSortKey &&
			availableColumnKeys.includes(requestedSortKey) &&
			(allowlist?.sortable === undefined ||
				allowlist.sortable.includes(requestedSortKey));
		const sortKey = isRequestAllowed ? requestedSortKey : defaultSortKey;

		const fallbackKey = availableColumnKeys[0];
		const resolvedSortKey = sortKey ?? fallbackKey;

		return query.sortBy === "asc"
			? asc(tableColumns[resolvedSortKey] as never)
			: desc(tableColumns[resolvedSortKey] as never);
	}

	private static addSoftDeleteCondition(
		whereConditions: unknown[],
		tableColumns: Record<string, unknown>,
		query: BaseQueryDto,
	) {
		if ("deletedAt" in tableColumns && query.withDeleted !== true) {
			whereConditions.push(sql`${tableColumns.deletedAt as never} is null`);
		}
	}

	private static addFilterConditions(
		whereConditions: unknown[],
		tableColumns: Record<string, unknown>,
		availableColumnKeys: string[],
		query: BaseQueryDto,
		allowlist?: QueryAllowlist,
	) {
		if (!query.filters) {
			return;
		}

		const allowedKeys =
			allowlist?.filterable !== undefined
				? allowlist.filterable
				: availableColumnKeys;

		for (const [rawKey, rawValue] of Object.entries(query.filters)) {
			if (!allowedKeys.includes(rawKey)) {
				continue;
			}

			if (rawValue.trim().length === 0) {
				continue;
			}

			whereConditions.push(
				sql`cast(${tableColumns[rawKey] as never} as text) = ${rawValue}`,
			);
		}
	}

	private static addSearchCondition(
		whereConditions: unknown[],
		tableColumns: Record<string, unknown>,
		availableColumnKeys: string[],
		query: BaseQueryDto,
		allowlist?: QueryAllowlist,
	) {
		const searchTerm = query.search?.trim();
		if (!searchTerm) {
			return;
		}

		// `?fields=` may *narrow* the search to a subset, but when a searchable
		// allowlist is declared it can never widen past it — intersect the two so a
		// caller can't smuggle a non-searchable column (e.g. PII) in via `fields`.
		// `undefined` searchable = all columns (lookup paths / backward compat).
		const allowedSearch = allowlist?.searchable;
		const candidateKeys = query.fields
			? allowedSearch !== undefined
				? query.fields.filter((field) => allowedSearch.includes(field))
				: query.fields
			: (allowedSearch ?? availableColumnKeys);

		const searchableKeys = candidateKeys.filter((field) =>
			availableColumnKeys.includes(field),
		);

		if (searchableKeys.length === 0) {
			return;
		}

		const searchPredicates = searchableKeys.map(
			(key) =>
				sql`cast(${tableColumns[key] as never} as text) like ${`%${searchTerm}%`}`,
		);

		whereConditions.push(sql`(${sql.join(searchPredicates, sql` OR `)})`);
	}

	private static getSelectedFields(
		fields: string[] | undefined,
		availableColumnKeys: string[],
		selectable?: string[],
	) {
		// No selectable allowlist → unconstrained: project the requested fields, or
		// `[]` (which the caller treats as "SELECT *"). Reserved for lookup paths.
		if (selectable === undefined) {
			return (
				fields?.filter((field) => availableColumnKeys.includes(field)) ?? []
			);
		}

		// Selectable declared → the response is limited to these columns. A requested
		// `?fields=` may narrow to a subset but never widen past the allowlist. An empty
		// intersection floors to the full selectable set — it must NOT fall through to
		// `SELECT *`, or an internal column (e.g. `?fields=googleId`) would re-leak.
		let projected = fields
			? fields.filter((field) => selectable.includes(field))
			: selectable;
		if (projected.length === 0) {
			projected = selectable;
		}
		return projected.filter((field) => availableColumnKeys.includes(field));
	}

	private static addLookupCondition(
		whereConditions: unknown[],
		tableColumns: Record<string, unknown>,
		value: string | number,
		keys: readonly unknown[],
	) {
		const lookupKeys = keys
			.map((key) => String(key))
			.filter((key) => key in tableColumns);

		if (lookupKeys.length === 0) {
			return false;
		}

		const targetValue = String(value);
		const lookupPredicates = lookupKeys.map(
			(key) =>
				sql`cast(${tableColumns[key] as never} as text) = ${targetValue}`,
		);

		whereConditions.push(sql`(${sql.join(lookupPredicates, sql` OR `)})`);

		return true;
	}

	private static buildWhereClause(whereConditions: unknown[]) {
		return whereConditions.length > 0
			? sql`${sql.join(whereConditions as never[], sql` AND `)}`
			: undefined;
	}

	static async create<TTable extends AnySQLiteTable>(
		db: DbClient,
		table: TTable,
		values: Partial<InferInsertModel<TTable>>,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<Partial<InferSelectModel<TTable>> | null>> {
		const payload = Object.fromEntries(
			Object.entries(values).filter(([, value]) => value !== undefined),
		) as Record<string, unknown>;

		if (Object.keys(payload).length === 0) {
			return {
				data: null,
				query,
			};
		}

		const rows = (await db
			.insert(table)
			.values(payload as never)
			.returning()) as InferSelectModel<TTable>[];

		return {
			data: (rows[0] ?? null) as Partial<InferSelectModel<TTable>> | null,
			query,
		};
	}

	static async findAll<TTable extends AnySQLiteTable>(
		db: DbClient,
		table: TTable,
		query: PaginatedQueryDto,
		allowlist?: QueryAllowlist,
	): Promise<PaginatedResponse<Partial<InferSelectModel<TTable>>>> {
		const { tableColumns, availableColumnKeys } =
			BaseRepository.getTableContext(table);

		// Generic list query power is opt-in: an undeclared allowlist defaults to the
		// safe-empty one, so a list route can't expose internal columns by accident.
		const effectiveAllowlist = allowlist ?? EMPTY_ALLOWLIST;

		const currentLimit = query.limit ?? 10;

		const whereConditions: unknown[] = [];
		BaseRepository.addSoftDeleteCondition(whereConditions, tableColumns, query);
		BaseRepository.addFilterConditions(
			whereConditions,
			tableColumns,
			availableColumnKeys,
			query,
			effectiveAllowlist,
		);
		BaseRepository.addSearchCondition(
			whereConditions,
			tableColumns,
			availableColumnKeys,
			query,
			effectiveAllowlist,
		);

		// ── Cursor mode ──────────────────────────────────────────────────────────
		// Keyset pagination on the stable composite key (createdAt, id). Honors the
		// requested sort *direction* (sortBy); the sort *column* is not used in
		// cursor mode. A malformed cursor degrades to the first page. `page` is
		// ignored. Requires both `createdAt` and `id` columns.
		if (
			query.cursor !== undefined &&
			"id" in tableColumns &&
			"createdAt" in tableColumns
		) {
			const idCol = tableColumns.id as never;
			const createdAtCol = tableColumns.createdAt as never;
			const isAsc = query.sortBy === "asc";

			if (query.cursor !== "") {
				const parts = decodeCursor(query.cursor);
				if (parts) {
					const keyset = isAsc
						? or(
								gt(createdAtCol, parts.createdAt),
								and(eq(createdAtCol, parts.createdAt), gt(idCol, parts.id)),
							)
						: or(
								lt(createdAtCol, parts.createdAt),
								and(eq(createdAtCol, parts.createdAt), lt(idCol, parts.id)),
							);
					whereConditions.push(keyset);
				}
				// parts === null → malformed cursor → no keyset → first page
			}

			const orderExprs = isAsc
				? [asc(createdAtCol), asc(idCol)]
				: [desc(createdAtCol), desc(idCol)];

			const whereClause = BaseRepository.buildWhereClause(whereConditions);

			const baseQuery = db
				.select()
				.from(table)
				// Fetch one extra row to detect whether another page exists
				.limit(currentLimit + 1)
				.orderBy(...orderExprs);

			const rows = (
				whereClause ? await baseQuery.where(whereClause) : await baseQuery
			) as InferSelectModel<TTable>[];

			const hasNextPage = rows.length > currentLimit;
			const results = rows.slice(0, currentLimit) as Partial<
				InferSelectModel<TTable>
			>[];
			const lastRow = results[results.length - 1] as
				| Record<string, unknown>
				| undefined;
			const nextCursor =
				hasNextPage && lastRow
					? encodeCursor(String(lastRow.createdAt), String(lastRow.id))
					: null;

			return {
				data: results,
				query: {
					...query,
					page: 1,
					limit: currentLimit,
					total: 0,
					totalPages: 0,
					hasNextPage,
					hasPrevPage: false,
					mode: "cursor",
					nextCursor,
				},
			};
		}

		// ── Offset mode (default) ────────────────────────────────────────────────
		const currentPage = query.page ?? 1;
		const sortExpr = BaseRepository.resolveSortExpr(
			tableColumns,
			availableColumnKeys,
			query,
			effectiveAllowlist,
		);
		const whereClause = BaseRepository.buildWhereClause(whereConditions);
		const selectedFields = BaseRepository.getSelectedFields(
			query.fields,
			availableColumnKeys,
			effectiveAllowlist.selectable,
		);
		const selectedColumns = Object.fromEntries(
			selectedFields.map((field) => [field, tableColumns[field] as never]),
		);
		const hasSelectedColumns = Object.keys(selectedColumns).length > 0;

		let results: Partial<InferSelectModel<TTable>>[];

		if (hasSelectedColumns) {
			const baseQuery = db
				.select(selectedColumns)
				.from(table)
				.orderBy(sortExpr)
				.limit(currentLimit)
				.offset((currentPage - 1) * currentLimit);

			results = (
				whereClause ? await baseQuery.where(whereClause) : await baseQuery
			) as Partial<InferSelectModel<TTable>>[];
		} else {
			const baseQuery = db
				.select()
				.from(table)
				.orderBy(sortExpr)
				.limit(currentLimit)
				.offset((currentPage - 1) * currentLimit);

			results = (
				whereClause ? await baseQuery.where(whereClause) : await baseQuery
			) as Partial<InferSelectModel<TTable>>[];
		}

		const totalRows = whereClause
			? await db
					.select({ count: sql<number>`count(*)` })
					.from(table)
					.where(whereClause)
			: await db.select({ count: sql<number>`count(*)` }).from(table);

		const count = totalRows[0]?.count ?? 0;
		const totalPages = Math.ceil(count / currentLimit);

		return {
			data: results,
			query: {
				...query,
				page: currentPage,
				limit: currentLimit,
				total: count,
				totalPages,
				hasNextPage: currentPage < totalPages,
				hasPrevPage: currentPage > 1,
				mode: "offset",
			},
		};
	}

	static async findOne<TTable extends AnySQLiteTable>(
		db: DbClient,
		table: TTable,
		value: string | number,
		query: BaseQueryDto,
		keys: (keyof InferSelectModel<TTable>)[] = [
			"id" as keyof InferSelectModel<TTable>,
		],
	): Promise<ApiResponse<Partial<InferSelectModel<TTable>> | null>> {
		const { tableColumns, availableColumnKeys } =
			BaseRepository.getTableContext(table);
		const sortExpr = BaseRepository.resolveSortExpr(
			tableColumns,
			availableColumnKeys,
			query,
		);

		const whereConditions: unknown[] = [];
		BaseRepository.addSoftDeleteCondition(whereConditions, tableColumns, query);

		const hasLookup = BaseRepository.addLookupCondition(
			whereConditions,
			tableColumns,
			value,
			keys,
		);

		if (!hasLookup) {
			return {
				data: null,
				query,
			};
		}

		BaseRepository.addFilterConditions(
			whereConditions,
			tableColumns,
			availableColumnKeys,
			query,
		);
		BaseRepository.addSearchCondition(
			whereConditions,
			tableColumns,
			availableColumnKeys,
			query,
		);

		const whereClause = BaseRepository.buildWhereClause(whereConditions);

		const rows = whereClause
			? await db
					.select()
					.from(table)
					.where(whereClause)
					.orderBy(sortExpr)
					.limit(1)
			: await db.select().from(table).orderBy(sortExpr).limit(1);

		const selectedFields = BaseRepository.getSelectedFields(
			query.fields,
			availableColumnKeys,
		);

		const row = rows[0] as InferSelectModel<TTable> | undefined;
		const rowRecord = row as Record<string, unknown> | undefined;
		const data =
			row && selectedFields.length > 0
				? (Object.fromEntries(
						selectedFields.map((field) => [field, rowRecord?.[field]]),
					) as Partial<InferSelectModel<TTable>>)
				: ((row ?? null) as Partial<InferSelectModel<TTable>> | null);

		return {
			data,
			query,
		};
	}

	static async updateOne<TTable extends AnySQLiteTable>(
		db: DbClient,
		table: TTable,
		value: string | number,
		values: Partial<InferInsertModel<TTable>>,
		query: BaseQueryDto = {},
		keys: (keyof InferSelectModel<TTable>)[] = [
			"id" as keyof InferSelectModel<TTable>,
		],
	): Promise<ApiResponse<Partial<InferSelectModel<TTable>> | null>> {
		const { tableColumns, availableColumnKeys } =
			BaseRepository.getTableContext(table);
		const hasColumn = (key: string) => key in tableColumns;

		const payload = Object.fromEntries(
			Object.entries(values)
				.filter(([key, value]) => {
					if (value === undefined) {
						return false;
					}

					if (key === "id" || key === "createdAt" || key === "deletedAt") {
						return false;
					}

					return availableColumnKeys.includes(key);
				})
				.map(([key, value]) => [key, value]),
		) as Record<string, unknown>;

		if (Object.keys(payload).length === 0) {
			return {
				data: null,
				query,
			};
		}

		if (hasColumn("updatedAt")) {
			payload.updatedAt = new Date().toISOString();
		}

		const whereConditions: unknown[] = [];
		BaseRepository.addSoftDeleteCondition(whereConditions, tableColumns, query);

		const hasLookup = BaseRepository.addLookupCondition(
			whereConditions,
			tableColumns,
			value,
			keys,
		);

		if (!hasLookup) {
			return {
				data: null,
				query,
			};
		}

		BaseRepository.addFilterConditions(
			whereConditions,
			tableColumns,
			availableColumnKeys,
			query,
		);

		const whereClause = BaseRepository.buildWhereClause(whereConditions);
		if (!whereClause) {
			return {
				data: null,
				query,
			};
		}

		const rows = (await db
			.update(table)
			.set(payload as never)
			.where(whereClause)
			.returning()) as InferSelectModel<TTable>[];

		return {
			data: (rows[0] ?? null) as Partial<InferSelectModel<TTable>> | null,
			query,
		};
	}

	static async deleteOne<TTable extends AnySQLiteTable>(
		db: DbClient,
		table: TTable,
		value: string | number,
		query: BaseQueryDto = {},
		keys: (keyof InferSelectModel<TTable>)[] = [
			"id" as keyof InferSelectModel<TTable>,
		],
	): Promise<ApiResponse<Partial<InferSelectModel<TTable>> | null>> {
		const { tableColumns, availableColumnKeys } =
			BaseRepository.getTableContext(table);
		const hasColumn = (key: string) => key in tableColumns;

		const whereConditions: unknown[] = [];
		BaseRepository.addSoftDeleteCondition(whereConditions, tableColumns, query);

		const hasLookup = BaseRepository.addLookupCondition(
			whereConditions,
			tableColumns,
			value,
			keys,
		);

		if (!hasLookup) {
			return {
				data: null,
				query,
			};
		}

		BaseRepository.addFilterConditions(
			whereConditions,
			tableColumns,
			availableColumnKeys,
			query,
		);

		const whereClause = BaseRepository.buildWhereClause(whereConditions);
		if (!whereClause) {
			return {
				data: null,
				query,
			};
		}

		if (hasColumn("deletedAt")) {
			const payload: Record<string, unknown> = {
				deletedAt: new Date().toISOString(),
			};

			if (hasColumn("updatedAt")) {
				payload.updatedAt = new Date().toISOString();
			}

			const rows = (await db
				.update(table)
				.set(payload as never)
				.where(whereClause)
				.returning()) as InferSelectModel<TTable>[];

			return {
				data: (rows[0] ?? null) as Partial<InferSelectModel<TTable>> | null,
				query,
			};
		}

		const existingRow = await BaseRepository.findOne(
			db,
			table,
			value,
			{ withDeleted: true },
			keys,
		);
		if (!existingRow.data) {
			return {
				data: null,
				query,
			};
		}

		await db.delete(table).where(whereClause);

		return {
			data: existingRow.data,
			query,
		};
	}

	static async restoreOne<TTable extends AnySQLiteTable>(
		db: DbClient,
		table: TTable,
		value: string | number,
		query: BaseQueryDto = {},
		keys: (keyof InferSelectModel<TTable>)[] = [
			"id" as keyof InferSelectModel<TTable>,
		],
	): Promise<ApiResponse<Partial<InferSelectModel<TTable>> | null>> {
		const { tableColumns } = BaseRepository.getTableContext(table);

		if (!("deletedAt" in tableColumns)) {
			return { data: null, query };
		}

		const whereConditions: unknown[] = [
			sql`${tableColumns.deletedAt as never} is not null`,
		];
		const hasLookup = BaseRepository.addLookupCondition(
			whereConditions,
			tableColumns,
			value,
			keys,
		);
		if (!hasLookup) return { data: null, query };

		const whereClause = BaseRepository.buildWhereClause(whereConditions);
		if (!whereClause) return { data: null, query };

		const payload: Record<string, unknown> = { deletedAt: null };
		if ("updatedAt" in tableColumns)
			payload.updatedAt = new Date().toISOString();

		const rows = (await db
			.update(table)
			.set(payload as never)
			.where(whereClause)
			.returning()) as InferSelectModel<TTable>[];

		return {
			data: (rows[0] ?? null) as Partial<InferSelectModel<TTable>> | null,
			query,
		};
	}
}
