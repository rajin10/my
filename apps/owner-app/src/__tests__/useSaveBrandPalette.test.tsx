import type { BrandPalette } from "@repo/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useSaveBrandPalette } from "../hooks/useOwnerData";

const update = vi.fn();
vi.mock("../lib/api", () => ({
	api: { businesses: { update: (...a: unknown[]) => update(...a) } },
}));

const PALETTE: BrandPalette = {
	primary: "#5B2A86",
	accent: "#C9A063",
	foreground: "#1A1320",
	surface: "#FDFBFF",
};

function setup() {
	const client = new QueryClient({
		defaultOptions: { mutations: { retry: false } },
	});
	const invalidate = vi.spyOn(client, "invalidateQueries");
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
	return { wrapper, invalidate };
}

describe("useSaveBrandPalette", () => {
	it("saves the palette via businesses.update and refreshes the owner business", async () => {
		update.mockResolvedValue({ data: { id: "biz_1" } });
		const { wrapper, invalidate } = setup();
		const { result } = renderHook(() => useSaveBrandPalette("biz_1"), {
			wrapper,
		});

		await result.current.mutateAsync(PALETTE);

		expect(update).toHaveBeenCalledWith("biz_1", { brandPalette: PALETTE });
		await waitFor(() =>
			expect(invalidate).toHaveBeenCalledWith({
				queryKey: ["business", "owner"],
			}),
		);
	});

	it("sends null to revert to Talash defaults", async () => {
		update.mockResolvedValue({ data: { id: "biz_1" } });
		const { wrapper } = setup();
		const { result } = renderHook(() => useSaveBrandPalette("biz_1"), {
			wrapper,
		});

		await result.current.mutateAsync(null);

		expect(update).toHaveBeenCalledWith("biz_1", { brandPalette: null });
	});
});
