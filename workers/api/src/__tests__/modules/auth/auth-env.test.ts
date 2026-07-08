import { describe, expect, it } from "vitest";
import { InternalError } from "../../../core/errors";
import { assertAuthSecrets } from "../../../modules/auth/auth-env";

describe("assertAuthSecrets", () => {
	it("throws InternalError when JWT_SECRET is missing", () => {
		expect(() => assertAuthSecrets({ GOOGLE_CLIENT_SECRET: "secret" })).toThrow(
			InternalError,
		);
	});

	it("throws InternalError when GOOGLE_CLIENT_SECRET is missing", () => {
		expect(() => assertAuthSecrets({ JWT_SECRET: "secret" })).toThrow(
			InternalError,
		);
	});

	it("passes when both secrets are set", () => {
		expect(() =>
			assertAuthSecrets({
				JWT_SECRET: "jwt-secret",
				GOOGLE_CLIENT_SECRET: "google-secret",
			}),
		).not.toThrow();
	});
});
