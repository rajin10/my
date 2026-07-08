interface CloudflareBindings {
	// Vars
	ENVIRONMENT: "development" | "test" | "staging" | "production" | (string & {});
	JWT_SECRET: string;
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET?: string;
	ALLOWED_ORIGINS: string;
	ALLOWED_RESET_URIS?: string;
	EMAIL_FROM?: string;
	PUBLIC_R2_URL: string;

	// Optional bindings
	TALASH_EMAIL?: { send: (message: { from: string; to: string; subject: string; text: string }) => Promise<unknown> };

	// Bindings
	TALASH_DB: D1Database;
	TALASH_KV: KVNamespace;
	TALASH_STORAGE: R2Bucket;
}

