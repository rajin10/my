import {
	branchesSchema,
	businessesSchema,
	servicesSchema,
} from "@repo/core/src/database/schema";
import type { createTestDb } from "./test-db";

type Db = ReturnType<typeof createTestDb>;

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${++counter}`;
const TS = "2026-01-01T00:00:00.000Z";

export interface SeededChain {
	ownerId: string;
	businessId: string;
	branchId: string;
	serviceId: string;
}

/**
 * Inserts a business → branch → service chain owned by `ownerId`. IDs are
 * generated unless provided. Uses Drizzle (camelCase keys) so column-name
 * mapping is handled by the schema.
 */
export async function seedChain(
	db: Db,
	opts: {
		ownerId: string;
		businessId?: string;
		branchId?: string;
		serviceId?: string;
	},
): Promise<SeededChain> {
	const businessId = opts.businessId ?? nextId("business");
	const branchId = opts.branchId ?? nextId("branch");
	const serviceId = opts.serviceId ?? nextId("service");

	await db.insert(businessesSchema).values({
		id: businessId,
		name: "Test Business",
		category: "Beauty",
		city: "Dhaka",
		ownerId: opts.ownerId,
		createdAt: TS,
	} as never);

	await db.insert(branchesSchema).values({
		id: branchId,
		businessId,
		name: "Test Branch",
		address: "123 St",
		city: "Dhaka",
		createdAt: TS,
	} as never);

	await db.insert(servicesSchema).values({
		id: serviceId,
		branchId,
		name: "Haircut",
		category: "Hair",
		duration: 30,
		price: 1000,
		createdAt: TS,
	} as never);

	return { ownerId: opts.ownerId, businessId, branchId, serviceId };
}
