import { fireEvent, screen } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "./test-utils";

const useApp = vi.fn();
vi.mock("../context", () => ({ useApp: () => useApp() }));

const mutate = vi.fn();
vi.mock("../hooks/useOwnerData", () => ({
	useRecordPayment: () => ({ mutate, isPending: false }),
}));
vi.mock("../lib/api", () => ({ api: {} }));
vi.mock("expo-image-picker", () => ({}));

import { RecordPaymentSheet } from "../components/sheets";

beforeEach(() => {
	mutate.mockReset();
	useApp.mockReturnValue({ setSheet: vi.fn(), flash: vi.fn() });
});

describe("RecordPaymentSheet", () => {
	it("prefills the amount with the current due and records it on submit", () => {
		renderWithClient(
			<RecordPaymentSheet
				businessId="biz1"
				userId="u1"
				customerName="Karim"
				due={1500}
			/>,
		);
		expect(screen.getByDisplayValue("1500")).toBeTruthy();
		fireEvent.press(screen.getByText("Record payment"));
		expect(mutate).toHaveBeenCalledWith(
			expect.objectContaining({
				businessId: "biz1",
				userId: "u1",
				amount: 1500,
			}),
			expect.anything(),
		);
	});

	it("does not submit when the amount is cleared", () => {
		renderWithClient(
			<RecordPaymentSheet
				businessId="biz1"
				userId="u1"
				customerName="Karim"
				due={1500}
			/>,
		);
		fireEvent.changeText(screen.getByDisplayValue("1500"), "");
		fireEvent.press(screen.getByText("Record payment"));
		expect(mutate).not.toHaveBeenCalled();
	});

	it("records the edited (partial) amount, not the prefilled due", () => {
		renderWithClient(
			<RecordPaymentSheet
				businessId="biz1"
				userId="u1"
				customerName="Karim"
				due={1500}
			/>,
		);
		fireEvent.changeText(screen.getByDisplayValue("1500"), "800");
		fireEvent.press(screen.getByText("Record payment"));
		expect(mutate).toHaveBeenCalledWith(
			expect.objectContaining({
				businessId: "biz1",
				userId: "u1",
				amount: 800,
			}),
			expect.anything(),
		);
	});
});
