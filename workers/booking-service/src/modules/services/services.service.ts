import type { ServicesRepository } from "@repo/core/src/database/repositories/services.repository";
import type { ServiceInsert } from "@repo/core/src/database/schema";
import type { AuthorizationService } from "../../core/authorization";
import { NotFoundError } from "../../core/errors";
import { validateImageUpload } from "../../core/storage/image-upload";
import type { R2Storage } from "../../core/storage/r2";

export class ServicesService {
	constructor(
		private readonly repo: ServicesRepository,
		private readonly authz: AuthorizationService,
		private readonly storage: R2Storage,
	) {}

	listByBranch(branchId: string) {
		return this.repo.findByBranch(branchId);
	}

	async get(id: string) {
		const result = await this.repo.findOne(id);
		if (!result.data) throw new NotFoundError("Service not found");
		return result.data;
	}

	async create(
		actorId: string,
		branchId: string,
		data: Omit<ServiceInsert, "branchId">,
		scopedBranchIds: string[] | null,
	) {
		await this.authz.assertBranchAccess(actorId, branchId, scopedBranchIds);
		const result = await this.repo.create({ ...data, branchId });
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	async update(
		actorId: string,
		serviceId: string,
		data: Partial<Omit<ServiceInsert, "branchId">>,
		scopedBranchIds: string[] | null,
	) {
		await this.authz.assertServiceAccess(actorId, serviceId, scopedBranchIds);
		const result = await this.repo.updateOne(serviceId, data);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	async delete(
		actorId: string,
		serviceId: string,
		scopedBranchIds: string[] | null,
	) {
		await this.authz.assertServiceAccess(actorId, serviceId, scopedBranchIds);
		const result = await this.repo.deleteOne(serviceId);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	async uploadPhoto(
		actorId: string,
		serviceId: string,
		file: File,
		scopedBranchIds: string[] | null,
	): Promise<{ url: string }> {
		await this.authz.assertServiceAccess(actorId, serviceId, scopedBranchIds);
		// MIME allowlist + size cap; extension from the validated content type.
		const { ext } = validateImageUpload(file);

		const key = `services/${serviceId}/${crypto.randomUUID()}.${ext}`;
		const url = await this.storage.upload(
			key,
			await file.arrayBuffer(),
			file.type,
		);

		await this.repo.updateOne(serviceId, {
			imageUrl: url,
		} as Partial<ServiceInsert>);
		return { url };
	}

	async deletePhoto(
		actorId: string,
		serviceId: string,
		scopedBranchIds: string[] | null,
	): Promise<void> {
		await this.authz.assertServiceAccess(actorId, serviceId, scopedBranchIds);
		await this.repo.updateOne(serviceId, {
			imageUrl: null,
		} as Partial<ServiceInsert>);
	}
}
