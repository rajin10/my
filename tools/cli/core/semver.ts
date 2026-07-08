export type SemverPart = "patch" | "minor" | "major";

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

export function parseSemver(version: string): [number, number, number] {
	const match = SEMVER_RE.exec(version);
	if (!match) {
		throw new Error(
			`Invalid semver "${version}" — expected major.minor.patch (e.g. 1.2.3)`,
		);
	}
	return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function bumpSemver(version: string, part: SemverPart): string {
	const [major, minor, patch] = parseSemver(version);
	switch (part) {
		case "major":
			return `${major + 1}.0.0`;
		case "minor":
			return `${major}.${minor + 1}.0`;
		case "patch":
			return `${major}.${minor}.${patch + 1}`;
	}
}

export function compareSemver(a: string, b: string): number {
	const left = parseSemver(a);
	const right = parseSemver(b);
	for (let i = 0; i < 3; i++) {
		if (left[i] !== right[i]) return left[i] - right[i];
	}
	return 0;
}

export function maxSemver(versions: string[]): string {
	if (versions.length === 0) {
		throw new Error("Cannot pick a max version from an empty list");
	}
	return versions.reduce((max, version) =>
		compareSemver(version, max) > 0 ? version : max,
	);
}
