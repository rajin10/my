import type { BranchSelect } from "@core/database/schema/branches.schema";
import { faker } from "@faker-js/faker";

// Approximate city centres (lat, lng) so seeded branches cluster realistically.
const CITY_CENTRES: Record<string, [number, number]> = {
	Dhaka: [23.781, 90.4],
	Chittagong: [22.357, 91.78],
	Sylhet: [24.895, 91.87],
	Rajshahi: [24.374, 88.601],
	Khulna: [22.845, 89.54],
	Cumilla: [23.46, 91.18],
	Mymensingh: [24.747, 90.42],
	Gazipur: [23.999, 90.42],
	Narayanganj: [23.62, 90.5],
	Bogura: [24.848, 89.372],
};

const BD_AREAS: Record<string, string[]> = {
	Dhaka: [
		"Gulshan",
		"Banani",
		"Dhanmondi",
		"Mirpur",
		"Uttara",
		"Mohammadpur",
		"Bashundhara",
		"Panthapath",
	],
	Chittagong: [
		"Agrabad",
		"Nasirabad",
		"Halishahar",
		"Panchlaish",
		"GEC Circle",
		"Muradpur",
	],
	Sylhet: ["Zindabazar", "Ambarkhana", "Upashahar", "Subhanighat", "Mendibagh"],
	Rajshahi: ["Shaheb Bazar", "Laxmipur", "Boalia", "Rajpara", "Motihar"],
	Khulna: ["Sonadanga", "Khalishpur", "Daulatpur", "Boyra", "Gollamari"],
	Cumilla: ["Kandirpar", "Tomsom Bridge", "Chowdhuryhat", "Rajganji"],
	Mymensingh: ["Ganginar Par", "Charpara", "Town Hall", "Akua"],
	Gazipur: ["Tongi", "Joydebpur", "Kaliakoir", "Kapasia"],
	Narayanganj: ["Fatullah", "Siddhirganj", "Bandar", "Araihazar"],
	Bogura: ["Satmatha", "Rangpur Road", "Nawabganj Road", "Malotinagor"],
};

export function createBranch(
	businessId: string,
	city: string,
	overrides: Partial<BranchSelect> = {},
): BranchSelect {
	const areas = BD_AREAS[city] ?? [
		"City Center",
		"Main Road",
		"Market Area",
		"Town Square",
	];
	const area = faker.helpers.arrayElement(areas);
	const [clat, clng] = CITY_CENTRES[city] ?? [23.78, 90.4];
	// ±0.05° jitter (~5 km) so branches in one city spread out for distance ranking.
	const lat = clat + faker.number.float({ min: -0.05, max: 0.05 });
	const lng = clng + faker.number.float({ min: -0.05, max: 0.05 });
	return {
		id: crypto.randomUUID(),
		businessId,
		name: `${area} Branch`,
		address: `${faker.number.int({ min: 1, max: 999 })} ${area} Road, ${city}`,
		area,
		city,
		lat,
		lng,
		createdAt: faker.date.past({ years: 2 }).toISOString(),
		updatedAt: new Date().toISOString(),
		deletedAt: null,
		...overrides,
	};
}
