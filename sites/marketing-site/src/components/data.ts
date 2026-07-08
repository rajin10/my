export const TONES = {
	forest: "linear-gradient(140deg,#1f6b58,#0b4a3c)",
	clay: "linear-gradient(140deg,#9c7448,#5d4327)",
	sage: "linear-gradient(140deg,#6f8a73,#3e5742)",
	stone: "linear-gradient(140deg,#8a8170,#544d3e)",
	rose: "linear-gradient(140deg,#a86b63,#6e3f3a)",
	deep: "linear-gradient(140deg,#2e7d8c,#1b5560)",
};

export type Business = {
	id: string;
	name: string;
	cat: string;
	city: string;
	rating: number;
	reviews: number;
	from: number;
	tone: string;
	premium?: boolean;
	coverPhotoUrl?: string | null;
};

export type Category = {
	label: string;
	icon: string;
	tone: string;
};

export const CATEGORIES: Category[] = [
	{ label: "Hair & barber", icon: "Scissors", tone: "var(--primary-100)" },
	{ label: "Spa & massage", icon: "Flower2", tone: "var(--gold-100)" },
	{ label: "Fitness & yoga", icon: "Dumbbell", tone: "var(--primary-100)" },
	{ label: "Skin & clinics", icon: "Stethoscope", tone: "var(--gold-100)" },
	{ label: "Nails", icon: "Sparkles", tone: "var(--primary-100)" },
	{ label: "Wellness", icon: "Leaf", tone: "var(--gold-100)" },
];
