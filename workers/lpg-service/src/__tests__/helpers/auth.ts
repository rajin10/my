import { sign } from "hono/jwt";

export const TEST_JWT_SECRET = "test-secret";

export const TEST_ENV = {
	JWT_SECRET: TEST_JWT_SECRET,
	ALLOWED_ORIGINS: "",
	PUBLIC_R2_URL: "https://storage.test",
	ENVIRONMENT: "test",
} as unknown as CloudflareBindings;

export interface TestTokenOptions {
	userId?: string;
	email?: string;
	name?: string;
	role?: string;
}

export async function createTestToken(
	opts: TestTokenOptions = {},
): Promise<string> {
	const {
		userId = "test-user-id",
		email = "test@example.com",
		name = "Test User",
		role = "user",
	} = opts;

	return sign(
		{
			sub: userId,
			email,
			name,
			role,
			exp: Math.floor(Date.now() / 1000) + 3600,
		},
		TEST_JWT_SECRET,
	);
}

export function authHeader(token: string): Record<string, string> {
	return { Authorization: `Bearer ${token}` };
}
