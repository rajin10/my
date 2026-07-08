import type { AuthRepository } from "@repo/core/src/database/repositories/auth.repository";
import {
	EmailAlreadyRegisteredError,
	GoogleAccountExistsError,
} from "@repo/core/src/database/repositories/auth.repository";
import {
	ConflictError,
	ForbiddenError,
	NotFoundError,
	UnauthorizedError,
	ValidationError,
} from "../../core/errors";
import { KV_KEYS, KV_TTL, kvDel, kvGet, kvSet } from "../../core/kv/cache";
import { GoogleIdentity } from "./google-identity";
import type { PasswordEmail } from "./password-email";
import { normaliseEmail, PasswordIdentity } from "./password-identity";
import { assertAllowedResetUri } from "./reset-uri";
import { SessionTokens } from "./session-tokens";
import { roleForSource, type SignInSource } from "./sign-in-source";

type OAuthStateData = { redirectUri: string; source?: SignInSource };

type ResetTokenData = {
	userId: string;
	email: string;
	source?: SignInSource;
	resetUri: string;
};

const FORGOT_PASSWORD_MESSAGE =
	"If an account exists, a reset link has been sent.";

export type AccountActionProof = { password: string } | { idToken: string };

export class AuthService {
	private readonly sessionTokens: SessionTokens;
	private readonly googleIdentity: GoogleIdentity;
	private readonly passwordIdentity: PasswordIdentity;

	constructor(
		private readonly repo: AuthRepository,
		private readonly kv: KVNamespace,
		jwtSecret: string,
		googleClientId: string,
		googleClientSecret: string,
		private readonly passwordEmail: PasswordEmail,
		private readonly allowedResetUris: string | undefined,
	) {
		this.sessionTokens = new SessionTokens(repo, jwtSecret);
		this.googleIdentity = new GoogleIdentity(
			googleClientId,
			googleClientSecret,
		);
		this.passwordIdentity = new PasswordIdentity();
	}

	async refresh(
		refreshToken: string,
		device?: { deviceId?: string; deviceName?: string },
	) {
		return this.sessionTokens.rotate(refreshToken, device);
	}

	async logout(refreshToken: string, userId: string) {
		await this.repo.deleteRefreshToken(refreshToken, userId);
	}

	async getUser(userId: string) {
		return this.repo.findUserById(userId);
	}

	async getMeProfile(userId: string) {
		const user = await this.repo.findUserById(userId);
		if (!user) return null;

		const credentials = await this.repo.findCredentialsByUserId(userId);
		return {
			id: user.id,
			email: user.email,
			name: user.name,
			role: user.role,
			photoUrl: user.photoUrl ?? null,
			authMethods: {
				password: Boolean(credentials?.passwordHash),
				google: Boolean(user.googleId),
			},
		};
	}

	async verifyAccountAction(
		userId: string,
		proof: AccountActionProof,
	): Promise<void> {
		const user = await this.repo.findUserById(userId);
		if (!user) throw new NotFoundError("User not found");

		if ("password" in proof) {
			const credentials = await this.repo.findCredentialsByUserId(userId);
			if (!credentials?.passwordHash) {
				throw new ValidationError(
					"Password verification is not available for this account.",
				);
			}
			const valid = await this.passwordIdentity.verify(
				proof.password,
				credentials.passwordHash,
			);
			if (!valid) {
				throw new ValidationError("Verification failed.");
			}
			return;
		}

		if (!user.googleId) {
			throw new ValidationError(
				"Google verification is not available for this account.",
			);
		}
		const { sub } = await this.googleIdentity.verifyIdToken(proof.idToken);
		if (sub !== user.googleId) {
			throw new ForbiddenError(
				"This Google account does not match your Talash account.",
			);
		}
	}

	async listSessions(userId: string) {
		return this.repo.listSessionsByUser(userId);
	}

	async revokeSession(userId: string, sessionId: string) {
		return this.repo.revokeSessionById(sessionId, userId);
	}

	async register(
		email: string,
		password: string,
		name: string,
		source?: SignInSource,
	) {
		this.passwordIdentity.validatePolicy(password);
		const normalisedEmail = normaliseEmail(email);
		const role = roleForSource(source);

		let passwordHash: string;
		try {
			passwordHash = await this.passwordIdentity.hash(password);
		} catch (error) {
			if (error instanceof ValidationError) throw error;
			throw error;
		}

		try {
			const { user } = await this.repo.registerWithPassword(
				normalisedEmail,
				passwordHash,
				name.trim(),
				role,
			);
			const tokens = await this.sessionTokens.issue(user);
			return { ...tokens, isNewUser: true as const };
		} catch (error) {
			if (error instanceof GoogleAccountExistsError) {
				throw new ConflictError(error.message);
			}
			if (error instanceof EmailAlreadyRegisteredError) {
				throw new ConflictError(error.message);
			}
			throw error;
		}
	}

	async login(email: string, password: string, source?: SignInSource) {
		const normalisedEmail = normaliseEmail(email);
		const role = roleForSource(source);
		const user = await this.repo.findUserByEmailAndRole(normalisedEmail, role);

		if (!user) {
			throw new UnauthorizedError("Invalid email or password.");
		}

		const credentials = await this.repo.findCredentialsByUserId(user.id);
		if (!credentials?.passwordHash) {
			throw new UnauthorizedError("Invalid email or password.");
		}

		const valid = await this.passwordIdentity.verify(
			password,
			credentials.passwordHash,
		);
		if (!valid) {
			throw new UnauthorizedError("Invalid email or password.");
		}

		return this.sessionTokens.issue(user);
	}

	async forgotPassword(email: string, resetUri: string, source?: SignInSource) {
		assertAllowedResetUri(resetUri, this.allowedResetUris);

		const normalisedEmail = normaliseEmail(email);
		const role = roleForSource(source);
		const user = await this.repo.findUserByEmailAndRole(normalisedEmail, role);

		if (user) {
			const token = crypto.randomUUID();
			await kvSet<ResetTokenData>(
				this.kv,
				KV_KEYS.resetToken(token),
				{
					userId: user.id,
					email: normalisedEmail,
					source,
					resetUri,
				},
				KV_TTL.resetToken,
			);

			const resetUrl = `${resetUri}${resetUri.includes("?") ? "&" : "?"}token=${token}`;
			await this.passwordEmail.sendResetEmail(
				normalisedEmail,
				user.name,
				resetUrl,
			);
		}

		return { message: FORGOT_PASSWORD_MESSAGE };
	}

	async resetPassword(token: string, password: string) {
		this.passwordIdentity.validatePolicy(password);

		const stored = await kvGet<ResetTokenData>(
			this.kv,
			KV_KEYS.resetToken(token),
		);
		if (!stored) {
			throw new UnauthorizedError("Invalid or expired reset token.");
		}

		await kvDel(this.kv, KV_KEYS.resetToken(token));

		const passwordHash = await this.passwordIdentity.hash(password);
		await this.repo.setPasswordHash(stored.userId, passwordHash);

		return { message: "Password updated." };
	}

	async googleSignIn(idToken: string, source?: SignInSource) {
		const { sub, email, name } =
			await this.googleIdentity.verifyIdToken(idToken);
		const { user, isNew } = await this.repo.findOrCreateUserByGoogle(
			sub,
			email,
			name,
			roleForSource(source),
		);
		const tokens = await this.sessionTokens.issue(user);
		return { ...tokens, isNewUser: isNew };
	}

	async getGoogleAuthUrl(
		redirectUri: string,
		source?: SignInSource,
	): Promise<{ url: string }> {
		const state = crypto.randomUUID();
		await kvSet<OAuthStateData>(
			this.kv,
			KV_KEYS.oauthState(state),
			{ redirectUri, source },
			KV_TTL.oauthState,
		);

		return { url: this.googleIdentity.buildAuthUrl(redirectUri, state) };
	}

	async handleGoogleCallback(code: string, state: string) {
		const stored = await kvGet<OAuthStateData>(
			this.kv,
			KV_KEYS.oauthState(state),
		);
		if (!stored) {
			throw new UnauthorizedError("Invalid or expired OAuth state.");
		}
		await kvDel(this.kv, KV_KEYS.oauthState(state));

		const { sub, email, name } = await this.googleIdentity.exchangeCode(
			code,
			stored.redirectUri,
		);
		const { user } = await this.repo.findOrCreateUserByGoogle(
			sub,
			email,
			name,
			roleForSource(stored.source),
		);

		return this.sessionTokens.issue(user);
	}

	async savePushToken(userId: string, token: string) {
		await this.repo.savePushToken(userId, token);
	}
}
