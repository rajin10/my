import { InternalError, UnauthorizedError } from "../../core/errors";

export type HttpFetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface GoogleProfile {
	sub: string;
	email: string | null;
	name: string;
}

const VALID_ISSUERS = new Set([
	"accounts.google.com",
	"https://accounts.google.com",
]);

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

function decodeB64(b64: string): string {
	return atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
}

function resolveName(name: string | undefined, email: string | null): string {
	return name ?? email?.split("@")[0] ?? "User";
}

export class GoogleIdentity {
	constructor(
		private readonly googleClientId: string,
		private readonly googleClientSecret: string,
		private readonly httpFetch: HttpFetch = fetch.bind(globalThis),
	) {}

	private getGoogleClientIds(): string[] {
		if (typeof this.googleClientId !== "string") {
			throw new InternalError("Google auth is not configured.");
		}

		const clientIds = this.googleClientId
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);

		if (clientIds.length === 0) {
			throw new InternalError("Google auth is not configured.");
		}

		return clientIds;
	}

	async verifyIdToken(idToken: string): Promise<GoogleProfile> {
		const parts = idToken.split(".");
		if (parts.length !== 3)
			throw new UnauthorizedError("Invalid Google ID token format");

		const [headerB64, payloadB64, signatureB64] = parts as [
			string,
			string,
			string,
		];

		let header: { kid: string; alg: string };
		let payload: {
			iss?: string;
			sub?: string;
			aud?: string | string[];
			exp?: number;
			email?: string;
			email_verified?: boolean;
			name?: string;
		};
		try {
			header = JSON.parse(decodeB64(headerB64));
			payload = JSON.parse(decodeB64(payloadB64));
		} catch {
			throw new UnauthorizedError("Invalid Google ID token format");
		}

		const now = Math.floor(Date.now() / 1000);
		if (typeof payload.exp !== "number" || payload.exp < now)
			throw new UnauthorizedError("Google ID token expired");

		if (typeof payload.iss !== "string") {
			throw new UnauthorizedError("Invalid Google token issuer");
		}

		if (!VALID_ISSUERS.has(payload.iss))
			throw new UnauthorizedError("Invalid Google token issuer");

		const allowedAudiences = new Set(this.getGoogleClientIds());
		const audiences = Array.isArray(payload.aud)
			? payload.aud.filter((a): a is string => typeof a === "string")
			: typeof payload.aud === "string"
				? [payload.aud]
				: [];
		if (!audiences.some((a) => allowedAudiences.has(a))) {
			throw new UnauthorizedError("Invalid Google token audience");
		}

		const jwksResponse = await this.httpFetch(GOOGLE_JWKS_URL);
		if (!jwksResponse.ok)
			throw new UnauthorizedError("Failed to fetch Google public keys");
		const jwks = (await jwksResponse.json()) as { keys: JsonWebKey[] };

		const jwk = jwks.keys.find(
			(k) => (k as { kid?: string }).kid === header.kid,
		);
		if (!jwk)
			throw new UnauthorizedError("Signing key not found in Google JWKS");

		const key = await crypto.subtle.importKey(
			"jwk",
			jwk,
			{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
			false,
			["verify"],
		);

		const encoder = new TextEncoder();
		const sigBytes = Uint8Array.from(decodeB64(signatureB64), (c) =>
			c.charCodeAt(0),
		);
		const valid = await crypto.subtle.verify(
			"RSASSA-PKCS1-v1_5",
			key,
			sigBytes,
			encoder.encode(`${headerB64}.${payloadB64}`),
		);

		if (!valid)
			throw new UnauthorizedError("Invalid Google ID token signature");

		if (typeof payload.sub !== "string" || payload.sub.length === 0) {
			throw new UnauthorizedError("Invalid Google token subject");
		}

		const email =
			payload.email && payload.email_verified === true ? payload.email : null;

		return {
			sub: payload.sub,
			email,
			name: resolveName(payload.name, email),
		};
	}

	buildAuthUrl(redirectUri: string, state: string): string {
		const webClientId = this.getGoogleClientIds()[0];
		const params = new URLSearchParams({
			client_id: webClientId,
			redirect_uri: redirectUri,
			response_type: "code",
			scope: "openid email profile",
			state,
			access_type: "offline",
			prompt: "select_account",
		});
		return `${GOOGLE_AUTH_URL}?${params}`;
	}

	async exchangeCode(
		code: string,
		redirectUri: string,
	): Promise<GoogleProfile> {
		const webClientId = this.getGoogleClientIds()[0];
		const tokenRes = await this.httpFetch(GOOGLE_TOKEN_URL, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				code,
				client_id: webClientId,
				client_secret: this.googleClientSecret,
				redirect_uri: redirectUri,
				grant_type: "authorization_code",
			}).toString(),
		});

		if (!tokenRes.ok) {
			throw new UnauthorizedError(
				"Failed to exchange Google authorization code.",
			);
		}

		const tokenData = (await tokenRes.json()) as { access_token: string };

		const profileRes = await this.httpFetch(GOOGLE_USERINFO_URL, {
			headers: { Authorization: `Bearer ${tokenData.access_token}` },
		});

		if (!profileRes.ok) {
			throw new UnauthorizedError("Failed to fetch Google user profile.");
		}

		const profile = (await profileRes.json()) as {
			sub: string;
			email?: string;
			email_verified?: boolean;
			name?: string;
		};

		const email =
			profile.email && profile.email_verified === true ? profile.email : null;

		return {
			sub: profile.sub,
			email,
			name: resolveName(profile.name, email),
		};
	}
}
