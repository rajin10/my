import { screen } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "./test-utils";

const useApp = vi.fn();
vi.mock("../context", () => ({ useApp: () => useApp() }));

const useBranchOrders = vi.fn();
vi.mock("../hooks/useOwnerData", () => ({
	useBranchOrders: (ids: string[]) => useBranchOrders(ids),
}));

import OrdersScreen from "../components/screens/OrdersScreen";

beforeEach(() => {
	useApp.mockReturnValue({
		branch: "All branches",
		setBranch: vi.fn(),
		setOverlay: vi.fn(),
		setSheet: vi.fn(),
		business: { branches: ["Gulshan"] },
		apiBranches: [{ id: "b1", name: "Gulshan" }],
		products: [],
	});
});

describe("OrdersScreen", () => {
	it("shows the empty state when a branch has no orders", () => {
		useBranchOrders.mockReturnValue({
			data: [],
			isLoading: false,
			isError: false,
		});
		renderWithClient(<OrdersScreen />);
		expect(screen.getByText("No orders for this branch yet.")).toBeTruthy();
	});

	it("renders an order row with its status", () => {
		useBranchOrders.mockReturnValue({
			data: [
				{
					id: "o1",
					status: "Pending",
					total: 300,
					deliveryLine: "12 Road 5",
					createdAt: "2026-06-10T10:00:00Z",
				},
			],
			isLoading: false,
			isError: false,
		});
		renderWithClient(<OrdersScreen />);
		expect(screen.getByText("Pending")).toBeTruthy();
	});

	it("shows a spinner while orders are loading", () => {
		useBranchOrders.mockReturnValue({
			data: undefined,
			isLoading: true,
			isError: false,
		});
		renderWithClient(<OrdersScreen />);
		// empty-state text must NOT show while loading
		expect(screen.queryByText("No orders for this branch yet.")).toBeNull();
	});

	it("shows an error with retry when the orders query fails", () => {
		useBranchOrders.mockReturnValue({
			data: undefined,
			isLoading: false,
			isError: true,
			refetch: vi.fn(),
		});
		renderWithClient(<OrdersScreen />);
		expect(screen.getByText("Couldn't load orders.")).toBeTruthy();
		expect(screen.getByText("Retry")).toBeTruthy();
	});
});
