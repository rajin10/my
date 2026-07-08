import { fireEvent, screen } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "./test-utils";

const useApp = vi.fn();
vi.mock("../context", () => ({ useApp: () => useApp() }));

// sheets.tsx is one module pulling the whole owner data/api/expo graph; stub
// those boundaries so only the sheet components under test load.
vi.mock("../lib/api", () => ({ api: {} }));
vi.mock("expo-image-picker", () => ({}));

const useOrder = vi.fn();
const mutate = vi.fn();
vi.mock("../hooks/useOwnerData", () => ({
	useOrder: (id: string) => useOrder(id),
	useUpdateOrderStatus: () => ({ mutate, isPending: false }),
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

import { OrderDetailSheet } from "../components/sheets";

function mockOrder(status: string) {
	useOrder.mockReturnValue({
		data: {
			id: "o1",
			status,
			total: 300,
			deliveryLine: "12 Road 5",
			deliveryArea: "Gulshan",
			deliveryCity: "Dhaka",
			createdAt: "2026-06-10T10:00:00Z",
			items: [{ id: "i1", productId: "p1", quantity: 2, unitPrice: 150 }],
		},
		isLoading: false,
		isError: false,
	});
}

beforeEach(() => {
	mutate.mockReset();
	useApp.mockReturnValue({
		setSheet: vi.fn(),
		flash: vi.fn(),
		products: [{ id: "p1", name: "Hair Oil" }],
	});
});

describe("OrderDetailSheet", () => {
	it("shows the guided 'Confirm order' action for a Pending order, plus Cancel", () => {
		mockOrder("Pending");
		renderWithClient(<OrderDetailSheet orderId="o1" />);
		expect(screen.getByText("Confirm order")).toBeTruthy();
		expect(screen.getByText("Cancel order")).toBeTruthy();
	});

	it("shows 'Mark delivered' and no Cancel for an OutForDelivery order", () => {
		mockOrder("OutForDelivery");
		renderWithClient(<OrderDetailSheet orderId="o1" />);
		expect(screen.getByText("Mark delivered")).toBeTruthy();
		expect(screen.queryByText("Cancel order")).toBeNull();
	});

	it("renders no actions for a Delivered (terminal) order", () => {
		mockOrder("Delivered");
		renderWithClient(<OrderDetailSheet orderId="o1" />);
		expect(screen.queryByText("Mark delivered")).toBeNull();
		expect(screen.queryByText("Cancel order")).toBeNull();
	});

	it("advances to the next status on press", () => {
		mockOrder("Pending");
		renderWithClient(<OrderDetailSheet orderId="o1" />);
		fireEvent.press(screen.getByText("Confirm order"));
		expect(mutate).toHaveBeenCalledWith(
			{ id: "o1", status: "Confirmed" },
			expect.anything(),
		);
	});
});
