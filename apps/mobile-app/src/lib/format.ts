/** Bangladesh market formatting (BDT, en-BD). */

export const LOCALE = "en-BD";
export const CURRENCY_SYMBOL = "৳";

export function formatMoney(n: number): string {
	return `${CURRENCY_SYMBOL}${n.toLocaleString(LOCALE)}`;
}

/** Compact price for map pins and tight UI. */
export function formatShortMoney(n: number): string {
	if (n >= 100_000) {
		return `${CURRENCY_SYMBOL}${(n / 100_000).toFixed(1).replace(".0", "")}L`;
	}
	if (n >= 1_000) {
		return `${CURRENCY_SYMBOL}${(n / 1_000).toFixed(1).replace(".0", "")}K`;
	}
	return formatMoney(n);
}

export function formatDate(
	iso: string,
	options?: Intl.DateTimeFormatOptions,
): string {
	return new Date(iso).toLocaleDateString(LOCALE, options);
}

export function formatNumber(n: number): string {
	return n.toLocaleString(LOCALE);
}
