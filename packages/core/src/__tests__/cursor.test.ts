import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "../http/cursor";

describe("cursor codec", () => {
	it("round-trips createdAt and id", () => {
		const token = encodeCursor("2026-01-02T03:04:05.000Z", "uuid-abc");
		expect(decodeCursor(token)).toEqual({
			createdAt: "2026-01-02T03:04:05.000Z",
			id: "uuid-abc",
		});
	});

	it("produces an opaque token (not the raw id)", () => {
		const token = encodeCursor("2026-01-02T03:04:05.000Z", "uuid-abc");
		expect(token).not.toContain("uuid-abc");
		expect(token).toMatch(/^[0-9a-f]+$/);
	});

	it("returns null for a malformed (non-hex) cursor", () => {
		expect(decodeCursor("not-a-cursor!!")).toBeNull();
	});

	it("returns null for a valid-hex cursor missing the delimiter", () => {
		// hex of "nodelimiter" — decodes cleanly but has no '|'
		const hex = Array.from(new TextEncoder().encode("nodelimiter"))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
		expect(decodeCursor(hex)).toBeNull();
	});

	it("returns null when createdAt or id is empty", () => {
		const hexEmptyId = Array.from(new TextEncoder().encode("2026-01-01|"))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
		expect(decodeCursor(hexEmptyId)).toBeNull();
	});

	it("round-trips a realistic ISO timestamp and UUID", () => {
		const token = encodeCursor(
			"2026-12-31T23:59:59.999Z",
			"0f8fad5b-d9cb-469f-a165-70867728950e",
		);
		expect(decodeCursor(token)).toEqual({
			createdAt: "2026-12-31T23:59:59.999Z",
			id: "0f8fad5b-d9cb-469f-a165-70867728950e",
		});
	});

	it("splits on the first delimiter, preserving an id that contains '|'", () => {
		const token = encodeCursor("2026-01-01T00:00:00.000Z", "a|b|c");
		expect(decodeCursor(token)).toEqual({
			createdAt: "2026-01-01T00:00:00.000Z",
			id: "a|b|c",
		});
	});
});
