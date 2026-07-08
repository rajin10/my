/**
 * Opaque cursor codec for keyset pagination.
 *
 * A cursor encodes the `(createdAt, id)` of the last row on a page so the next
 * page can be fetched with a stable composite keyset. The token is hex-encoded
 * so callers treat it as opaque. ISO-8601 timestamps and UUIDs never contain
 * the `|` delimiter, so a single split is unambiguous.
 */

const DELIMITER = "|";

function toHex(value: string): string {
	const bytes = new TextEncoder().encode(value);
	let out = "";
	for (const byte of bytes) {
		out += byte.toString(16).padStart(2, "0");
	}
	return out;
}

function fromHex(hex: string): string {
	if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/.test(hex)) {
		throw new Error("Invalid hex");
	}
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return new TextDecoder().decode(bytes);
}

export interface CursorParts {
	createdAt: string;
	id: string;
}

export function encodeCursor(createdAt: string, id: string): string {
	return toHex(`${createdAt}${DELIMITER}${id}`);
}

/**
 * Decodes an opaque cursor. Returns `null` for any malformed input so callers
 * can degrade gracefully (treat as first page) instead of throwing.
 */
export function decodeCursor(cursor: string): CursorParts | null {
	let decoded: string;
	try {
		decoded = fromHex(cursor);
	} catch {
		return null;
	}

	const idx = decoded.indexOf(DELIMITER);
	if (idx === -1) {
		return null;
	}

	const createdAt = decoded.slice(0, idx);
	const id = decoded.slice(idx + 1);
	if (!createdAt || !id) {
		return null;
	}

	return { createdAt, id };
}
