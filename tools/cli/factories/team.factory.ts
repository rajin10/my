import {
	type TeamMemberSelect,
	TeamRole,
} from "@core/database/schema/team.schema";
import { faker } from "@faker-js/faker";

const TITLES: Record<string, string[]> = {
	[TeamRole.OWNER]: ["Owner", "Founder", "Director"],
	[TeamRole.MANAGER]: [
		"Branch Manager",
		"Salon Manager",
		"Spa Manager",
		"Operations Manager",
	],
	[TeamRole.STAFF]: [
		"Beautician",
		"Hairstylist",
		"Nail Technician",
		"Massage Therapist",
		"Esthetician",
		"Makeup Artist",
		"Barber",
	],
};

export function createTeamMember(
	userId: string,
	businessId: string,
	branchId: string | null,
	overrides: Partial<TeamMemberSelect> = {},
): TeamMemberSelect {
	const role =
		branchId === null
			? TeamRole.OWNER
			: faker.helpers.weightedArrayElement([
					{ weight: 7, value: TeamRole.STAFF },
					{ weight: 3, value: TeamRole.MANAGER },
				]);

	return {
		id: crypto.randomUUID(),
		userId,
		businessId,
		branchId,
		role,
		title: faker.helpers.arrayElement(TITLES[role] ?? ["Staff"]),
		createdAt: faker.date.past({ years: 1 }).toISOString(),
		updatedAt: new Date().toISOString(),
		deletedAt: null,
		...overrides,
	};
}
