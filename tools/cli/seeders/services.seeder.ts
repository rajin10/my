import { servicesSchema } from "@core/database/schema/services.schema.ts";
import { faker } from "@faker-js/faker";
import type { DbClient } from "../core/db.ts";
import { createService } from "../factories/service.factory.ts";
import type { SeedResult } from "./seeder.types.ts";

const CHUNK = 500;

interface ServicesResult extends SeedResult {
	branchServices: Record<string, string[]>; // branchId -> serviceId[]
	servicePrices: Record<string, number>; // serviceId -> price
}

export async function seedServices(
	db: DbClient,
	businessBranches: Record<string, string[]>,
): Promise<ServicesResult> {
	const branchServices: Record<string, string[]> = {};
	const servicePrices: Record<string, number> = {};

	const allBranchIds = Object.values(businessBranches).flat();
	const services = allBranchIds.flatMap((branchId) => {
		const count = faker.number.int({ min: 3, max: 8 });
		const list = Array.from({ length: count }, () => createService(branchId));
		branchServices[branchId] = list.map((s) => s.id);
		for (const s of list) servicePrices[s.id] = s.price;
		return list;
	});

	for (let i = 0; i < services.length; i += CHUNK) {
		await db
			.insert(servicesSchema as never)
			.values(services.slice(i, i + CHUNK));
	}

	return {
		module: "services",
		inserted: services.length,
		branchServices,
		servicePrices,
	};
}
