import type { User } from "@repo/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
const update = vi.fn();
const uploadPhoto = vi.fn();
vi.mock("@/lib/api", () => ({
	api: {
		users: {
			get: (id: string) => get(id),
			update: (id: string, body: unknown) => update(id, body),
			uploadPhoto: (id: string, fd: unknown) => uploadPhoto(id, fd),
			delete: vi.fn(),
		},
		auth: { logout: vi.fn() },
	},
}));
vi.mock("@/hooks/useAuth", () => ({
	useAuth: () => ({
		user: {
			id: "u1",
			email: "sara@example.com",
			name: "Sara Khan",
			role: "user",
			authMethods: { password: true, google: false },
		},
		signOut: vi.fn(),
	}),
}));
vi.mock("@repo/ui", () => ({
	DeleteAccountModal: () => null,
}));
vi.mock("@/components/GoogleReauthLogin", () => ({
	GoogleReauthLogin: () => null,
}));

import { ProfileCard } from "../ProfileCard";

const FULL: User = {
	id: "u1",
	email: "sara@example.com",
	phone: "01700000000",
	name: "Sara Khan",
	role: "user",
	googleId: null,
	photoUrl: null,
	createdAt: "2026-01-15T00:00:00Z",
	updatedAt: null,
};

function renderCard() {
	const qc = new QueryClient();
	return render(
		<QueryClientProvider client={qc}>
			<ProfileCard />
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	get.mockReset();
	update.mockReset();
});

describe("ProfileCard", () => {
	it("shows the phone and member-since from the full user record", async () => {
		get.mockResolvedValue({ data: FULL });
		renderCard();
		await waitFor(() =>
			expect(screen.getByText("01700000000")).toBeInTheDocument(),
		);
		await waitFor(() =>
			expect(screen.getByText(/Member since/i)).toBeInTheDocument(),
		);
	});

	it("prompts to add a phone when none is set", async () => {
		get.mockResolvedValue({ data: { ...FULL, phone: null } });
		renderCard();
		await waitFor(() =>
			expect(screen.getByText(/Add phone/i)).toBeInTheDocument(),
		);
	});

	it("renders the avatar image when photoUrl is set", async () => {
		get.mockResolvedValue({
			data: { ...FULL, photoUrl: "https://storage.test/users/u1/a.png" },
		});
		renderCard();
		await waitFor(() =>
			expect(screen.getByRole("img", { name: /sara khan/i })).toHaveAttribute(
				"src",
				"https://storage.test/users/u1/a.png",
			),
		);
	});
});
