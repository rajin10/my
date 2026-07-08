import { branchesSchema } from "@core/database/schema/branches.schema.ts";
import { faker } from "@faker-js/faker";
import type { DbClient } from "../core/db.ts";
import { createBranch } from "../factories/branch.factory.ts";
import type { SeedResult } from "./seeder.types.ts";

const CHUNK = 500;

interface BranchesResult extends SeedResult {
	businessBranches: Record<string, string[]>; // businessId -> branchId[]
	branchCities: Record<string, string>; // branchId -> city
}

export async function seedBranches(
	db: DbClient,
	businessIds: string[],
	businessCities: Record<string, string>,
): Promise<BranchesResult> {
	const businessBranches: Record<string, string[]> = {};
	const branchCities: Record<string, string> = {};

	const branches = businessIds.flatMap((businessId) => {
		const city = businessCities[businessId] ?? "Dhaka";
		const count = faker.number.int({ min: 1, max: 3 });
		const list = Array.from({ length: count }, () =>
			createBranch(businessId, city),
		);
		businessBranches[businessId] = list.map((b) => b.id);
		for (const b of list) branchCities[b.id] = b.city;
		return list;
	});

	for (let i = 0; i < branches.length; i += CHUNK) {
		await db
			.insert(branchesSchema as never)
			.values(branches.slice(i, i + CHUNK));
	}

	return {
		module: "branches",
		inserted: branches.length,
		businessBranches,
		branchCities,
	};
}
