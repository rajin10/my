import { type DevSecrets, GOOGLE_CLIENT_ID, PORTS } from "./constants.ts";

export type RenderedEnvFiles = {
	apiDevVars: string;
	marketingEnv: string;
	dashboardEnv: string;
	mobileEnv: string;
	ownerEnv: string;
};

function q(value: string): string {
	return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function renderAllEnvFiles(secrets: DevSecrets): RenderedEnvFiles {
	const origins = `http://localhost:${PORTS.marketing},http://localhost:${PORTS.dashboard}`;
	const resetUris = [
		`http://localhost:${PORTS.marketing}/auth/reset-password`,
		`http://localhost:${PORTS.dashboard}/auth/reset-password`,
		"mobileapp://auth/reset-password",
		"ownerapp://auth/reset-password",
	].join(",");

	const apiDevVars = [
		"ENVIRONMENT=development",
		`JWT_SECRET=${q(secrets.jwtSecret)}`,
		`GOOGLE_CLIENT_ID=${q(GOOGLE_CLIENT_ID)}`,
		`GOOGLE_CLIENT_SECRET=${q(secrets.googleClientSecret)}`,
		`ALLOWED_ORIGINS=${q(origins)}`,
		`ALLOWED_RESET_URIS=${q(resetUris)}`,
		'PUBLIC_R2_URL="https://storage.talash.bd"',
		'EMAIL_FROM="noreply@talash.bd"',
		"",
	].join("\n");

	const marketingEnv = [
		"NEXTJS_ENV=development",
		"API_URL=http://localhost:8787",
		"NEXT_PUBLIC_API_URL=http://localhost:8787",
		`NEXT_PUBLIC_SITE_URL=http://localhost:${PORTS.marketing}`,
		`NEXT_PUBLIC_GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}`,
		"",
	].join("\n");

	const dashboardEnv = [
		"NEXTJS_ENV=development",
		"API_URL=http://localhost:8787",
		"NEXT_PUBLIC_API_URL=http://localhost:8787",
		`NEXT_PUBLIC_SITE_URL=http://localhost:${PORTS.dashboard}`,
		`NEXT_PUBLIC_MARKETING_URL=http://localhost:${PORTS.marketing}`,
		`NEXT_PUBLIC_GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}`,
		"",
	].join("\n");

	const mobileEnv = [
		"EXPO_PUBLIC_API_URL=http://localhost:8787",
		"EXPO_PUBLIC_AUTH_PROVIDER=redirect",
		"",
	].join("\n");

	const ownerEnv = mobileEnv;

	return { apiDevVars, marketingEnv, dashboardEnv, mobileEnv, ownerEnv };
}

/** Returns true when file content already matches local-dev expectations. */
export function isLocalDevEnv(key: string, content: string): boolean {
	if (key === "apiDevVars") {
		return (
			content.includes("ENVIRONMENT=development") &&
			content.includes("localhost:3000") &&
			!content.includes("api.talash.bd")
		);
	}
	if (key === "marketingEnv" || key === "dashboardEnv") {
		return (
			content.includes("NEXT_PUBLIC_API_URL=http://localhost:8787") &&
			!content.includes("NEXT_PUBLIC_API_URL=https://api.talash")
		);
	}
	if (key === "mobileEnv" || key === "ownerEnv") {
		return (
			content.includes("EXPO_PUBLIC_API_URL=http://localhost:8787") &&
			content.includes("EXPO_PUBLIC_AUTH_PROVIDER=redirect")
		);
	}
	return false;
}
