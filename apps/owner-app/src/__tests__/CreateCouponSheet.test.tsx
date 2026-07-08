import { fireEvent, render, screen } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createCoupon = vi.fn(() => Promise.resolve());

vi.mock("../context", () => ({
	useApp: () => ({ setSheet: vi.fn(), createCoupon }),
}));

// sheets.tsx is one module containing every sheet; importing it pulls the
// whole owner data/api/expo graph. Stub those boundaries so only the coupon
// sheet's real logic (and validateCoupon) loads.
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

import { CreateCouponSheet } from "../components/sheets";

beforeEach(() => createCoupon.mockClear());

// "Create coupon" appears twice (Sheet title + footer button); the button is
// the last match. Pressing a disabled button's label is a no-op (onPress unset).
const pressCreate = () =>
	// biome-ignore lint/style/noNonNullAssertion: at least two matches always exist
	fireEvent.press(screen.getAllByText("Create coupon").at(-1)!);

describe("CreateCouponSheet validation", () => {
	it("does not submit when no input has been entered", () => {
		render(<CreateCouponSheet />);
		pressCreate();
		expect(createCoupon).not.toHaveBeenCalled();
	});

	it("rejects a 0% percentage with an inline error and no submit", () => {
		render(<CreateCouponSheet />);
		fireEvent.changeText(screen.getByPlaceholderText("WELCOME20"), "SAVE");
		fireEvent.changeText(screen.getByPlaceholderText("20"), "0");

		expect(screen.getByText(/1 to 100/)).toBeTruthy();
		pressCreate();
		expect(createCoupon).not.toHaveBeenCalled();
	});

	it("rejects an above-100 percentage", () => {
		render(<CreateCouponSheet />);
		fireEvent.changeText(screen.getByPlaceholderText("WELCOME20"), "SAVE");
		fireEvent.changeText(screen.getByPlaceholderText("20"), "150");

		expect(screen.getByText(/1 to 100/)).toBeTruthy();
		pressCreate();
		expect(createCoupon).not.toHaveBeenCalled();
	});

	it("accepts a valid percentage, uppercases the code, and submits", () => {
		render(<CreateCouponSheet />);
		fireEvent.changeText(screen.getByPlaceholderText("WELCOME20"), "save20");
		fireEvent.changeText(screen.getByPlaceholderText("20"), "20");

		pressCreate();
		expect(createCoupon).toHaveBeenCalledWith(
			expect.objectContaining({
				code: "SAVE20",
				type: "Percentage",
				value: 20,
			}),
		);
	});

	it("disables the button and shows an error when max uses is 0", () => {
		render(<CreateCouponSheet />);
		fireEvent.changeText(screen.getByPlaceholderText("WELCOME20"), "SAVE");
		fireEvent.changeText(screen.getByPlaceholderText("20"), "20");
		fireEvent.changeText(screen.getByPlaceholderText("100"), "0");

		expect(screen.getByText(/at least 1/)).toBeTruthy();
		pressCreate();
		expect(createCoupon).not.toHaveBeenCalled();
	});
});
