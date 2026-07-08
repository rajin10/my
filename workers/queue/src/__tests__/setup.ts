import { vi } from "vitest";

vi.mock("@repo/core/src/database/client", () => ({
	getDB: vi.fn(() => ({})),
}));
