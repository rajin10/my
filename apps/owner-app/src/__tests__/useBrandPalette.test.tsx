import type { BrandPalette, Business } from "@repo/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useBrandPalette } from "../hooks/useOwnerData";

// The hook never runs its queryFn (it reads the cache that context populates),
// but importing the module pulls in the api client — stub it out.
vi.mock("../lib/api", () => ({
	api: { businesses: { list: vi.fn() } },
}));

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

describe("useBrandPalette", () => {
	it("returns null when no business is cached", () => {
		const { result } = renderHook(() => useBrandPalette(), {
			wrapper: wrapperSeededWith(undefined),
		});
		expect(result.current).toBeNull();
	});

	it("returns the business brand palette when one is set", () => {
		const { result } = renderHook(() => useBrandPalette(), {
			wrapper: wrapperSeededWith(businessWith(PALETTE)),
		});
		expect(result.current).toEqual(PALETTE);
	});

	it("returns null when the business has no palette (Talash-default fallback)", () => {
		const { result } = renderHook(() => useBrandPalette(), {
			wrapper: wrapperSeededWith(businessWith(null)),
		});
		expect(result.current).toBeNull();
	});
});
