import type { CustomersRepository } from "@repo/core/src/database/repositories/customers.repository";
import type { AuthorizationService } from "../../core/authorization";

export class CustomersService {
	constructor(
		private readonly repo: CustomersRepository,
		private readonly authz: AuthorizationService,
	) {}

	async list(actorId: string, businessId: string) {
		await this.authz.assertBusinessOwner(actorId, businessId);
		return this.repo.listByBusiness(businessId);
	}

	async visits(actorId: string, businessId: string, userId: string) {
		await this.authz.assertBusinessOwner(actorId, businessId);
		return this.repo.getCustomerVisits(businessId, userId);
	}
}
