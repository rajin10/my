import {
	type BrandPalette,
	type BusinessSelect,
	BusinessStatus,
} from "@core/database/schema/businesses.schema";
import { faker } from "@faker-js/faker";

/**
 * A WCAG-AA-safe example palette (ADR-0003) for seeding one themed business so
 * the white-label render path has data to exercise. Deep plum brand + warm gold
 * accent on a near-white surface with near-black text — all role pairs clear AA.
 */
export const EXAMPLE_BRAND_PALETTE: BrandPalette = {
	primary: "#5B2A86",
	accent: "#C9A063",
	foreground: "#1A1320",
	surface: "#FDFBFF",
};

export const BUSINESS_CATEGORIES = [
	"Hair Salon",
	"Spa",
	"Nail Salon",
	"Beauty Parlour",
	"Barbershop",
	"Massage Center",
	"Skincare Clinic",
	"Makeup Studio",
	"Eyebrow Studio",
	"Waxing Salon",
] as const;

export const BD_CITIES = [
	"Dhaka",
	"Chittagong",
	"Sylhet",
	"Rajshahi",
	"Khulna",
	"Cumilla",
	"Mymensingh",
	"Gazipur",
	"Narayanganj",
	"Bogura",
] as const;

const BUSINESS_SUFFIXES = [
	"Studio",
	"Lounge",
	"Center",
	"Salon",
	"Parlour",
	"Spa",
];

export function createBusiness(
	ownerId: string,
	overrides: Partial<BusinessSelect> = {},
): BusinessSelect {
	const category = faker.helpers.arrayElement(BUSINESS_CATEGORIES);
	const suffix = faker.helpers.arrayElement(BUSINESS_SUFFIXES);
	return {
		id: crypto.randomUUID(),
		name: `${faker.person.lastName()} ${suffix}`,
		vertical: "booking",
		category,
		city: faker.helpers.arrayElement(BD_CITIES),
		status: faker.helpers.weightedArrayElement([
			{ weight: 7, value: BusinessStatus.ACTIVE },
			{ weight: 2, value: BusinessStatus.DRAFT },
			{ weight: 1, value: BusinessStatus.SUSPENDED },
		]),
		description: faker.company.catchPhrase(),
		phone: null,
		email: null,
		website: null,
		brandPalette: null,
		ownerId,
		createdAt: faker.date.past({ years: 2 }).toISOString(),
		updatedAt: new Date().toISOString(),
		deletedAt: null,
		...overrides,
	};
}
