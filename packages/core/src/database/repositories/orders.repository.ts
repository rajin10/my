import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type {
	ApiResponse,
	BaseQueryDto,
	PaginatedQueryDto,
	PaginatedResponse,
} from "../../http/response";
import type { DbClient } from "../client";
import type {
	OrderInsert,
	OrderItemInsert,
	OrderItemSelect,
	OrderSelect,
} from "../schema";
import { orderItemsSchema, ordersSchema, productsSchema } from "../schema";
import { BaseRepository, type QueryAllowlist } from "./base.repository";

export class OrdersRepository {
	constructor(private readonly db: DbClient) {}

	private static readonly queryAllowlist: QueryAllowlist = {
		filterable: ["status", "branchId", "businessId", "userId"],
		searchable: [],
		sortable: ["createdAt", "total", "status"],
	};

	async findAll(
		query: PaginatedQueryDto,
	): Promise<PaginatedResponse<OrderSelect>> {
		return BaseRepository.findAll(
			this.db,
			ordersSchema,
			query,
			OrdersRepository.queryAllowlist,
		) as Promise<PaginatedResponse<OrderSelect>>;
	}

	async findOne(
		id: string,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<OrderSelect | null>> {
		return BaseRepository.findOne(this.db, ordersSchema, id, query, [
			"id",
		]) as Promise<ApiResponse<OrderSelect | null>>;
	}

	async findByUser(userId: string): Promise<OrderSelect[]> {
		return this.db
			.select()
			.from(ordersSchema)
			.where(
				and(eq(ordersSchema.userId, userId), isNull(ordersSchema.deletedAt)),
			)
			.orderBy(desc(ordersSchema.createdAt));
	}

	async findByWalkInLocalId(
		walkInLocalId: string,
	): Promise<OrderSelect | null> {
		const rows = await this.db
			.select()
			.from(ordersSchema)
			.where(
				and(
					eq(ordersSchema.walkInLocalId, walkInLocalId),
					isNull(ordersSchema.deletedAt),
				),
			)
			.limit(1);
		return rows[0] ?? null;
	}

	async findByBranch(branchId: string): Promise<OrderSelect[]> {
		return this.db
			.select()
			.from(ordersSchema)
			.where(
				and(
					eq(ordersSchema.branchId, branchId),
					isNull(ordersSchema.deletedAt),
				),
			);
	}

	async findItems(orderId: string): Promise<OrderItemSelect[]> {
		return this.db
			.select()
			.from(orderItemsSchema)
			.where(eq(orderItemsSchema.orderId, orderId));
	}

	/**
	 * Atomic order placement. Decrements each line's stock unconditionally (the
	 * `CHECK(stock >= 0)` aborts the whole batch on oversell), then inserts the
	 * order + items. Throws the raw SQLite/D1 error on constraint violation —
	 * the service maps it to a 409.
	 */
	async placeOrder(
		order: OrderInsert & { id: string },
		items: (OrderItemInsert & { id: string })[],
	): Promise<void> {
		await this.db.batch([
			...items.map((it) =>
				this.db
					.update(productsSchema)
					.set({ stock: sql`${productsSchema.stock} - ${it.quantity}` })
					.where(eq(productsSchema.id, it.productId)),
			),
			this.db.insert(ordersSchema).values(order),
			...items.map((it) => this.db.insert(orderItemsSchema).values(it)),
		] as never);
	}

	/**
	 * Atomic, idempotent cancel. Restores each line's stock and flips the order to
	 * Cancelled ONLY while it is still Pending/Confirmed. Returns true if THIS call
	 * performed the cancel, false if the order was already non-cancellable (a
	 * concurrent or duplicate cancel). Statement order matters: the restores run
	 * first so their subquery still sees a cancellable status; a serialized second
	 * call sees status='Cancelled', so every statement no-ops.
	 */
	async cancelAndRestore(
		orderId: string,
		items: OrderItemSelect[],
		updatedAt: string,
	): Promise<boolean> {
		const results = (await this.db.batch([
			...items.map((it) =>
				this.db
					.update(productsSchema)
					.set({ stock: sql`${productsSchema.stock} + ${it.quantity}` })
					.where(
						and(
							eq(productsSchema.id, it.productId),
							sql`(SELECT status FROM orders WHERE id = ${orderId}) IN ('Pending','Confirmed')`,
						),
					),
			),
			this.db
				.update(ordersSchema)
				.set({ status: "Cancelled", updatedAt })
				.where(
					and(
						eq(ordersSchema.id, orderId),
						inArray(ordersSchema.status, ["Pending", "Confirmed"]),
					),
				)
				.returning({ id: ordersSchema.id }),
		] as never)) as unknown[];
		const flipped = results[results.length - 1] as { id: string }[];
		return flipped.length === 1;
	}

	/**
	 * Compare-and-swap status update: flips to `status` (plus any `extra` fields)
	 * only if the row's current status still equals `expectedCurrent`. Returns the
	 * updated row, or `{ data: null }` when the CAS misses (status moved under us).
	 */
	async updateStatus(
		id: string,
		status: OrderSelect["status"],
		expectedCurrent: OrderSelect["status"],
		extra: Partial<OrderInsert> = {},
	): Promise<ApiResponse<OrderSelect | null>> {
		const rows = (await this.db
			.update(ordersSchema)
			.set({ status, updatedAt: new Date().toISOString(), ...extra })
			.where(
				and(
					eq(ordersSchema.id, id),
					eq(ordersSchema.status, expectedCurrent),
					isNull(ordersSchema.deletedAt),
				),
			)
			.returning()) as OrderSelect[];
		return { data: (rows[0] as OrderSelect) ?? null };
	}
}
