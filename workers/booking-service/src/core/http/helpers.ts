// Helper function to escape regex special characters
export function escapeRegExp(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Helper function to escape SQL LIKE/ILIKE special characters (% and _)
export function escapeLike(string: string): string {
	return string.replace(/[%_\\]/g, "\\$&");
}

// generate slug
export function generateSlug(...parts: string[]): string {
	return parts
		.filter(Boolean) // remove empty strings or null
		.join(" ") // combine into a single string
		.toLowerCase()
		.normalize("NFD") // remove accents
		.replace(/[\u0300-\u036f]/g, "") // remove diacritics
		.replace(/[^a-z0-9]+/g, "-") // replace non-alphanumeric with dashes
		.replace(/^-+|-+$/g, ""); // trim leading/trailing dashes
}

export function stripUndefined<T extends object>(obj: T): Partial<T> {
	return Object.fromEntries(
		Object.entries(obj).filter(([_, v]) => v !== undefined),
	) as Partial<T>;
}

export function isObject(val: unknown) {
	return typeof val === "object" && val !== null && val.constructor === Object;
}
export function isNumber(val: unknown) {
	return (
		!Number.isNaN(parseFloat(val as string)) && Number.isFinite(val as number)
	);
}
export function isBoolean(val: unknown) {
	return val === "false" || val === "true";
}
export function isArray(val: unknown) {
	return Array.isArray(val);
}

export const getTimeOfZone = (timezone: string) => {
	return new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		hour12: false,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	}).format(new Date());
};
