import { CATEGORIES } from "@/components/data";

/** Category filter chips — aligned with homepage CategoryStrip labels. */
export const SEARCH_CATEGORIES = [
	"All",
	...CATEGORIES.map((c) => c.label),
] as const;
