import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		globals: true,
		// Only the pure `cn` util is unit-tested here. The React Native
		// component (Surface) is verified end-to-end by typecheck + a real
		// Expo app build, not by node-env vitest (which can't resolve the
		// `react-native` runtime).
		include: ["src/**/*.test.ts"],
	},
});
