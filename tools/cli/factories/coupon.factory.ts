import type { CouponSelect } from "@core/database/schema/coupons.schema";
import { faker } from "@faker-js/faker";

const CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function generateCouponCode(): string {
	return Array.from(
		{ length: 8 },
		() => CODE_CHARS[faker.number.int({ min: 0, max: CODE_CHARS.length - 1 })],
	).join("");
}

export function createCoupon(
	businessId: string,
	overrides: Partial<CouponSelect> = {},
): CouponSelect {
	const type = faker.helpers.arrayElement(["Percentage", "Fixed"] as const);
	const value =
		type === "Percentage"
			? faker.number.int({ min: 5, max: 50 })
			: faker.number.int({ min: 10000, max: 50000 }); // 100–500 BDT

	const maxUses = faker.number.int({ min: 10, max: 500 });
	const usedCount = faker.number.int({ min: 0, max: maxUses });
	const isExpired = faker.datatype.boolean(0.3);

	const expiresAt = isExpired
		? faker.date.past({ years: 1 }).toISOString()
		: faker.date.future({ years: 1 }).toISOString();

	return {
		id: crypto.randomUUID(),
		businessId,
		code: generateCouponCode(),
		type,
		value,
		usedCount,
		maxUses,
		status: isExpired ? "Expired" : "Active",
		expiresAt,
		createdAt: faker.date.past({ years: 1 }).toISOString(),
		updatedAt: new Date().toISOString(),
		deletedAt: null,
		...overrides,
	};
}
