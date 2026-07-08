import {
	VERSION_GROUPS,
	VERSION_TARGET_IDS,
	VERSION_TARGETS,
	type VersionGroup,
	type VersionTarget,
	type VersionTargetId,
} from "./version-targets.ts";

function parseCsv(value: string): string[] {
	return value
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean);
}

function assertTargetId(id: string): VersionTargetId {
	if (id in VERSION_TARGETS) return id as VersionTargetId;
	throw new Error(
		`Unknown target "${id}". Use one of: ${VERSION_TARGET_IDS.join(", ")}`,
	);
}

function assertGroup(name: string): VersionGroup {
	if ((VERSION_GROUPS as readonly string[]).includes(name)) {
		return name as VersionGroup;
	}
	throw new Error(
		`Unknown group "${name}". Use one of: all, ${VERSION_GROUPS.join(", ")}`,
	);
}

export function resolveVersionTargets(input: {
	groups?: string;
	only?: string;
	site?: string;
}): VersionTarget[] {
	if (input.only) {
		const ids = parseCsv(input.only).map(assertTargetId);
		return ids.map((id) => VERSION_TARGETS[id]);
	}

	if (input.site) {
		if (input.site === "all") {
			return VERSION_TARGET_IDS.filter(
				(id) => VERSION_TARGETS[id].group === "sites",
			).map((id) => VERSION_TARGETS[id]);
		}
		const id = assertTargetId(input.site);
		if (VERSION_TARGETS[id].group !== "sites") {
			throw new Error(
				`--site only accepts site targets. Use --only for "${input.site}".`,
			);
		}
		return [VERSION_TARGETS[id]];
	}

	const groupNames = parseCsv(input.groups ?? "sites").flatMap((name) => {
		if (name === "all") return [...VERSION_GROUPS];
		return [assertGroup(name)];
	});

	const unique = new Map<VersionTargetId, VersionTarget>();
	for (const group of groupNames) {
		for (const id of VERSION_TARGET_IDS) {
			const target = VERSION_TARGETS[id];
			if (target.group === group) unique.set(id, target);
		}
	}

	if (unique.size === 0) {
		throw new Error("No version targets selected");
	}

	return [...unique.values()];
}
