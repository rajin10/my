import { Surface } from "@repo/ui-native";
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { describe, expect, it } from "vitest";

// Smoke test for @repo/ui-native (issue #62): proves the shared package's one
// component threads end-to-end — package → @repo/tokens → app import → render.
// Not adoption (#64): no screen uses Surface yet; this just confirms the wire.
describe("@repo/ui-native Surface", () => {
	it("renders from the shared package with its children", () => {
		render(
			<Surface testID="surface" elevation="sm">
				<Text>hello</Text>
			</Surface>,
		);
		expect(screen.getByTestId("surface")).toBeTruthy();
		expect(screen.getByText("hello")).toBeTruthy();
	});
});
