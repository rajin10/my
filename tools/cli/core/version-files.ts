import { readFileSync, writeFileSync } from "node:fs";
import type { VersionTarget } from "./version-targets.ts";

function detectJsonIndent(raw: string): string | number {
	const match = raw.match(/^(\s+)"/m);
	if (!match) return "\t";
	return match[1] === "  " ? 2 : match[1];
}

function writeJson(path: string, data: unknown): void {
	const raw = readFileSync(path, "utf8");
	const indent = detectJsonIndent(raw);
	writeFileSync(path, `${JSON.stringify(data, null, indent)}\n`);
}

export function readPackageVersion(packageJsonPath: string): string {
	const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
		version?: string;
	};
	if (!pkg.version) {
		throw new Error(`Missing "version" in ${packageJsonPath}`);
	}
	return pkg.version;
}

export function writePackageVersion(
	packageJsonPath: string,
	version: string,
): void {
	const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
		version: string;
	};
	pkg.version = version;
	writeJson(packageJsonPath, pkg);
}

type ExpoAppJson = {
	expo: {
		version: string;
		android?: { versionCode?: number };
	};
};

export function writeExpoAppVersion(
	appJsonPath: string,
	version: string,
): void {
	const app = JSON.parse(readFileSync(appJsonPath, "utf8")) as ExpoAppJson;
	app.expo.version = version;
	const currentCode = app.expo.android?.versionCode ?? 0;
	if (app.expo.android) {
		app.expo.android.versionCode = currentCode + 1;
	}
	writeJson(appJsonPath, app);
}

export function readTargetVersion(target: VersionTarget): string {
	return readPackageVersion(target.packageJsonPath);
}

export function writeTargetVersion(
	target: VersionTarget,
	version: string,
): void {
	writePackageVersion(target.packageJsonPath, version);
	if (target.appJsonPath) {
		writeExpoAppVersion(target.appJsonPath, version);
	}
}
