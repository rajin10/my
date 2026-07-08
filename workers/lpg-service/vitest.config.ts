import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		globals: true,
		setupFiles: ["./src/__tests__/setup.ts"],
	},
	resolve: {
		alias: {
			"cloudflare:workers": path.resolve(
				"./src/__tests__/mocks/cloudflare-workers.ts",
			),
		},
	},
});
