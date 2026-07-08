import type { BusinessesRepository } from "@repo/core/src/database/repositories/businesses.repository";
import type {
	BusinessInsert,
	BusinessPhotoSelect,
	BusinessSelect,
} from "@repo/core/src/database/schema";
import type { PaginatedQueryDto } from "@repo/core/src/http/response";
import type { AuthorizationService } from "../../core/authorization";
import {
	ForbiddenError,
	NotFoundError,
	ValidationError,
} from "../../core/errors";
import { KV_KEYS, KV_TTL, kvDel, kvGet, kvSet } from "../../core/kv/cache";
import { validateImageUpload } from "../../core/storage/image-upload";
import type { R2Storage } from "../../core/storage/r2";
import { findContrastViolations } from "./contrast";

export class BusinessesService {
	constructor(
		private readonly repo: BusinessesRepository,
		private readonly storage: R2Storage,
		private readonly kv: KVNamespace | undefined,
		private readonly authz: AuthorizationService,
	) {}

	list(query: PaginatedQueryDto) {
		return this.repo.findAll(query);
	}

	async listPhotos(
		businessId: string,
	): Promise<
		Array<{ id: string; businessId: string; url: string; order: number }>
	> {
		await this.get(businessId);
		const rows = await this.repo.listPhotos(businessId);
		return rows.map((p: BusinessPhotoSelect) => ({
			id: p.id,
			businessId: p.businessId,
			url: p.url,
			order: p.displayOrder,
		}));
	}

	async get(id: string): Promise<BusinessSelect> {
		if (this.kv) {
			const cached = await kvGet<BusinessSelect>(
				this.kv,
				KV_KEYS.businessProfile(id),
			);
			if (cached) return cached;
		}

		const result = await this.repo.findOne(id);
		if (!result.data) throw new NotFoundError("Business not found");

		if (this.kv) {
			await kvSet(
				this.kv,
				KV_KEYS.businessProfile(id),
				result.data,
				KV_TTL.businessProfile,
			);
		}

		return result.data;
	}

	async create(ownerId: string, data: Omit<BusinessInsert, "ownerId">) {
		// `vertical` is required at the API boundary (no silent default) and is
		// immutable thereafter — it discriminates booking vs commerce businesses.
		if (data.brandPalette) this.assertReadablePalette(data.brandPalette);
		const result = await this.repo.create({ ...data, ownerId });
		return result.data!;
	}

	// WCAG-AA contrast gate (ADR-0003 / #59): a saved palette must be readable on
	// the customer reskin path, so unreadable role pairs are rejected at save —
	// never at render. `null` (revert to Talash defaults) is always allowed and
	// never reaches here. Validity of the hex format is handled by the route schema.
	private assertReadablePalette(palette: BusinessInsert["brandPalette"]): void {
		if (!palette) return;
		const violations = findContrastViolations(palette);
		if (violations.length > 0) {
			const detail = violations
				.map((v) => `${v.label} is ${v.ratio}:1 (needs ${v.required}:1)`)
				.join("; ");
			throw new ValidationError(
				`Palette fails WCAG AA contrast: ${detail}. Adjust the colours for readability.`,
			);
		}
	}

	async update(
		ownerId: string,
		businessId: string,
		data: Partial<Omit<BusinessInsert, "ownerId" | "vertical">>,
	) {
		// `vertical` is immutable: reject any attempt to change it even if a caller
		// bypasses the route schema. The update signature also omits it at the type level.
		if ("vertical" in data) {
			throw new ValidationError("Business vertical cannot be changed");
		}
		const business = await this.authz.assertBusinessOwner(ownerId, businessId);
		if (data.status) {
			this.validateStatusTransition(business.status, data.status);
		}
		if (data.brandPalette) this.assertReadablePalette(data.brandPalette);
		const result = await this.repo.updateOne(businessId, data);
		if (this.kv) await kvDel(this.kv, KV_KEYS.businessProfile(businessId));
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	private validateStatusTransition(from: string, to: string): void {
		const allowed: Record<string, string[]> = {
			Draft: ["Active"],
			Active: ["Suspended"],
			Suspended: ["Active"],
		};
		if (!allowed[from]?.includes(to)) {
			throw new ValidationError(
				`Cannot transition business status from '${from}' to '${to}'. Allowed: ${allowed[from]?.join(", ") ?? "none"}`,
			);
		}
	}

	async delete(ownerId: string, businessId: string) {
		await this.authz.assertBusinessOwner(ownerId, businessId);
		const result = await this.repo.deleteOne(businessId);
		if (this.kv) await kvDel(this.kv, KV_KEYS.businessProfile(businessId));
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	async restore(ownerId: string, businessId: string) {
		// Check ownership on the soft-deleted record before mutating — restoreOne is not rolled back on throw.
		// assertBusinessOwner does not resolve soft-deleted records, so we use a raw check here.
		const peek = await this.repo.findOne(businessId, { withDeleted: true });
		if (!peek.data)
			throw new NotFoundError("Business not found or not deleted");
		if (peek.data.ownerId !== ownerId)
			throw new ForbiddenError("You do not own this business");

		const result = await this.repo.restoreOne(businessId);
		if (!result.data)
			throw new NotFoundError("Business not found or not deleted");
		if (this.kv) await kvDel(this.kv, KV_KEYS.businessProfile(businessId));
		return result.data;
	}

	async uploadPhoto(
		ownerId: string,
		businessId: string,
		file: File,
	): Promise<{ url: string }> {
		await this.authz.assertBusinessOwner(ownerId, businessId);
		// Validate after the ownership check so non-owners learn nothing about the
		// upload rules; extension comes from the validated MIME type, not file.name.
		const { ext } = validateImageUpload(file);

		const key = `businesses/${businessId}/${crypto.randomUUID()}.${ext}`;
		const arrayBuffer = await file.arrayBuffer();
		const url = await this.storage.upload(key, arrayBuffer, file.type);

		await this.repo.addPhoto(businessId, url);
		if (this.kv) await kvDel(this.kv, KV_KEYS.businessProfile(businessId));
		return { url };
	}

	async deletePhoto(
		ownerId: string,
		businessId: string,
		photoId: string,
	): Promise<void> {
		await this.authz.assertBusinessOwner(ownerId, businessId);

		const photo = await this.repo.findPhoto(photoId);
		if (!photo || photo.businessId !== businessId)
			throw new NotFoundError("Photo not found");

		await this.repo.deletePhoto(photoId);
		if (this.kv) await kvDel(this.kv, KV_KEYS.businessProfile(businessId));
	}

	async reorderPhotos(
		ownerId: string,
		businessId: string,
		orders: { id: string; order: number }[],
	): Promise<void> {
		await this.authz.assertBusinessOwner(ownerId, businessId);
		await this.repo.reorderPhotos(orders);
		if (this.kv) await kvDel(this.kv, KV_KEYS.businessProfile(businessId));
	}
}
