import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react-native";
import type { ReactElement, ReactNode } from "react";

/**
 * Renders a component inside a fresh React Query client. Use for components that
 * call `useQuery`/`useQueryClient` (directly or via a screen). The `useApp`
 * context is mocked per-test, so no AppProvider is needed.
 */
export function renderWithClient(ui: ReactElement) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	const Wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
	return render(ui, { wrapper: Wrapper });
}
