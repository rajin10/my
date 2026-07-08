import type { AuthRepository } from "@repo/core/src/database/repositories/auth.repository";
import { sign, verify } from "hono/jwt";
import { UnauthorizedError } from "../../core/errors";
import type { AuthUser } from "../../types";

/**
 * SessionTokens owns the Talash session token end-to-end: issuing, verifying,
 * and rotating. Keeping the sign rule and the verify rule in one place ensures
 * they cannot drift apart.
 *
 * - `issue` / `rotate` are instance methods — they persist refresh tokens via
 *   the injected `AuthRepository`.
 * - `verify` is static — it needs only the JWT secret (no DB), so the auth
 *   middleware can call it cheaply without constructing a repository.
 */

const ACCESS_TOKEN_TTL = 60 * 15; // 15 minutes
const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 30; // 30 days

/**
 * The signed access-token claim set. Internal to this module — it is never
 * exported across module boundaries. Issue writes it; verify reads it and maps
 * it to {@link AuthUser} so no caller needs to know the wire shape.
 */
interface JwtPayload {
	sub: string;
	email: string | null;
	name: string;
	role: string;
	exp: number;
	// Index signature required by hono/jwt's JWTPayload
	[key: string]: unknown;
}

type SessionUser = {
	id: string;
	email: string | null;
	name: string;
	role: string;
};

type DeviceInfo = { deviceId?: string; deviceName?: string };

export interface SessionTokenPair {
	user: SessionUser;
	accessToken: string;
	refreshToken: string;
	expiresIn: number;
}

function addSeconds(seconds: number): string {
	return new Date(Date.now() + seconds * 1000).toISOString();
}

function nowIso(): string {
	return new Date().toISOString();
}

export class SessionTokens {
	constructor(
		private readonly repo: AuthRepository,
		private readonly jwtSecret: string,
	) {}

	/**
	 * Verify a Talash access token and map its claims to an {@link AuthUser}.
	 * Static so the auth middleware can call it with just the secret — no repo.
	 * Encapsulates the HS256 algorithm and the payload→user mapping so the
	 * payload shape stays internal to this module.
	 */
	static async verify(token: string, secret: string): Promise<AuthUser> {
		let payload: JwtPayload;
		try {
			payload = (await verify(token, secret, "HS256")) as unknown as JwtPayload;
		} catch {
			throw new UnauthorizedError("Invalid or expired token.");
		}

		return {
			id: payload.sub,
			email: payload.email ?? null,
			name: payload.name,
			role: payload.role,
		};
	}

	/**
	 * Issue a fresh access token (HS256, 15 min) plus a new refresh token
	 * (random UUID, 30 days, persisted via the repository).
	 */
	async issue(
		user: SessionUser,
		device?: DeviceInfo,
	): Promise<SessionTokenPair> {
		const payload: JwtPayload = {
			sub: user.id,
			email: user.email,
			name: user.name,
			role: user.role,
			exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL,
		};

		const accessToken = await sign(payload, this.jwtSecret);

		const refreshToken = crypto.randomUUID();
		const expiresAt = addSeconds(REFRESH_TOKEN_TTL);
		await this.repo.createRefreshToken(
			user.id,
			refreshToken,
			expiresAt,
			device,
		);

		return {
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				role: user.role,
			},
			accessToken,
			refreshToken,
			expiresIn: ACCESS_TOKEN_TTL,
		};
	}

	/**
	 * Rotate a refresh token: validate the presented token, then swap it for a
	 * new access + refresh token pair.
	 *
	 * Rotation trade-off — issue new first, then delete old:
	 * if `deleteRefreshToken` fails after `issue` succeeds, both the old and new
	 * token are temporarily valid. A truly atomic swap requires a D1 batch
	 * transaction in AuthRepository — track as a follow-up. The alternative
	 * (delete first) risks permanent session loss if `issue` fails.
	 */
	async rotate(
		oldRefreshToken: string,
		device?: DeviceInfo,
	): Promise<SessionTokenPair> {
		const stored = await this.repo.findRefreshToken(oldRefreshToken);

		if (!stored) {
			throw new UnauthorizedError("Invalid refresh token.");
		}

		if (stored.expiresAt < nowIso()) {
			await this.repo.deleteRefreshToken(oldRefreshToken, stored.userId);
			throw new UnauthorizedError(
				"Refresh token expired. Please log in again.",
			);
		}

		const user = await this.repo.findUserById(stored.userId);
		if (!user) {
			throw new UnauthorizedError("User no longer exists.");
		}

		const deviceInfo: DeviceInfo = {
			deviceId: stored.deviceId ?? undefined,
			deviceName: stored.deviceName ?? undefined,
		};
		const result = await this.issue(user, device ?? deviceInfo);
		await this.repo.deleteRefreshToken(oldRefreshToken, stored.userId);
		return result;
	}
}
