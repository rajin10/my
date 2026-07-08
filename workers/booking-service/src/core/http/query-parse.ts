import qs, { type IParseOptions, type IStringifyOptions } from "qs";
import { isArray, isBoolean, isObject } from "./helpers";

export const queryStringifyOptions: IStringifyOptions = {
	encode: false,
	arrayFormat: "comma",
	allowEmptyArrays: false,
	allowDots: true,
	skipNulls: true,
	indices: false,
};

function parseArray(arr: unknown[]) {
	const result: unknown[] = [];
	for (let i = 0; i < arr.length; i++) {
		result[i] = parseValue(arr[i]);
	}
	return result;
}

function parseBoolean(val: unknown) {
	return val === "true";
}

function parseValue(val: unknown) {
	if (typeof val === "undefined" || val === "") {
		return null;
	} else if (isBoolean(val)) {
		return parseBoolean(val);
	} else if (isArray(val)) {
		return parseArray(val);
	} else if (isObject(val)) {
		return parseObject(val);
	} else {
		// Scalars stay in raw string form; route schemas coerce per field
		// (`z.coerce.number()` etc.) — the single place numeric intent is declared.
		return val;
	}
}

export function parseObject(obj: unknown) {
	if (!isObject(obj)) return null;

	const value = obj as Record<string, unknown>;
	const result: Record<string, unknown> = {};
	for (const key in value) {
		const val = parseValue(value[key]);
		if (val !== null) result[key] = val; // ignore null values
	}
	return result;
}

export function parseQueryString(
	queryString: string,
	options: IParseOptions = {},
) {
	return qs.parse(queryString, {
		...queryStringifyOptions,
		...options,
	});
}

export function stringifyQueryObj(params: object) {
	return qs.stringify(params, queryStringifyOptions);
}

// encode UTF-8 bytes -> hex string
export function stringToHex(str: string): string {
	const encoder = new TextEncoder();
	const bytes = encoder.encode(str); // Uint8Array
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

// decode hex string -> original string
export function hexToString(hex: string): string {
	if (hex.length % 2 !== 0) throw new Error("Invalid hex string");
	const matches = hex.match(/.{1,2}/g);
	if (!matches) throw new Error("Invalid hex string");
	const bytes = new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
	const decoder = new TextDecoder();
	return decoder.decode(bytes);
}

/**
 * Normalizes fields parameter from query string to array.
 * Query params can come as comma-separated strings or arrays.
 */
export function normalizeFields(
	fields: string | string[] | undefined,
): string[] | undefined {
	if (!fields) {
		return undefined;
	}

	if (typeof fields === "string") {
		const parsed = fields
			.split(",")
			.map((f) => f.trim())
			.filter(Boolean);
		return parsed.length > 0 ? parsed : undefined;
	}

	if (Array.isArray(fields)) {
		return fields.length > 0 ? fields : undefined;
	}

	return undefined;
}
