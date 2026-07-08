import type { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import type { BusinessesRepository } from "@repo/core/src/database/repositories/businesses.repository";
import type { CustomerAddressesRepository } from "@repo/core/src/database/repositories/customer-addresses.repository";
import type { OrdersRepository } from "@repo/core/src/database/repositories/orders.repository";
import type { ProductsRepository } from "@repo/core/src/database/repositories/products.repository";
import type {
	BranchSelect,
	BusinessSelect,
	CustomerAddressSelect,
	OrderSelect,
	ProductSelect,
} from "@repo/core/src/database/schema";
import { ForbiddenError, NotFoundError } from "./errors";

/** Commerce-scoped ownership checks for lpg-service. */
export class AuthorizationService {
	constructor(
		private readonly businessesRepo: BusinessesRepository,
		private readonly branchesRepo: BranchesRepository,
		private readonly productsRepo: ProductsRepository,
		private readonly ordersRepo: OrdersRepository,
		private readonly customerAddressesRepo: CustomerAddressesRepository,
	) {}

	async assertBusinessOwner(
		actorId: string,
		businessId: string,
	): Promise<BusinessSelect> {
		const business = await this.businessesRepo.findOne(businessId);
		if (!business.data) throw new NotFoundError("Business not found");
		if (business.data.ownerId !== actorId) {
			throw new ForbiddenError("You do not own this business");
		}
		return business.data as BusinessSelect;
	}

	async assertBranchAccess(
		actorId: string,
		branchId: string,
		scopedBranchIds: string[] | null,
	): Promise<void> {
		if (scopedBranchIds !== null) {
			if (!scopedBranchIds.includes(branchId)) {
				throw new ForbiddenError("You are not assigned to this branch");
			}
			return;
		}
		const branch = await this.branchesRepo.findOne(branchId);
		if (!branch.data) throw new NotFoundError("Branch not found");
		await this.assertBusinessOwner(actorId, branch.data.businessId);
	}

	async assertProductAccess(
		actorId: string,
		productId: string,
		scopedBranchIds: string[] | null,
	): Promise<ProductSelect> {
		const product = await this.productsRepo.findOne(productId);
		if (!product.data) throw new NotFoundError("Product not found");
		await this.assertBranchAccess(
			actorId,
			product.data.branchId,
			scopedBranchIds,
		);
		return product.data as ProductSelect;
	}

	async assertOrderAccess(
		actorId: string,
		orderId: string,
		scopedBranchIds: string[] | null,
	): Promise<OrderSelect> {
		const order = await this.ordersRepo.findOne(orderId);
		if (!order.data) throw new NotFoundError("Order not found");
		await this.assertBranchAccess(
			actorId,
			order.data.branchId,
			scopedBranchIds,
		);
		return order.data as OrderSelect;
	}

	async assertCustomerOwnsOrder(
		userId: string,
		orderId: string,
	): Promise<OrderSelect> {
		const order = await this.ordersRepo.findOne(orderId);
		if (!order.data) throw new NotFoundError("Order not found");
		if (order.data.userId !== userId) {
			throw new ForbiddenError("You do not own this order");
		}
		return order.data as OrderSelect;
	}

	async assertCustomerOwnsAddress(
		userId: string,
		addressId: string,
	): Promise<CustomerAddressSelect> {
		const address = await this.customerAddressesRepo.findOne(addressId);
		if (!address.data) throw new NotFoundError("Address not found");
		if (address.data.userId !== userId) {
			throw new ForbiddenError("You do not own this address");
		}
		return address.data as CustomerAddressSelect;
	}
}
