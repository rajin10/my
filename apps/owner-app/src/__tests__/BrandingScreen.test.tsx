import { fireEvent, render, screen } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Capture the themed preview boundary's value to prove edits flow into the preview.
const { boundaryValues } = vi.hoisted(() => ({
	boundaryValues: [] as Array<Record<string, string>>,
}));
vi.mock("nativewind", () => ({
	VariableContextProvider: ({
		value,
		children,
	}: {
		value: Record<string, string>;
		children: unknown;
	}) => {
		boundaryValues.push(value);
		return children;
	},
}));

// The colour picker pulls reanimated/gesture-handler native code vitest can't load.
// Stub it: each picker is a button keyed by its current hex; pressing it emits a
// fixed new colour via onComplete, simulating the owner choosing a colour.
const NEW_HEX = "#abcdef";
vi.mock("reanimated-color-picker", () => {
	const { Pressable, Text } = require("react-native");
	return {
		default: ({
			value,
			onComplete,
			children,
		}: {
			value: string;
			onComplete: (c: { hex: string }) => void;
			children?: unknown;
		}) => (
			<Pressable
				testID={`picker-${value}`}
				onPress={() => onComplete({ hex: NEW_HEX })}
			>
				<Text>{value}</Text>
				{children}
			</Pressable>
		),
		HueCircular: ({ children }: { children?: unknown }) => children ?? null,
		BrightnessSlider: () => null,
	};
});

vi.mock("expo-router", () => ({
	useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));
vi.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const save = vi.fn();
const flash = vi.fn();
let savedPalette: import("@repo/api-client").BrandPalette | null = null;
vi.mock("../hooks/useOwnerData", () => ({
	useBrandPalette: () => savedPalette,
	useSaveBrandPalette: () => ({ mutate: save, isPending: false }),
}));
vi.mock("../context", () => ({
	useApp: () => ({ businessId: "biz_1", flash }),
}));

import { BrandingScreen } from "../components/screens/BrandingScreen";
import { paletteToVars } from "../lib/theme-vars";

beforeEach(() => {
	boundaryValues.length = 0;
	save.mockClear();
	flash.mockClear();
	savedPalette = null;
});

describe("BrandingScreen", () => {
	it("previews the Talash default seeds when no palette is saved", () => {
		render(<BrandingScreen />);
		expect(boundaryValues.at(-1)).toEqual(
			paletteToVars({
				primary: "#0e7c66",
				accent: "#c9a063",
				foreground: "#14201c",
				surface: "#ffffff",
			}),
		);
	});

	it("repaints the preview when the owner changes a colour", () => {
		render(<BrandingScreen />);
		fireEvent.press(screen.getByTestId("picker-#0e7c66")); // the primary role
		expect(boundaryValues.at(-1)).toEqual(
			paletteToVars({
				primary: NEW_HEX,
				accent: "#c9a063",
				foreground: "#14201c",
				surface: "#ffffff",
			}),
		);
	});

	it("saves the edited palette (all four seeds) via the API", () => {
		render(<BrandingScreen />);
		fireEvent.press(screen.getByTestId("picker-#0e7c66")); // edit primary
		fireEvent.press(screen.getByText("Save brand"));
		expect(save).toHaveBeenCalledWith(
			{
				primary: NEW_HEX,
				accent: "#c9a063",
				foreground: "#14201c",
				surface: "#ffffff",
			},
			expect.objectContaining({
				onSuccess: expect.any(Function),
				onError: expect.any(Function),
			}),
		);
	});

	it("flashes the server's contrast-rejection message on save failure (#59)", () => {
		save.mockImplementation((_palette, opts) => {
			opts?.onError?.(new Error("Palette fails WCAG AA contrast: …"));
		});
		render(<BrandingScreen />);
		fireEvent.press(screen.getByTestId("picker-#0e7c66"));
		fireEvent.press(screen.getByText("Save brand"));
		expect(flash).toHaveBeenCalledWith(
			expect.stringContaining("WCAG AA contrast"),
			expect.objectContaining({ tone: "danger" }),
		);
	});

	it("reverts to Talash defaults by saving null", () => {
		savedPalette = {
			primary: "#5B2A86",
			accent: "#C9A063",
			foreground: "#1A1320",
			surface: "#FDFBFF",
		};
		render(<BrandingScreen />);
		fireEvent.press(screen.getByText("Reset to Talash default"));
		expect(save).toHaveBeenCalledWith(null, expect.any(Object));
	});
});
