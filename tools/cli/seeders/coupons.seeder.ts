import { couponsSchema } from "@core/database/schema/coupons.schema.ts";
import { faker } from "@faker-js/faker";
import type { DbClient } from "../core/db.ts";
import {
	createCoupon,
	generateCouponCode,
} from "../factories/coupon.factory.ts";
import type { SeedResult } from "./seeder.types.ts";

const CHUNK = 500;

export async function seedCoupons(
	db: DbClient,
	businessIds: string[],
): Promise<SeedResult> {
	const usedCodes = new Set<string>();

	const coupons = businessIds.flatMap((businessId) => {
		const target = faker.number.int({ min: 1, max: 5 });
		const businessCoupons = [];
		let attempts = 0;

		while (businessCoupons.length < target && attempts < target * 5) {
			attempts++;
			const coupon = createCoupon(businessId);
			// Regenerate until unique (avoids the global unique constraint on code)
			while (usedCodes.has(coupon.code)) {
				coupon.code = generateCouponCode();
			}
			usedCodes.add(coupon.code);
			businessCoupons.push(coupon);
		}

		return businessCoupons;
	});

	for (let i = 0; i < coupons.length; i += CHUNK) {
		await db.insert(couponsSchema as never).values(coupons.slice(i, i + CHUNK));
	}

	return { module: "coupons", inserted: coupons.length };
}
