import type { CampaignsRepository } from "@repo/core/src/database/repositories/campaigns.repository";
import type { CustomersRepository } from "@repo/core/src/database/repositories/customers.repository";
import type { CampaignInsert } from "@repo/core/src/database/schema";
import type { AuthorizationService } from "../../core/authorization";
import {
	ConflictError,
	ForbiddenError,
	NotFoundError,
} from "../../core/errors";

export type CreateCampaignInput = Omit<
	CampaignInsert,
	"channels" | "status" | "sentAt" | "recipientCount"
> & {
	channels: Array<"Email" | "SMS" | "Push">;
};

export type UpdateCampaignInput = Partial<{
	name: string;
	segment: "All" | "VIP" | "Regular" | "New" | "AtRisk";
	channels: Array<"Email" | "SMS" | "Push">;
	message: string;
}>;

export class CampaignsService {
	constructor(
		private readonly repo: CampaignsRepository,
		private readonly customersRepo: CustomersRepository,
		private readonly authz: AuthorizationService,
	) {}

	async list(actorId: string, businessId: string) {
		await this.authz.assertBusinessOwner(actorId, businessId);
		return this.repo.findByBusiness(businessId);
	}

	async create(actorId: string, input: CreateCampaignInput) {
		await this.authz.assertBusinessOwner(actorId, input.businessId);
		const result = await this.repo.create({
			businessId: input.businessId,
			name: input.name,
			segment: input.segment,
			channels: JSON.stringify(input.channels),
			message: input.message,
			status: "Draft",
		});
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	async update(actorId: string, id: string, body: UpdateCampaignInput) {
		const existing = await this.repo.findOne(id);
		if (!existing) throw new NotFoundError("Campaign not found");
		await this.authz.assertBusinessOwner(actorId, existing.businessId);
		const update: Record<string, unknown> = {};
		if (body.name !== undefined) update.name = body.name;
		if (body.segment !== undefined) update.segment = body.segment;
		if (body.channels !== undefined)
			update.channels = JSON.stringify(body.channels);
		if (body.message !== undefined) update.message = body.message;
		const result = await this.repo.updateOne(
			id,
			update as Parameters<typeof this.repo.updateOne>[1],
		);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	async send(actorId: string, id: string, businessId: string) {
		const existing = await this.repo.findOne(id);
		if (!existing) throw new NotFoundError("Campaign not found");
		if (existing.businessId !== businessId) throw new ForbiddenError();
		await this.authz.assertBusinessOwner(actorId, businessId);
		if (existing.status === "Sent")
			throw new ConflictError("Campaign has already been sent");
		const allCustomers = await this.customersRepo.listByBusiness(businessId);
		const recipients =
			existing.segment === "All"
				? allCustomers
				: allCustomers.filter((c) => c.tier === existing.segment);
		const result = await this.repo.updateOne(id, {
			status: "Sent",
			sentAt: new Date().toISOString(),
			recipientCount: recipients.length,
		});
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	async delete(actorId: string, id: string) {
		const existing = await this.repo.findOne(id);
		if (!existing) throw new NotFoundError("Campaign not found");
		await this.authz.assertBusinessOwner(actorId, existing.businessId);
		await this.repo.deleteOne(id);
	}
}
