import { teamMembersSchema } from "@core/database/schema/team.schema.ts";
import { faker } from "@faker-js/faker";
import type { DbClient } from "../core/db.ts";
import { createTeamMember } from "../factories/team.factory.ts";
import type { SeedResult } from "./seeder.types.ts";

const CHUNK = 500;

export async function seedTeam(
	db: DbClient,
	businessIds: string[],
	businessBranches: Record<string, string[]>,
	ownerIds: string[],
	staffIds: string[],
): Promise<SeedResult> {
	// Track userId:businessId pairs to honour the unique constraint
	const usedPairs = new Set<string>();
	const members = [];

	const shuffledOwners = faker.helpers.shuffle([...ownerIds]);

	for (let i = 0; i < businessIds.length; i++) {
		const businessId = businessIds[i];
		const ownerId = shuffledOwners[i % shuffledOwners.length];
		const ownerKey = `${ownerId}:${businessId}`;

		if (!usedPairs.has(ownerKey)) {
			usedPairs.add(ownerKey);
			members.push(createTeamMember(ownerId, businessId, null, { role: "Owner" }));
		}

		const branches = businessBranches[businessId] ?? [];
		const shuffledStaff = faker.helpers.shuffle([...staffIds]);
		let staffIdx = 0;

		for (const branchId of branches) {
			const staffCount = faker.number.int({ min: 1, max: 3 });
			for (
				let j = 0;
				j < staffCount && staffIdx < shuffledStaff.length;
				j++, staffIdx++
			) {
				const staffId = shuffledStaff[staffIdx];
				const staffKey = `${staffId}:${businessId}`;
				if (!usedPairs.has(staffKey)) {
					usedPairs.add(staffKey);
					members.push(createTeamMember(staffId, businessId, branchId));
				}
			}
		}
	}

	for (let i = 0; i < members.length; i += CHUNK) {
		await db
			.insert(teamMembersSchema as never)
			.values(members.slice(i, i + CHUNK));
	}

	return { module: "team", inserted: members.length };
}
