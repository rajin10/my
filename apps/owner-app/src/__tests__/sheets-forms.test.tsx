import { fireEvent, render, screen } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Service } from "../data";

const useApp = vi.fn();
vi.mock("../context", () => ({ useApp: () => useApp() }));

// sheets.tsx is one module pulling the whole owner data/api/expo graph; stub
// those boundaries so only the sheet components under test load.
vi.mock("../lib/api", () => ({ api: {} }));
vi.mock("expo-image-picker", () => ({}));
vi.mock("../hooks/useOwnerData", () => ({
	useBranchHours: () => ({ data: undefined, isLoading: false, isError: false }),
	useStaffAvailability: () => ({
		data: undefined,
		isLoading: false,
		isError: false,
	}),
	useUpdateBranch: () => ({ mutate: vi.fn(), isPending: false }),
	useUpsertBranchHours: () => ({ mutate: vi.fn(), isPending: false }),
	useUpsertStaffAvailability: () => ({ mutate: vi.fn(), isPending: false }),
	useUserSearch: () => ({ data: undefined, isLoading: false }),
}));

import { AddBranchSheet, AddServiceSheet } from "../components/sheets";

const business = { branches: ["Gulshan", "Banani"] };

const service: Service = {
	id: "s1",
	name: "Haircut",
	branch: "Gulshan",
	category: "Hair",
	duration: 60,
	price: 500,
};

beforeEach(() => useApp.mockReset());

describe("AddServiceSheet branch picker (#1)", () => {
	it("shows a Branch picker when adding a service", () => {
		useApp.mockReturnValue({
			setSheet: vi.fn(),
			addService: vi.fn(() => Promise.resolve()),
			updateService: vi.fn(() => Promise.resolve()),
			business,
		});
		render(<AddServiceSheet />);
		expect(screen.getByText("Branch")).toBeTruthy();
		expect(screen.getByText("Category")).toBeTruthy();
	});

	it("hides the Branch picker when editing (a service's branch is fixed)", () => {
		useApp.mockReturnValue({
			setSheet: vi.fn(),
			addService: vi.fn(() => Promise.resolve()),
			updateService: vi.fn(() => Promise.resolve()),
			business,
		});
		render(<AddServiceSheet initial={service} />);
		expect(screen.queryByText("Branch")).toBeNull();
		// other fields still render
		expect(screen.getByText("Category")).toBeTruthy();
	});
});

describe("double-submit guard (#4)", () => {
	it("AddServiceSheet calls addService once on a rapid double-press", () => {
		// A never-resolving promise keeps the sheet's `submitting` flag set.
		const addService = vi.fn(() => new Promise<void>(() => {}));
		useApp.mockReturnValue({
			setSheet: vi.fn(),
			addService,
			updateService: vi.fn(),
			business,
		});
		render(<AddServiceSheet />);
		fireEvent.changeText(
			screen.getByPlaceholderText("e.g. Signature Hammam Ritual"),
			"Deep tissue massage",
		);
		fireEvent.changeText(screen.getByPlaceholderText("2400"), "1500");

		// "Add service" is both the sheet title and the button; the button is last.
		// biome-ignore lint/style/noNonNullAssertion: title + button always match
		const button = screen.getAllByText("Add service").at(-1)!;
		fireEvent.press(button);
		fireEvent.press(button);

		expect(addService).toHaveBeenCalledTimes(1);
	});

	it("AddBranchSheet calls addBranchToBusiness once on a rapid double-press", () => {
		const addBranchToBusiness = vi.fn(() => new Promise<void>(() => {}));
		useApp.mockReturnValue({ setSheet: vi.fn(), addBranchToBusiness });
		render(<AddBranchSheet />);
		fireEvent.changeText(
			screen.getByPlaceholderText("e.g. Powai"),
			"Dhanmondi",
		);

		const button = screen.getByText("Add branch");
		fireEvent.press(button);
		fireEvent.press(button);

		expect(addBranchToBusiness).toHaveBeenCalledTimes(1);
	});
});
