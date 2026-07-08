import type { MyReview } from "@repo/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listMine = vi.fn();
vi.mock("@/lib/api", () => ({
	api: { reviews: { listMine: () => listMine() } },
}));
vi.mock("@/hooks/useAuth", () => ({
	useAuth: () => ({
		user: { id: "u1", email: null, name: "Sara", role: "user" },
	}),
}));

import { ReviewsSection } from "../ReviewsSection";

function review(over: Partial<MyReview>): MyReview {
	return {
		id: "r1",
		userId: "u1",
		businessId: "v1",
		serviceId: "s1",
		bookingId: "b1",
		rating: 5,
		text: "Loved it",
		status: "Published",
		businessName: "Glow Spa",
		serviceName: "Facial",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: null,
		...over,
	};
}

function renderSection() {
	const qc = new QueryClient();
	return render(
		<QueryClientProvider client={qc}>
			<ReviewsSection />
		</QueryClientProvider>,
	);
}

beforeEach(() => listMine.mockReset());

describe("ReviewsSection", () => {
	it("renders the business name, text, and an Awaiting-approval badge for pending reviews", async () => {
		listMine.mockResolvedValue([
			review({
				id: "r-pending",
				status: "Pending",
				businessName: "Glow Spa",
				text: "Nice",
			}),
		]);
		renderSection();
		await waitFor(() =>
			expect(screen.getByText("Glow Spa")).toBeInTheDocument(),
		);
		expect(screen.getByText("Nice")).toBeInTheDocument();
		expect(screen.getByText(/Awaiting approval/i)).toBeInTheDocument();
	});

	it("renders nothing when the user has no reviews", async () => {
		listMine.mockResolvedValue([]);
		const { container } = renderSection();
		await waitFor(() => expect(listMine).toHaveBeenCalled());
		expect(container.querySelector("h2")).toBeNull();
	});
});
