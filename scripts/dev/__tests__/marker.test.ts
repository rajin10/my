// scripts/dev/__tests__/marker.test.ts
import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SETUP_VERSION } from "../constants.ts";
import { markerIsCurrent, readMarker, writeMarker } from "../marker.ts";

describe("marker", () => {
	test("write then read round-trips", async () => {
		const dir = await mkdtemp(join(tmpdir(), "talash-marker-"));
		const root = join(dir, "repo");
		await Bun.write(join(root, ".talash/.gitkeep"), "");
		const marker = {
			version: SETUP_VERSION,
			completedAt: new Date().toISOString(),
			ports: { api: 8787, marketing: 3000, dashboard: 3001 },
			secretsSource: "test" as const,
		};
		await writeMarker(root, marker);
		const loaded = await readMarker(root);
		expect(loaded?.version).toBe(SETUP_VERSION);
		await rm(dir, { recursive: true, force: true });
	});

	test("markerIsCurrent false when missing or stale version", async () => {
		expect(markerIsCurrent(null)).toBe(false);
		expect(markerIsCurrent({ version: 0 } as never)).toBe(false);
	});
});
