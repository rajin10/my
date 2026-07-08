import { fireEvent, screen } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Business } from "../data";
import { renderWithClient } from "./test-utils";

const toggleStatus = vi.fn();
const useApp = vi.fn();
vi.mock("../context", () => ({ useApp: () => useApp() }));
vi.mock("expo-router", () => ({
	useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));
// expo-haptics pulls expo-modules-core's native EventEmitter; only used in
// booking-card handlers (not rendered here), so an empty stub is enough.
vi.mock("expo-haptics", () => ({}));

import TodayScreen from "../components/screens/TodayScreen";

const business: Business = {
	name: "Glow Studio",
	category: "Salon",
	city: "Dhaka",
	status: "Active",
	vertical: "booking",
	rating: 4.5,
	reviews: 10,
	description: "",
	branches: ["Gulshan"],
	photos: [],
	owner: { name: "Owner", role: "Owner", email: "o@x.com" },
};

const ctx = (status: Business["status"]) => ({
	// AppHeader
	greeting: "Good morning",
	business: { ...business, status },
	status,
	toggleStatus,
	setOverlay: vi.fn(),
	hasUnread: false,
	// TodayScreen body (no bookings → BookingCard never renders)
	bookings: [],
	branch: "All branches",
	setBranch: vi.fn(),
	pendingReviews: 0,
	setTab: vi.fn(),
	setSheet: vi.fn(),
});

beforeEach(() => {
	toggleStatus.mockReset();
	useApp.mockReset();
});

describe("TodayScreen status toggle (#5)", () => {
	it("toggles an Active business when tapped", () => {
		useApp.mockReturnValue(ctx("Active"));
		renderWithClient(<TodayScreen />);
		fireEvent.press(screen.getByText("Live · accepting bookings"));
		expect(toggleStatus).toHaveBeenCalledTimes(1);
	});

	it("shows a non-interactive Suspended state and does not toggle", () => {
		useApp.mockReturnValue(ctx("Suspended"));
		renderWithClient(<TodayScreen />);

		expect(screen.getByText("Suspended · hidden from customers")).toBeTruthy();
		expect(screen.getByText("Managed by Talash")).toBeTruthy();

		fireEvent.press(screen.getByText("Suspended · hidden from customers"));
		expect(toggleStatus).not.toHaveBeenCalled();
	});
});
