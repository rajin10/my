import type { ServiceSelect } from "@core/database/schema/services.schema";
import { faker } from "@faker-js/faker";

interface ServiceTemplate {
	category: string;
	names: string[];
	durationRange: [number, number]; // minutes
	priceRange: [number, number]; // BDT in poisha (1 BDT = 100 poisha)
}

const SERVICE_TEMPLATES: ServiceTemplate[] = [
	{
		category: "Hair",
		names: [
			"Haircut",
			"Hair Color",
			"Hair Treatment",
			"Blowout",
			"Hair Extension",
			"Keratin Treatment",
			"Hair Straightening",
		],
		durationRange: [30, 120],
		priceRange: [30000, 200000],
	},
	{
		category: "Nail",
		names: [
			"Manicure",
			"Pedicure",
			"Gel Nails",
			"Nail Art",
			"Acrylic Nails",
			"Shellac Manicure",
			"French Tips",
		],
		durationRange: [30, 90],
		priceRange: [20000, 100000],
	},
	{
		category: "Massage",
		names: [
			"Swedish Massage",
			"Deep Tissue Massage",
			"Hot Stone Massage",
			"Aromatherapy Massage",
			"Foot Massage",
			"Head Massage",
			"Couples Massage",
		],
		durationRange: [45, 120],
		priceRange: [50000, 300000],
	},
	{
		category: "Facial",
		names: [
			"Classic Facial",
			"Hydration Facial",
			"Anti-Aging Facial",
			"Acne Treatment Facial",
			"Brightening Facial",
			"Gold Facial",
		],
		durationRange: [45, 90],
		priceRange: [50000, 250000],
	},
	{
		category: "Waxing",
		names: [
			"Full Body Wax",
			"Eyebrow Wax",
			"Upper Lip Wax",
			"Arms Wax",
			"Legs Wax",
			"Underarm Wax",
		],
		durationRange: [20, 60],
		priceRange: [10000, 80000],
	},
	{
		category: "Makeup",
		names: [
			"Bridal Makeup",
			"Party Makeup",
			"Natural Makeup",
			"HD Makeup",
			"Airbrush Makeup",
			"Editorial Makeup",
		],
		durationRange: [60, 180],
		priceRange: [100000, 500000],
	},
	{
		category: "Skincare",
		names: [
			"Chemical Peel",
			"Microdermabrasion",
			"LED Therapy",
			"Oxygen Facial",
			"Dermaplaning",
		],
		durationRange: [45, 90],
		priceRange: [80000, 300000],
	},
	{
		category: "Eyebrow",
		names: [
			"Eyebrow Threading",
			"Eyebrow Tinting",
			"Eyebrow Lamination",
			"Brow Shaping",
			"Microblading",
		],
		durationRange: [15, 45],
		priceRange: [5000, 50000],
	},
];

export function createService(
	branchId: string,
	overrides: Partial<ServiceSelect> = {},
): ServiceSelect {
	const template = faker.helpers.arrayElement(SERVICE_TEMPLATES);
	return {
		id: crypto.randomUUID(),
		branchId,
		name: faker.helpers.arrayElement(template.names),
		category: template.category,
		duration: faker.number.int({
			min: template.durationRange[0],
			max: template.durationRange[1],
		}),
		price: faker.number.int({
			min: template.priceRange[0],
			max: template.priceRange[1],
		}),
		description: faker.commerce.productDescription(),
		imageUrl: null,
		createdAt: faker.date.past({ years: 1 }).toISOString(),
		updatedAt: new Date().toISOString(),
		deletedAt: null,
		...overrides,
	};
}
