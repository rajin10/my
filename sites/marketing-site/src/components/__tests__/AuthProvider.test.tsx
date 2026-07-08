import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/stores/auth-store";

const bootstrapAuthSession = vi.fn();

vi.mock("@/lib/auth-bootstrap", () => ({
	bootstrapAuthSession: () => bootstrapAuthSession(),
}));

// Import after the mock is registered.
import { AuthProvider } from "../AuthProvider";

function renderProvider() {
	const qc = new QueryClient();
	return render(
		<QueryClientProvider client={qc}>
			<AuthProvider>
				<div>child</div>
			</AuthProvider>
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	localStorage.clear();
	useAuthStore.setState({ user: null, status: "unknown" });
	bootstrapAuthSession.mockReset();
});

describe("AuthProvider bootstrap", () => {
	it("calls bootstrapAuthSession on mount", async () => {
		bootstrapAuthSession.mockResolvedValue(undefined);
		renderProvider();
		await waitFor(() => expect(bootstrapAuthSession).toHaveBeenCalledTimes(1));
	});
});

describe("AuthProvider logout cache purge", () => {
	it("clears the query cache when the session transitions to unauthenticated", async () => {
		bootstrapAuthSession.mockImplementation(async () => {
			useAuthStore.getState().setUser({
				id: "u1",
				email: null,
				name: "Sara",
				role: "user",
			});
		});
		const qc = new QueryClient();
		// Seed cross-user data that must not survive a logout.
		qc.setQueryData(["my-bookings"], [{ id: "b1" }]);

		render(
			<QueryClientProvider client={qc}>
				<AuthProvider>
					<div>child</div>
				</AuthProvider>
			</QueryClientProvider>,
		);

		await waitFor(() =>
			expect(useAuthStore.getState().status).toBe("authenticated"),
		);
		expect(qc.getQueryData(["my-bookings"])).toBeDefined();

		// Ending the session must purge the cache (no cross-user leakage).
		act(() => {
			useAuthStore.getState().signOut();
		});

		await waitFor(() =>
			expect(qc.getQueryData(["my-bookings"])).toBeUndefined(),
		);
	});
});
