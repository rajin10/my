import type { BrandPalette, Business } from "@repo/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Text } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

// NativeWind's real module pulls the untransformed react-native-css/RN native
// graph, which vitest can't load (same reason setup.ts stubs lucide/svg). The
// var-cascade is native-only and unobservable under vitest anyway, so stub the
// boundary — but capture its `value` so we can assert the mapped custom
// properties actually reach it (the chain cache → hook → paletteToVars).
const { boundaryValues } = vi.hoisted(() => ({
	boundaryValues: [] as Array<Record<string, string> | undefined>,
}));
vi.mock("nativewind", () => ({
	VariableContextProvider: ({
		value,
		children,
	}: {
		value: Record<string, string>;
		children: ReactNode;
	}) => {
		boundaryValues.push(value);
		return children;
	},
}));

import { ThemeBoundary, ThemeProvider } from "../components/ThemeProvider";
import { paletteToVars } from "../lib/theme-vars";

const PALETTE: BrandPalette = {
	primary: "#5B2A86",
	accent: "#C9A063",
	foreground: "#1A1320",
	surface: "#FDFBFF",
};

function businessWith(brandPalette: BrandPalette | null): Business {
	return {
		id: "biz_1",
		name: "Glow Spa",
		category: "Spa",
		city: "Dhaka",
		vertical: "booking",
		status: "Active",
		description: null,
		phone: null,
		email: null,
		website: null,
		brandPalette,
		ownerId: "usr_1",
		createdAt: "2026-01-01T00:00:00Z",
		updatedAt: null,
	};
}

function wrapperSeededWith(business: Business | null | undefined) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	if (business !== undefined) {
		client.setQueryData(["business", "owner"], business);
	}
	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
}

beforeEach(() => {
	boundaryValues.length = 0;
});

describe("ThemeProvider", () => {
	it("renders its children when no palette is set (Talash defaults)", () => {
		render(
			<ThemeProvider palette={null}>
				<Text>owner-home</Text>
			</ThemeProvider>,
		);
		expect(screen.getByText("owner-home")).toBeTruthy();
		expect(boundaryValues).toHaveLength(0); // no boundary when unthemed
	});

	it("scopes the mapped custom properties when a palette is set", () => {
		render(
			<ThemeProvider palette={PALETTE}>
				<Text>owner-home</Text>
			</ThemeProvider>,
		);
		expect(screen.getByText("owner-home")).toBeTruthy();
		// The boundary must receive exactly what paletteToVars maps (now incl. the
		// derived brand ramp, #97) — this test proves the chain reaches the boundary.
		expect(boundaryValues).toEqual([paletteToVars(PALETTE)]);
	});
});

describe("ThemeBoundary", () => {
	it("applies the cached business palette to the boundary", () => {
		render(
			<ThemeBoundary>
				<Text>owner-home</Text>
			</ThemeBoundary>,
			{ wrapper: wrapperSeededWith(businessWith(PALETTE)) },
		);
		expect(screen.getByText("owner-home")).toBeTruthy();
		// The boundary must receive exactly what paletteToVars maps (now incl. the
		// derived brand ramp, #97) — this test proves the chain reaches the boundary.
		expect(boundaryValues).toEqual([paletteToVars(PALETTE)]);
	});

	it("falls back to Talash defaults when the business has no palette", () => {
		render(
			<ThemeBoundary>
				<Text>owner-home</Text>
			</ThemeBoundary>,
			{ wrapper: wrapperSeededWith(businessWith(null)) },
		);
		expect(screen.getByText("owner-home")).toBeTruthy();
		expect(boundaryValues).toHaveLength(0); // no override → defaults
	});
});
