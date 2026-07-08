import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { reactNative } from "vitest-native";

export default defineConfig({
	// reactNative() transforms/mocks the React Native module graph so component
	// tests (RNTL) can render under vitest. Pure-logic tests are unaffected —
	// they never import react-native.
	plugins: [reactNative()],
	resolve: {
		// Mirror tsconfig's "@/*" → "src/*" so component imports resolve. The
		// global.css this pulls in is a Tailwind/NativeWind directive file and is a
		// no-op under vitest's default CSS handling.
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	test: {
		globals: true,
		setupFiles: ["./src/__tests__/setup.ts"],
	},
});
