import type { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import type { CustomerAddressesRepository } from "@repo/core/src/database/repositories/customer-addresses.repository";
import type { OrdersRepository } from "@repo/core/src/database/repositories/orders.repository";
import type { ProductsRepository } from "@repo/core/src/database/repositories/products.repository";
import type {
	OrderItemInsert,
	OrderSelect,
	OrderStatusType,
} from "@repo/core/src/database/schema";
import type { QueueProducer } from "@repo/core/src/queue/producer";
import type { AuthorizationService } from "../../core/authorization";
import {
	ConflictError,
	ForbiddenError,
	NotFoundError,
	ValidationError,
} from "../../core/errors";

export interface PlaceOrderInput {
	branchId: string;
	addressId: string;
	items: { productId: string; quantity: number }[];
}

export interface CounterWalkInInput {
	branchId: string;
	items: { productId: string; quantity: number }[];
	userId?: string | null;
	guestName?: string | null;
	guestPhone?: string | null;
	walkInLocalId?: string | null;
}

const ALLOWED_TRANSITIONS: Record<OrderStatusType, OrderStatusType[]> = {
	Pending: ["Confirmed"],
	Confirmed: ["OutForDelivery"],
	OutForDelivery: ["Delivered"],
	Delivered: [],
	Cancelled: [],
};

export class OrdersService {
	constructor(
		private readonly repo: OrdersRepository,
		private readonly addressesRepo: CustomerAddressesRepository,
		private readonly branchesRepo: BranchesRepository,
		private readonly productsRepo: ProductsRepository,
		private readonly authz: AuthorizationService,
		private readonly queue: QueueProducer,
	) {}

	async create(userId: string, input: PlaceOrderInput): Promise<OrderSelect> {
		if (input.items.length === 0) {
			throw new ValidationError("An order must contain at least one item");
		}

		const branch = await this.branchesRepo.findOne(input.branchId);
		if (!branch.data) throw new NotFoundError("Branch not found");
		const businessId = branch.data.businessId;

		const address = await this.addressesRepo.findOne(input.addressId);
		if (!address.data) throw new NotFoundError("Address not found");
		if (address.data.userId !== userId) {
			throw new ForbiddenError("You do not own this address");
		}

		let total = 0;
		const items: (OrderItemInsert & { id: string })[] = [];
		const orderId = crypto.randomUUID();
		for (const line of input.items) {
			const product = await this.productsRepo.findOne(line.productId);
			if (!product.data)
				throw new NotFoundError(`Product ${line.productId} not found`);
			if (product.data.branchId !== input.branchId) {
				throw new ValidationError(
					"All items must belong to the order's branch",
				);
			}
			const unitPrice = product.data.price;
			total += unitPrice * line.quantity;
			items.push({
				id: crypto.randomUUID(),
				orderId,
				productId: line.productId,
				quantity: line.quantity,
				unitPrice,
			});
		}

		const order = {
			id: orderId,
			businessId,
			branchId: input.branchId,
			userId,
			status: "Pending" as const,
			total,
			deliveryLine: address.data.line,
			deliveryArea: address.data.area ?? null,
			deliveryCity: address.data.city ?? null,
			deliveryLat: address.data.lat ?? null,
			deliveryLng: address.data.lng ?? null,
			deliveredAt: null,
		};

		try {
			await this.repo.placeOrder(order, items);
		} catch (err) {
			if (
				err instanceof Error &&
				err.message.includes("CHECK constraint failed")
			) {
				throw new ConflictError("One or more items are out of stock");
			}
			throw err;
		}

		// placeOrder is a void batch; the in-memory snapshot we just persisted is the source of truth for the inserted row.
		return order as OrderSelect;
	}

	async createCounterWalkIn(input: CounterWalkInInput): Promise<OrderSelect> {
		if (input.items.length === 0) {
			throw new ValidationError("An order must contain at least one item");
		}

		const branch = await this.branchesRepo.findOne(input.branchId);
		if (!branch.data) throw new NotFoundError("Branch not found");
		const businessId = branch.data.businessId;

		let total = 0;
		const items: (OrderItemInsert & { id: string })[] = [];
		const orderId = crypto.randomUUID();
		for (const line of input.items) {
			const product = await this.productsRepo.findOne(line.productId);
			if (!product.data)
				throw new NotFoundError(`Product ${line.productId} not found`);
			if (product.data.branchId !== input.branchId) {
				throw new ValidationError(
					"All items must belong to the order's branch",
				);
			}
			const unitPrice = product.data.price;
			total += unitPrice * line.quantity;
			items.push({
				id: crypto.randomUUID(),
				orderId,
				productId: line.productId,
				quantity: line.quantity,
				unitPrice,
			});
		}

		const order = {
			id: orderId,
			businessId,
			branchId: input.branchId,
			userId: input.userId ?? null,
			status: "Pending" as const,
			total,
			fulfillment: "counter" as const,
			deliveryLine: null,
			deliveryArea: null,
			deliveryCity: null,
			deliveryLat: null,
			deliveryLng: null,
			deliveredAt: null,
			source: "walk_in" as const,
			guestName: input.guestName ?? null,
			guestPhone: input.guestPhone ?? null,
			walkInLocalId: input.walkInLocalId ?? null,
		};

		try {
			await this.repo.placeOrder(order, items);
		} catch (err) {
			if (
				err instanceof Error &&
				err.message.includes("CHECK constraint failed")
			) {
				throw new ConflictError("One or more items are out of stock");
			}
			throw err;
		}

		return order as OrderSelect;
	}

	listMine(userId: string) {
		return this.repo.findByUser(userId);
	}

	async get(
		actorId: string,
		orderId: string,
		scopedBranchIds: string[] | null,
		asOwner: boolean,
	) {
		const order = asOwner
			? await this.authz.assertOrderAccess(actorId, orderId, scopedBranchIds)
			: await this.authz.assertCustomerOwnsOrder(actorId, orderId);
		const items = await this.repo.findItems(orderId);
		return { ...order, items };
	}

	async listByBranch(
		actorId: string,
		branchId: string,
		scopedBranchIds: string[] | null,
	) {
		await this.authz.assertBranchAccess(actorId, branchId, scopedBranchIds);
		return this.repo.findByBranch(branchId);
	}

	async updateStatus(
		actorId: string,
		orderId: string,
		next: OrderStatusType,
		scopedBranchIds: string[] | null,
	): Promise<OrderSelect> {
		const order = await this.authz.assertOrderAccess(
			actorId,
			orderId,
			scopedBranchIds,
		);

		// Owner-cancel: route through the restore-aware path, not a plain status flip.
		if (next === "Cancelled") {
			await this.doCancel(order);
			const fresh = await this.repo.findOne(orderId);
			return fresh.data as OrderSelect; // persisted row, not a synthesized snapshot
		}

		const allowed = ALLOWED_TRANSITIONS[order.status as OrderStatusType] ?? [];
		const counterDelivered =
			order.fulfillment === "counter" &&
			order.status === "Confirmed" &&
			next === "Delivered";
		if (!allowed.includes(next) && !counterDelivered) {
			throw new ValidationError(
				`Cannot move order from ${order.status} to ${next}`,
			);
		}
		const extra =
			next === "Delivered" ? { deliveredAt: new Date().toISOString() } : {};
		const result = await this.repo.updateStatus(
			orderId,
			next,
			order.status as OrderStatusType,
			extra,
		);
		if (!result.data) {
			// Lost a race — re-read for an accurate 422.
			const fresh = await this.repo.findOne(orderId);
			throw new ValidationError(
				`Cannot move order from ${fresh.data?.status} to ${next}`,
			);
		}
		if (order.userId) {
			await this.queue.send({
				type: "notification.order_status_changed",
				orderId,
				status: next,
			});
		}
		return result.data;
	}

	async cancel(userId: string, orderId: string): Promise<void> {
		const order = await this.authz.assertCustomerOwnsOrder(userId, orderId);
		await this.doCancel(order);
	}

	/** Restore stock, mark Cancelled, notify. Caller has already authorized + loaded the order. */
	private async doCancel(order: OrderSelect): Promise<void> {
		// Idempotent: an order already Cancelled is in the desired state (a
		// sequential double-tap whose second request loads Cancelled).
		if (order.status === "Cancelled") return;
		// Fast 422 for a terminally non-cancellable order; status only moves
		// forward or to Cancelled, so a loaded OutForDelivery/Delivered is final.
		if (order.status !== "Pending" && order.status !== "Confirmed") {
			throw new ValidationError(
				`Cannot cancel an order in ${order.status} state`,
			);
		}
		const items = await this.repo.findItems(order.id);
		const didCancel = await this.repo.cancelAndRestore(
			order.id,
			items,
			new Date().toISOString(),
		);
		if (!didCancel) {
			// Lost the race / duplicate — re-read to decide.
			const fresh = await this.repo.findOne(order.id);
			if (fresh.data?.status === "Cancelled") return; // idempotent success
			throw new ValidationError(
				`Cannot cancel an order in ${fresh.data?.status} state`,
			);
		}
		// We won — notify only when there is a customer account to notify.
		if (order.userId) {
			await this.queue.send({
				type: "notification.order_status_changed",
				orderId: order.id,
				status: "Cancelled",
			});
		}
	}
}
