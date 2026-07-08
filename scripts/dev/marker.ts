import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { SETUP_VERSION } from "./constants.ts";
import { markerPath } from "./paths.ts";

export type SetupMarker = {
	version: number;
	completedAt: string;
	ports: { api: number; marketing: number; dashboard: number };
	secretsSource: "env" | "interactive" | "test";
};

export async function readMarker(root: string): Promise<SetupMarker | null> {
	const file = Bun.file(markerPath(root));
	if (!(await file.exists())) return null;
	try {
		return (await file.json()) as SetupMarker;
	} catch {
		return null;
	}
}

export async function writeMarker(
	root: string,
	marker: SetupMarker,
): Promise<void> {
	const path = markerPath(root);
	await mkdir(join(root, ".talash"), { recursive: true });
	await Bun.write(path, `${JSON.stringify(marker, null, 2)}\n`);
}

export function markerIsCurrent(marker: SetupMarker | null): boolean {
	return marker !== null && marker.version === SETUP_VERSION;
}
