// scripts/dev/__tests__/templates.test.ts
import { describe, expect, test } from "bun:test";
import { GOOGLE_CLIENT_ID, PORTS } from "../constants.ts";
import { renderAllEnvFiles } from "../templates.ts";

const secrets = {
	jwtSecret: "test-jwt-secret-min-32-chars-long!!",
	googleClientSecret: "GOCSPX-test-secret",
};

describe("renderAllEnvFiles", () => {
	test("api dev vars point at localhost origins", () => {
		const files = renderAllEnvFiles(secrets);
		expect(files.apiDevVars).toContain(
			'JWT_SECRET="test-jwt-secret-min-32-chars-long!!"',
		);
		expect(files.apiDevVars).toContain(GOOGLE_CLIENT_ID);
		expect(files.apiDevVars).toContain(
			`ALLOWED_ORIGINS="http://localhost:${PORTS.marketing},http://localhost:${PORTS.dashboard}"`,
		);
	});

	test("marketing site uses localhost API", () => {
		const files = renderAllEnvFiles(secrets);
		expect(files.marketingEnv).toContain(
			"NEXT_PUBLIC_API_URL=http://localhost:8787",
		);
		expect(files.marketingEnv).toContain(
			`NEXT_PUBLIC_GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}`,
		);
	});

	test("mobile apps use redirect auth provider", () => {
		const files = renderAllEnvFiles(secrets);
		expect(files.mobileEnv).toContain("EXPO_PUBLIC_AUTH_PROVIDER=redirect");
		expect(files.ownerEnv).toContain(
			"EXPO_PUBLIC_API_URL=http://localhost:8787",
		);
	});
});
