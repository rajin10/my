import { ColorSchemeProvider } from "@repo/ui";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

function renderNav() {
	return render(
		<ColorSchemeProvider>
			<Nav />
		</ColorSchemeProvider>,
	);
}

const useAuthMock = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => useAuthMock() }));
vi.mock("@/hooks/useNotifications", () => ({
	useNotifications: () => ({ data: [] }),
	useMarkNotificationRead: () => ({ mutate: vi.fn() }),
	useMarkAllNotificationsRead: () => ({ mutate: vi.fn() }),
}));

import { Nav } from "../Nav";

beforeEach(() => useAuthMock.mockReset());

describe("Nav auth slot", () => {
	it("renders neither Sign in nor Profile while status is unknown", () => {
		useAuthMock.mockReturnValue({
			user: null,
			status: "unknown",
			signOut: vi.fn(),
		});
		renderNav();
		expect(screen.queryByText("Sign in")).toBeNull();
		expect(screen.queryByText("Sign out")).toBeNull();
	});

	it("renders Sign in when unauthenticated", () => {
		useAuthMock.mockReturnValue({
			user: null,
			status: "unauthenticated",
			signOut: vi.fn(),
		});
		renderNav();
		expect(screen.getAllByText("Sign in").length).toBeGreaterThan(0);
	});

	it("renders the profile name when authenticated", () => {
		useAuthMock.mockReturnValue({
			user: { id: "u1", email: null, name: "Sara Khan", role: "user" },
			status: "authenticated",
			signOut: vi.fn(),
		});
		renderNav();
		expect(screen.getByText("Sara")).toBeInTheDocument();
	});
});
