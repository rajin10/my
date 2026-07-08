import { vi } from "vitest";

vi.mock("../database/client", () => ({
	getDB: vi.fn(() => ({})),
}));
