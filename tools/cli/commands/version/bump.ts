import { defineCommand } from "citty";
import { log } from "../../core/logger.ts";
import { bumpSemver, maxSemver, type SemverPart } from "../../core/semver.ts";
import {
	readTargetVersion,
	writeTargetVersion,
} from "../../core/version-files.ts";
import { resolveVersionTargets } from "../../core/version-resolve.ts";
import {
	VERSION_GROUPS,
	VERSION_TARGET_IDS,
} from "../../core/version-targets.ts";

const PARTS = ["patch", "minor", "major"] as const;

export default defineCommand({
	meta: {
		name: "bump",
		description:
			"Bump application versions for selected sites, workers, and/or apps",
	},
	args: {
		part: {
			type: "string",
			description: "Semver segment to increment",
			default: "patch",
		},
		groups: {
			type: "string",
			description: `Comma-separated groups: all, ${VERSION_GROUPS.join(", ")}`,
			default: "sites",
		},
		only: {
			type: "string",
			description: `Comma-separated targets (overrides --groups): ${VERSION_TARGET_IDS.join(", ")}`,
		},
		site: {
			type: "string",
			description:
				"Deprecated alias for a single site or all sites — prefer --groups / --only",
		},
	},
	async run({ args }) {
		const part = args.part as SemverPart;
		if (!PARTS.includes(part)) {
			throw new Error(
				`Invalid --part "${args.part}". Use one of: ${PARTS.join(", ")}`,
			);
		}

		const targets = resolveVersionTargets({
			groups: args.groups,
			only: args.only,
			site: args.site,
		});
		const currentVersions = targets.map((target) => readTargetVersion(target));
		const base = maxSemver(currentVersions);
		const next = bumpSemver(base, part);

		for (const target of targets) {
			writeTargetVersion(target, next);
			const extra = target.appJsonPath ? " (+ app.json, versionCode)" : "";
			log.success(`${target.label} → v${next}${extra}`);
		}
	},
});
