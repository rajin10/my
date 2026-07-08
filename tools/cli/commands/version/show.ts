import { defineCommand } from "citty";
import { log } from "../../core/logger.ts";
import { readTargetVersion } from "../../core/version-files.ts";
import {
	VERSION_GROUPS,
	VERSION_TARGET_IDS,
	VERSION_TARGETS,
} from "../../core/version-targets.ts";

export default defineCommand({
	meta: {
		name: "show",
		description: "Show current versions for sites, workers, and apps",
	},
	args: {},
	async run() {
		const rows: Array<[string, string]> = [];

		for (const group of VERSION_GROUPS) {
			for (const id of VERSION_TARGET_IDS) {
				const target = VERSION_TARGETS[id];
				if (target.group !== group) continue;
				const version = readTargetVersion(target);
				rows.push([`${group}/${target.id}`, version]);
			}
		}

		log.table(rows, ["target", "version"]);
	},
});
