import { ValidationError } from "../../core/errors";

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;
const MIN_PASSWORD_LENGTH = 8;

function bytesToB64(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes));
}

function b64ToBytes(b64: string): Uint8Array {
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a[i]! ^ b[i]!;
	}
	return diff === 0;
}

/** Normalise email for lookup/storage — lowercase and trim. */
export function normaliseEmail(email: string): string {
	return email.trim().toLowerCase();
}

export class PasswordIdentity {
	validatePolicy(password: string): void {
		if (password.length < MIN_PASSWORD_LENGTH) {
			throw new ValidationError(
				`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
			);
		}
	}

	async hash(password: string): Promise<string> {
		this.validatePolicy(password);
		const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
		const hash = await this.derive(password, salt);
		return `pbkdf2:${PBKDF2_ITERATIONS}:${bytesToB64(salt)}:${bytesToB64(hash)}`;
	}

	async verify(password: string, stored: string): Promise<boolean> {
		const parts = stored.split(":");
		if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;

		const iterations = Number(parts[1]);
		if (!Number.isFinite(iterations) || iterations <= 0) return false;

		const salt = b64ToBytes(parts[2]!);
		const expected = b64ToBytes(parts[3]!);
		const actual = await this.derive(password, salt, iterations);
		return timingSafeEqual(actual, expected);
	}

	private async derive(
		password: string,
		salt: Uint8Array,
		iterations = PBKDF2_ITERATIONS,
	): Promise<Uint8Array> {
		const keyMaterial = await crypto.subtle.importKey(
			"raw",
			new TextEncoder().encode(password),
			"PBKDF2",
			false,
			["deriveBits"],
		);
		const bits = await crypto.subtle.deriveBits(
			{ name: "PBKDF2", salt, iterations, hash: "SHA-256" },
			keyMaterial,
			HASH_BITS,
		);
		return new Uint8Array(bits);
	}
}
