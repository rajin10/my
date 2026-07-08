import type { ProductsRepository } from "@repo/core/src/database/repositories/products.repository";
import type { ProductInsert } from "@repo/core/src/database/schema";
import type { AuthorizationService } from "../../core/authorization";
import { NotFoundError } from "../../core/errors";
import { validateImageUpload } from "../../core/storage/image-upload";
import type { R2Storage } from "../../core/storage/r2";

export class ProductsService {
	constructor(
		private readonly repo: ProductsRepository,
		private readonly authz: AuthorizationService,
		private readonly storage: R2Storage,
	) {}

	listByBranch(branchId: string) {
		return this.repo.findByBranch(branchId);
	}

	async get(id: string) {
		const result = await this.repo.findOne(id);
		if (!result.data) throw new NotFoundError("Product not found");
		return result.data;
	}

	async create(
		actorId: string,
		branchId: string,
		data: Omit<ProductInsert, "branchId">,
		scopedBranchIds: string[] | null,
	) {
		await this.authz.assertBranchAccess(actorId, branchId, scopedBranchIds);
		const result = await this.repo.create({ ...data, branchId });
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	async update(
		actorId: string,
		productId: string,
		data: Partial<Omit<ProductInsert, "branchId">>,
		scopedBranchIds: string[] | null,
	) {
		await this.authz.assertProductAccess(actorId, productId, scopedBranchIds);
		const result = await this.repo.updateOne(productId, data);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	async delete(
		actorId: string,
		productId: string,
		scopedBranchIds: string[] | null,
	) {
		await this.authz.assertProductAccess(actorId, productId, scopedBranchIds);
		const result = await this.repo.deleteOne(productId);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	async uploadPhoto(
		actorId: string,
		productId: string,
		file: File,
		scopedBranchIds: string[] | null,
	): Promise<{ url: string }> {
		await this.authz.assertProductAccess(actorId, productId, scopedBranchIds);
		// MIME allowlist + size cap; extension from the validated content type.
		const { ext } = validateImageUpload(file);

		const key = `products/${productId}/${crypto.randomUUID()}.${ext}`;
		const url = await this.storage.upload(
			key,
			await file.arrayBuffer(),
			file.type,
		);

		await this.repo.updateOne(productId, {
			imageUrl: url,
		} as Partial<ProductInsert>);
		return { url };
	}

	async deletePhoto(
		actorId: string,
		productId: string,
		scopedBranchIds: string[] | null,
	): Promise<void> {
		await this.authz.assertProductAccess(actorId, productId, scopedBranchIds);
		await this.repo.updateOne(productId, {
			imageUrl: null,
		} as Partial<ProductInsert>);
	}
}
