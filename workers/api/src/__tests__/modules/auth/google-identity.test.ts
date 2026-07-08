import { beforeAll, describe, expect, it, vi } from "vitest";
import { InternalError, UnauthorizedError } from "../../../core/errors";
import {
	GoogleIdentity,
	type HttpFetch,
} from "../../../modules/auth/google-identity";

const CLIENT_ID = "test-google-client-id";
const KID = "test-kid";

// JsonWebKey with the `kid` Google's JWKS keys carry (the Workers lib type omits it).
type JwkWithKid = JsonWebKey & { kid?: string };

// --- RS256 test keypair: sign real tokens, serve the public key as fake JWKS ---
let keyPair: CryptoKeyPair;
let publicJwk: JwkWithKid;
let otherPublicJwk: JwkWithKid;

async function exportPublicJwk(key: CryptoKey): Promise<JwkWithKid> {
	const jwk = (await crypto.subtle.exportKey("jwk", key)) as JwkWithKid;
	jwk.kid = KID;
	return jwk;
}

beforeAll(async () => {
	const algorithm = {
		name: "RSASSA-PKCS1-v1_5",
		modulusLength: 2048,
		publicExponent: new Uint8Array([1, 0, 1]),
		hash: "SHA-256",
	};
	keyPair = (await crypto.subtle.generateKey(algorithm, true, [
		"sign",
		"verify",
	])) as CryptoKeyPair;
	publicJwk = await exportPublicJwk(keyPair.publicKey);

	// A second, unrelated keypair whose public key won't validate our signatures.
	const other = (await crypto.subtle.generateKey(algorithm, true, [
		"sign",
		"verify",
	])) as CryptoKeyPair;
	otherPublicJwk = await exportPublicJwk(other.publicKey);
});

function b64url(input: string): string {
	return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bytesToB64url(bytes: Uint8Array): string {
	let str = "";
	for (const b of bytes) str += String.fromCharCode(b);
	return b64url(str);
}

async function signIdToken(
	payload: Record<string, unknown>,
	kid = KID,
): Promise<string> {
	const header = b64url(JSON.stringify({ alg: "RS256", kid }));
	const body = b64url(JSON.stringify(payload));
	const signingInput = `${header}.${body}`;
	const sig = await crypto.subtle.sign(
		"RSASSA-PKCS1-v1_5",
		keyPair.privateKey,
		new TextEncoder().encode(signingInput),
	);
	return `${signingInput}.${bytesToB64url(new Uint8Array(sig))}`;
}

function validPayload(overrides: Record<string, unknown> = {}) {
	return {
		iss: "accounts.google.com",
		sub: "google-sub-123",
		aud: CLIENT_ID,
		exp: Math.floor(Date.now() / 1000) + 3600,
		email: "user@example.com",
		email_verified: true,
		name: "Test User",
		...overrides,
	};
}

/** Fake JWKS seam returning the provided public key(s). */
function jwksSeam(...keys: JwkWithKid[]): HttpFetch {
	return vi.fn(async () =>
		Response.json({ keys: keys.length ? keys : [publicJwk] }),
	);
}

describe("GoogleIdentity.verifyIdToken", () => {
	it("returns a profile for a valid, correctly-signed ID token", async () => {
		const gi = new GoogleIdentity(CLIENT_ID, "secret", jwksSeam(publicJwk));
		const token = await signIdToken(validPayload());

		const profile = await gi.verifyIdToken(token);
		expect(profile).toEqual({
			sub: "google-sub-123",
			email: "user@example.com",
			name: "Test User",
		});
	});

	it("falls back to email local-part for the name when name is absent", async () => {
		const gi = new GoogleIdentity(CLIENT_ID, "secret", jwksSeam(publicJwk));
		const token = await signIdToken(validPayload({ name: undefined }));

		const profile = await gi.verifyIdToken(token);
		expect(profile.name).toBe("user");
	});

	it("rejects a token signed with a different (forged) key", async () => {
		// Seam serves an unrelated public key → signature verification fails.
		const gi = new GoogleIdentity(
			CLIENT_ID,
			"secret",
			jwksSeam(otherPublicJwk),
		);
		const token = await signIdToken(validPayload());

		await expect(gi.verifyIdToken(token)).rejects.toThrow(
			"Invalid Google ID token signature",
		);
	});

	it("rejects a token with a tampered payload (invalid signature)", async () => {
		const gi = new GoogleIdentity(CLIENT_ID, "secret", jwksSeam(publicJwk));
		const token = await signIdToken(validPayload());
		const [header, , sig] = token.split(".");
		const forgedPayload = b64url(
			JSON.stringify(validPayload({ sub: "attacker" })),
		);
		const forged = `${header}.${forgedPayload}.${sig}`;

		await expect(gi.verifyIdToken(forged)).rejects.toThrow(
			"Invalid Google ID token signature",
		);
	});

	it("rejects a wrong issuer before any network call", async () => {
		const seam = jwksSeam(publicJwk);
		const gi = new GoogleIdentity(CLIENT_ID, "secret", seam);
		const token = await signIdToken(validPayload({ iss: "evil.example.com" }));

		await expect(gi.verifyIdToken(token)).rejects.toThrow(
			"Invalid Google token issuer",
		);
		expect(seam).not.toHaveBeenCalled();
	});

	it("rejects a wrong audience before any network call", async () => {
		const seam = jwksSeam(publicJwk);
		const gi = new GoogleIdentity(CLIENT_ID, "secret", seam);
		const token = await signIdToken(validPayload({ aud: "other-client-id" }));

		await expect(gi.verifyIdToken(token)).rejects.toThrow(
			"Invalid Google token audience",
		);
		expect(seam).not.toHaveBeenCalled();
	});

	it("rejects an expired token before any network call", async () => {
		const seam = jwksSeam(publicJwk);
		const gi = new GoogleIdentity(CLIENT_ID, "secret", seam);
		const token = await signIdToken(
			validPayload({ exp: Math.floor(Date.now() / 1000) - 10 }),
		);

		await expect(gi.verifyIdToken(token)).rejects.toThrow(
			"Google ID token expired",
		);
		expect(seam).not.toHaveBeenCalled();
	});

	it("rejects a token with no audience claim", async () => {
		const seam = jwksSeam(publicJwk);
		const gi = new GoogleIdentity(CLIENT_ID, "secret", seam);
		const token = await signIdToken(validPayload({ aud: undefined }));

		await expect(gi.verifyIdToken(token)).rejects.toThrow(
			"Invalid Google token audience",
		);
		expect(seam).not.toHaveBeenCalled();
	});

	it("rejects an alg:none token (algorithm-confusion defense)", async () => {
		// Header claims alg:none, but verification is hardcoded to RS256 against
		// the JWKS key — the empty signature must fail, not be trusted.
		const gi = new GoogleIdentity(CLIENT_ID, "secret", jwksSeam(publicJwk));
		const header = b64url(JSON.stringify({ alg: "none", kid: KID }));
		const body = b64url(JSON.stringify(validPayload()));
		const token = `${header}.${body}.`;

		await expect(gi.verifyIdToken(token)).rejects.toThrow(
			"Invalid Google ID token signature",
		);
	});

	it("rejects a malformed (non-3-part) token", async () => {
		const gi = new GoogleIdentity(CLIENT_ID, "secret", jwksSeam(publicJwk));
		await expect(gi.verifyIdToken("not.a.valid.jwt")).rejects.toThrow(
			"Invalid Google ID token format",
		);
	});

	it("rejects a 3-part token whose segments are not valid JSON as 401, not 500", async () => {
		const gi = new GoogleIdentity(CLIENT_ID, "secret", jwksSeam(publicJwk));
		// Valid 3-part shape, but each segment decodes to non-JSON → JSON.parse throws.
		const token = `${b64url("not-json")}.${b64url("not-json")}.${b64url("sig")}`;
		await expect(gi.verifyIdToken(token)).rejects.toThrow(UnauthorizedError);
		await expect(gi.verifyIdToken(token)).rejects.toThrow(
			"Invalid Google ID token format",
		);
	});

	it("rejects a token with no exp claim", async () => {
		const seam = jwksSeam(publicJwk);
		const gi = new GoogleIdentity(CLIENT_ID, "secret", seam);
		const token = await signIdToken(validPayload({ exp: undefined }));

		await expect(gi.verifyIdToken(token)).rejects.toThrow(
			"Google ID token expired",
		);
		expect(seam).not.toHaveBeenCalled();
	});

	it("drops an unverified email to null (no account-linking on unverified email)", async () => {
		const gi = new GoogleIdentity(CLIENT_ID, "secret", jwksSeam(publicJwk));
		const token = await signIdToken(validPayload({ email_verified: false }));

		const profile = await gi.verifyIdToken(token);
		expect(profile.email).toBeNull();
		expect(profile.sub).toBe("google-sub-123");
		// name still comes from the payload's name field, not the dropped email.
		expect(profile.name).toBe("Test User");
	});

	it("drops the email when email_verified is absent", async () => {
		const gi = new GoogleIdentity(CLIENT_ID, "secret", jwksSeam(publicJwk));
		const token = await signIdToken(
			validPayload({ email_verified: undefined }),
		);

		const profile = await gi.verifyIdToken(token);
		expect(profile.email).toBeNull();
	});

	it("accepts any of the comma-separated multi-platform client IDs", async () => {
		const gi = new GoogleIdentity(
			`web-id, ${CLIENT_ID}, android-id`,
			"secret",
			jwksSeam(publicJwk),
		);
		const token = await signIdToken(validPayload({ aud: CLIENT_ID }));
		const profile = await gi.verifyIdToken(token);
		expect(profile.sub).toBe("google-sub-123");
	});

	it("throws InternalError when the client id is not configured", async () => {
		const gi = new GoogleIdentity("", "secret", jwksSeam(publicJwk));
		const token = await signIdToken(validPayload());
		await expect(gi.verifyIdToken(token)).rejects.toThrow(InternalError);
	});

	it("throws when the signing key is not present in the JWKS", async () => {
		const gi = new GoogleIdentity(
			CLIENT_ID,
			"secret",
			jwksSeam({ kid: "x" } as JwkWithKid),
		);
		const token = await signIdToken(validPayload());
		await expect(gi.verifyIdToken(token)).rejects.toThrow(
			"Signing key not found in Google JWKS",
		);
	});
});

describe("GoogleIdentity.exchangeCode", () => {
	it("maps a fake token + userinfo response to a profile", async () => {
		const seam: HttpFetch = vi.fn(async (url: string) => {
			if (url === "https://oauth2.googleapis.com/token") {
				return Response.json({ access_token: "ya29.fake" });
			}
			return Response.json({
				sub: "google-sub-999",
				email: "alice@example.com",
				email_verified: true,
				name: "Alice",
			});
		});
		const gi = new GoogleIdentity(CLIENT_ID, "secret", seam);

		const profile = await gi.exchangeCode("auth-code", "https://app/callback");
		expect(profile).toEqual({
			sub: "google-sub-999",
			email: "alice@example.com",
			name: "Alice",
		});
	});

	it("drops an unverified email from the exchanged profile", async () => {
		const seam: HttpFetch = vi.fn(async (url: string) =>
			url === "https://oauth2.googleapis.com/token"
				? Response.json({ access_token: "ya29.fake" })
				: Response.json({
						sub: "google-sub-999",
						email: "alice@example.com",
						email_verified: false,
						name: "Alice",
					}),
		);
		const gi = new GoogleIdentity(CLIENT_ID, "secret", seam);

		const profile = await gi.exchangeCode("auth-code", "https://app/callback");
		expect(profile.email).toBeNull();
		expect(profile.sub).toBe("google-sub-999");
	});

	it("throws when the token exchange fails", async () => {
		const seam: HttpFetch = vi.fn(
			async () => new Response("nope", { status: 400 }),
		);
		const gi = new GoogleIdentity(CLIENT_ID, "secret", seam);
		await expect(
			gi.exchangeCode("bad-code", "https://app/callback"),
		).rejects.toThrow("Failed to exchange Google authorization code.");
	});

	it("throws UnauthorizedError when userinfo fetch fails", async () => {
		const seam: HttpFetch = vi.fn(async (url: string) =>
			url === "https://oauth2.googleapis.com/token"
				? Response.json({ access_token: "ya29.fake" })
				: new Response("nope", { status: 401 }),
		);
		const gi = new GoogleIdentity(CLIENT_ID, "secret", seam);
		await expect(
			gi.exchangeCode("code", "https://app/callback"),
		).rejects.toThrow(UnauthorizedError);
	});
});

describe("GoogleIdentity.buildAuthUrl", () => {
	it("uses the first (web) client id and includes the state nonce", () => {
		const gi = new GoogleIdentity(
			"web-id,android-id",
			"secret",
			jwksSeam(publicJwk),
		);
		const url = new URL(gi.buildAuthUrl("https://app/callback", "state-123"));
		expect(url.origin + url.pathname).toBe(
			"https://accounts.google.com/o/oauth2/v2/auth",
		);
		expect(url.searchParams.get("client_id")).toBe("web-id");
		expect(url.searchParams.get("state")).toBe("state-123");
		expect(url.searchParams.get("redirect_uri")).toBe("https://app/callback");
	});
});
