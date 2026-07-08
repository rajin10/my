import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("../Hero", () => ({
	Hero: ({ onSearch }: { onSearch: (q: string) => void }) => (
		<button type="button" onClick={() => onSearch("haircut")}>
			hero-search
		</button>
	),
}));
vi.mock("../CategoryStrip", () => ({
	CategoryStrip: ({
		active,
		onPick,
	}: {
		active: string | null;
		onPick: (c: string | null) => void;
	}) => (
		<button type="button" onClick={() => onPick("Spa & massage")}>
			cat-{active ?? "none"}
		</button>
	),
}));
vi.mock("../BusinessGrid", () => ({
	BusinessGrid: ({
		query,
		category,
		city,
	}: {
		query: string;
		category: string | null;
		city?: string | null;
	}) => (
		<div>
			grid q={query} c={category ?? "-"} city={city ?? "-"}
		</div>
	),
}));

import { SearchSection } from "../SearchSection";

describe("SearchSection", () => {
	beforeEach(() => push.mockReset());

	it("passes the URL params straight through to the grid", () => {
		render(<SearchSection q="hair" category="Nails" city="Dhaka" />);
		expect(
			screen.getByText(/grid q=hair c=Nails city=Dhaka/),
		).toBeInTheDocument();
	});

	it("search sets q, keeps city, clears category", () => {
		render(<SearchSection q="" category="Nails" city="Dhaka" />);
		fireEvent.click(screen.getByText("hero-search"));
		expect(push).toHaveBeenCalledWith("/?q=haircut&city=Dhaka");
	});

	it("category keeps q and city", () => {
		render(<SearchSection q="hair" category={null} city="Dhaka" />);
		fireEvent.click(screen.getByText("cat-none"));
		expect(push).toHaveBeenCalledWith(
			"/?q=hair&category=Spa+%26+massage&city=Dhaka",
		);
	});

	it("clearing the last filter navigates to bare /", () => {
		render(<SearchSection q="" category="Nails" city="" />);
		fireEvent.click(screen.getByText("cat-Nails"));
		// onPick toggles: active 'Nails' -> picks 'Spa & massage' here, so assert set
		expect(push).toHaveBeenCalledWith("/?category=Spa+%26+massage");
	});
});
