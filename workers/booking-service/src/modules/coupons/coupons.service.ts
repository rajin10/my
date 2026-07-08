import type { CouponsRepository } from "@repo/core/src/database/repositories/coupons.repository";
import type { CouponInsert } from "@repo/core/src/database/schema";
import type { PaginatedQueryDto } from "@repo/core/src/http/response";
import type { AuthorizationService } from "../../core/authorization";
import { ConflictError, ValidationError } from "../../core/errors";

export interface ValidateCouponResult {
	couponId: string;
	code: string;
	discount: number;
}

export class CouponsService {
	constructor(
		private readonly repo: CouponsRepository,
		private readonly authz: AuthorizationService,
	) {}

	async listByBusiness(
		ownerId: string,
		businessId: string,
		query: PaginatedQueryDto,
	) {
		await this.authz.assertBusinessOwner(ownerId, businessId);
		return this.repo.findAllByBusiness(businessId, query);
	}

	async get(ownerId: string, id: string) {
		const coupon = await this.authz.assertCouponOwner(ownerId, id);
		return coupon;
	}

	async create(
		ownerId: string,
		businessId: string,
		data: Omit<CouponInsert, "businessId">,
	) {
		await this.authz.assertBusinessOwner(ownerId, businessId);
		const result = await this.repo.create({
			...data,
			businessId,
			code: data.code.toUpperCase(),
		});
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	async update(
		ownerId: string,
		couponId: string,
		data: Partial<Omit<CouponInsert, "businessId">>,
	) {
		await this.authz.assertCouponOwner(ownerId, couponId);
		const result = await this.repo.updateOne(couponId, data);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	async delete(ownerId: string, couponId: string) {
		await this.authz.assertCouponOwner(ownerId, couponId);
		const result = await this.repo.deleteOne(couponId);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	/**
	 * Validate a coupon code and compute the discount — does NOT yet increment usage.
	 * Call `applyUsage` after the booking is persisted successfully.
	 */
	async validate(
		code: string,
		businessId: string,
		price: number,
	): Promise<ValidateCouponResult> {
		const coupon = await this.repo.findActiveByCode(code, businessId);
		if (!coupon) throw new ValidationError("Invalid or expired coupon code");

		const discount =
			coupon.type === "Percentage"
				? Math.min(Math.round((price * coupon.value) / 100), price)
				: Math.min(coupon.value, price);

		return { couponId: coupon.id, code: coupon.code, discount };
	}

	/** Increment usage counter — throws ConflictError if the coupon just hit its limit. */
	async applyUsage(couponId: string): Promise<void> {
		const ok = await this.repo.incrementUsage(couponId);
		if (!ok) throw new ConflictError("Coupon is no longer available");
	}

	findByCode(code: string) {
		return this.repo.findByCode(code);
	}

	/** Find an active coupon scoped to a specific business. Used during cancellation. */
	findByCodeAndBusiness(code: string, businessId: string) {
		return this.repo.findActiveByCode(code, businessId);
	}

	/** Decrement usage counter — call if the associated booking is cancelled. */
	revertUsage(couponId: string) {
		return this.repo.decrementUsage(couponId);
	}
}
