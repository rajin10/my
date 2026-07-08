import type { Booking } from "@repo/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const list = vi.fn();
const cancel = vi.fn();
const create = vi.fn();
vi.mock("@/lib/api", () => ({
	api: {
		bookings: { list: () => list(), cancel: (id: string) => cancel(id) },
		reviews: { create: (body: unknown) => create(body) },
	},
}));
vi.mock("@/hooks/useAuth", () => ({
	useAuth: () => ({
		user: { id: "u1", email: null, name: "Sara", role: "user" },
	}),
}));

import { BookingsSection } from "../BookingsSection";

function booking(over: Partial<Booking>): Booking {
	return {
		id: "b",
		userId: "u1",
		serviceId: "s1",
		branchId: "br1",
		businessId: "v1",
		staffId: null,
		slot: "2027-01-01T10:00:00Z",
		status: "Confirmed",
		price: 100,
		discount: 0,
		couponCode: null,
		createdAt: "2026-01-01T00:00:00Z",
		updatedAt: null,
		...over,
	};
}

function renderSection() {
	const qc = new QueryClient();
	return render(
		<QueryClientProvider client={qc}>
			<BookingsSection />
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	list.mockReset();
	cancel.mockReset().mockResolvedValue({});
	create.mockReset().mockResolvedValue({});
});

describe("BookingsSection tabs", () => {
	it("splits bookings across Upcoming/Past and switching tabs changes the rows", async () => {
		list.mockResolvedValue({
			data: [
				booking({
					id: "future",
					status: "Confirmed",
					slot: "2027-01-01T10:00:00Z",
					price: 100,
				}),
				booking({
					id: "done",
					status: "Completed",
					slot: "2020-01-01T10:00:00Z",
					price: 200,
				}),
			],
		});
		renderSection();

		// Upcoming is the default tab: only the future/active booking shows.
		await waitFor(() => expect(screen.getByText(/৳100/)).toBeInTheDocument());
		expect(screen.queryByText(/৳200/)).not.toBeInTheDocument();

		// Switching to Past swaps the visible rows.
		await userEvent.click(screen.getByText("Past"));
		await waitFor(() => expect(screen.getByText(/৳200/)).toBeInTheDocument());
		expect(screen.queryByText(/৳100/)).not.toBeInTheDocument();
	});

	it("shows an empty-state message when a tab has no bookings", async () => {
		list.mockResolvedValue({ data: [] });
		renderSection();
		await waitFor(() =>
			expect(
				screen.getByText("You have no upcoming bookings."),
			).toBeInTheDocument(),
		);
	});
});

describe("BookingsSection cancel", () => {
	it("shows Cancel for active bookings and calls api.bookings.cancel", async () => {
		list.mockResolvedValue({
			data: [
				booking({ id: "future", status: "Confirmed", price: 100 }),
				booking({
					id: "done",
					status: "Completed",
					slot: "2020-01-01T10:00:00Z",
					price: 200,
				}),
			],
		});
		renderSection();

		const cancelBtn = await screen.findByRole("button", { name: "Cancel" });
		await userEvent.click(cancelBtn);
		await waitFor(() => expect(cancel).toHaveBeenCalledWith("future"));
	});

	it("does not show Cancel for terminal bookings", async () => {
		list.mockResolvedValue({
			data: [
				booking({
					id: "done",
					status: "Completed",
					slot: "2020-01-01T10:00:00Z",
					price: 200,
				}),
			],
		});
		renderSection();

		// Completed booking lives in Past; no Cancel button anywhere.
		await userEvent.click(await screen.findByText("Past"));
		await waitFor(() => expect(screen.getByText(/৳200/)).toBeInTheDocument());
		expect(
			screen.queryByRole("button", { name: "Cancel" }),
		).not.toBeInTheDocument();
	});
});

describe("BookingsSection review", () => {
	it("offers a review CTA for Completed bookings and submits via api.reviews.create", async () => {
		list.mockResolvedValue({
			data: [
				booking({
					id: "b-done",
					status: "Completed",
					businessId: "v9",
					serviceId: "s9",
					slot: "2020-01-01T10:00:00Z",
					price: 200,
				}),
			],
		});
		const user = userEvent.setup();
		renderSection();

		// Completed bookings sit in the Past tab.
		await user.click(await screen.findByText("Past"));
		await user.click(
			await screen.findByRole("button", { name: /Leave a review/i }),
		);

		// Pick 4 stars (the rating buttons are the lucide Star icons).
		const stars = screen
			.getAllByRole("button")
			.filter((b) => b.querySelector("svg.lucide-star"));
		expect(stars).toHaveLength(5);
		await user.click(stars[3]);

		await user.type(
			screen.getByPlaceholderText(/Tell us about your visit/i),
			"Lovely visit",
		);
		await user.click(screen.getByRole("button", { name: "Submit review" }));

		await waitFor(() =>
			expect(create).toHaveBeenCalledWith({
				businessId: "v9",
				serviceId: "s9",
				bookingId: "b-done",
				rating: 4,
				text: "Lovely visit",
			}),
		);
	});
});
