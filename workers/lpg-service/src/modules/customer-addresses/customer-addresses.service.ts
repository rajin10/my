import type { CustomerAddressesRepository } from "@repo/core/src/database/repositories/customer-addresses.repository";
import type { CustomerAddressInsert } from "@repo/core/src/database/schema";
import type { AuthorizationService } from "../../core/authorization";

export type CreateAddressInput = Omit<CustomerAddressInsert, "userId">;

export class CustomerAddressesService {
	constructor(
		private readonly repo: CustomerAddressesRepository,
		private readonly authz: AuthorizationService,
	) {}

	listMine(userId: string) {
		return this.repo.findByUser(userId);
	}

	async create(userId: string, data: CreateAddressInput) {
		if (data.isDefault) await this.repo.clearDefault(userId);
		const result = await this.repo.create({
			...data,
			userId,
		} as CustomerAddressInsert);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure
		return result.data!;
	}

	async update(userId: string, id: string, data: Partial<CreateAddressInput>) {
		await this.authz.assertCustomerOwnsAddress(userId, id);
		if (data.isDefault) await this.repo.clearDefault(userId);
		const result = await this.repo.updateOne(
			id,
			data as Partial<CustomerAddressInsert>,
		);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure
		return result.data!;
	}

	async remove(userId: string, id: string) {
		await this.authz.assertCustomerOwnsAddress(userId, id);
		const result = await this.repo.deleteOne(id);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure
		return result.data!;
	}
}
