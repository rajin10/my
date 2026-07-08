import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The hydration contract: when the server has prefetched ["business", id] into
// the dehydrated cache, the client must render from it WITHOUT re-fetching.
// This guards the key match between the factory and the seeded entry.
const get = vi.fn();
vi.mock("@/lib/api", () => ({
	api: { businesses: { get: (id: string) => get(id) } },
}));
vi.mock("@/components/BrandThemeBoundary", () => ({
	BrandThemeBoundary: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
}));
vi.mock("../businessExperiences", () => ({
	customerBusinessExperience: {
		booking: () => <div>booking-experience</div>,
		commerce: () => <div>commerce-experience</div>,
	},
}));

import { BusinessClient } from "../BusinessClient";

function renderSeeded(seed: unknown) {
	const qc = new QueryClient();
	qc.setQueryData(["business", "v1"], seed);
	return render(
		<QueryClientProvider client={qc}>
			<BusinessClient id="v1" />
		</QueryClientProvider>,
	);
}

describe("BusinessClient hydration", () => {
	it("renders from a pre-seeded business cache without re-fetching", () => {
		renderSeeded({
			data: { id: "v1", vertical: "booking", brandPalette: null },
		});
		expect(get).not.toHaveBeenCalled();
		expect(screen.getByText("booking-experience")).toBeInTheDocument();
	});

	it("selects the experience by the seeded vertical", () => {
		renderSeeded({
			data: { id: "v1", vertical: "commerce", brandPalette: null },
		});
		expect(screen.getByText("commerce-experience")).toBeInTheDocument();
	});
});
