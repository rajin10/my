import { screen } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "./test-utils";

const useApp = vi.fn();
vi.mock("../context", () => ({ useApp: () => useApp() }));

const useKhataDues = vi.fn();
const useKhataCustomer = vi.fn();
const useVoidPayment = vi.fn();
vi.mock("../hooks/useOwnerData", () => ({
	useKhataDues: (b: string | null) => useKhataDues(b),
	useKhataCustomer: (u: string | null, b: string | null) =>
		useKhataCustomer(u, b),
	useVoidPayment: () => useVoidPayment(),
}));

import KhataScreen from "../components/screens/KhataScreen";

beforeEach(() => {
	useApp.mockReturnValue({
		businessId: "biz1",
		setOverlay: vi.fn(),
		setSheet: vi.fn(),
		flash: vi.fn(),
	});
	useKhataCustomer.mockReturnValue({
		data: undefined,
		isLoading: false,
		isError: false,
	});
	useVoidPayment.mockReturnValue({ mutate: vi.fn(), isPending: false });
});

describe("KhataScreen", () => {
	it("shows the empty state when no one owes", () => {
		useKhataDues.mockReturnValue({
			data: [],
			isLoading: false,
			isError: false,
		});
		renderWithClient(<KhataScreen />);
		expect(screen.getByText("No outstanding dues.")).toBeTruthy();
	});

	it("renders a debtor row with name and due", () => {
		useKhataDues.mockReturnValue({
			data: [{ userId: "u1", name: "Karim", due: 1500 }],
			isLoading: false,
			isError: false,
		});
		renderWithClient(<KhataScreen />);
		expect(screen.getByText("Karim")).toBeTruthy();
	});

	it("does not flash the empty state while loading", () => {
		useKhataDues.mockReturnValue({
			data: undefined,
			isLoading: true,
			isError: false,
		});
		renderWithClient(<KhataScreen />);
		expect(screen.queryByText("No outstanding dues.")).toBeNull();
	});
});
