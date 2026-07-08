import { vi } from "vitest";

// Mock getDB() so route handlers that instantiate repositories inline
// don't attempt to connect to a real D1 database binding.
vi.mock("@repo/core/src/database/client", () => ({
	getDB: vi.fn(() => ({})),
}));
