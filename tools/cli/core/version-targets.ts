import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, "../../..");

export const VERSION_GROUPS = ["sites", "workers", "apps"] as const;
export type VersionGroup = (typeof VERSION_GROUPS)[number];

export type VersionTarget = {
	id: string;
	group: VersionGroup;
	label: string;
	packageJsonPath: string;
	appJsonPath?: string;
};

export const VERSION_TARGETS = {
	"marketing-site": {
		id: "marketing-site",
		group: "sites",
		label: "@repo/marketing-site",
		packageJsonPath: path.join(repoRoot, "sites/marketing-site/package.json"),
	},
	"business-dashboard": {
		id: "business-dashboard",
		group: "sites",
		label: "@repo/business-dashboard",
		packageJsonPath: path.join(
			repoRoot,
			"sites/business-dashboard/package.json",
		),
	},
	api: {
		id: "api",
		group: "workers",
		label: "@repo/api",
		packageJsonPath: path.join(repoRoot, "workers/api/package.json"),
	},
	queue: {
		id: "queue",
		group: "workers",
		label: "@repo/queue",
		packageJsonPath: path.join(repoRoot, "workers/queue/package.json"),
	},
	scheduled: {
		id: "scheduled",
		group: "workers",
		label: "@repo/scheduled",
		packageJsonPath: path.join(repoRoot, "workers/scheduled/package.json"),
	},
	"mobile-app": {
		id: "mobile-app",
		group: "apps",
		label: "@repo/mobile-app",
		packageJsonPath: path.join(repoRoot, "apps/mobile-app/package.json"),
		appJsonPath: path.join(repoRoot, "apps/mobile-app/app.json"),
	},
	"owner-app": {
		id: "owner-app",
		group: "apps",
		label: "@repo/owner-app",
		packageJsonPath: path.join(repoRoot, "apps/owner-app/package.json"),
		appJsonPath: path.join(repoRoot, "apps/owner-app/app.json"),
	},
} as const satisfies Record<string, VersionTarget>;

export type VersionTargetId = keyof typeof VERSION_TARGETS;

export const VERSION_TARGET_IDS = Object.keys(
	VERSION_TARGETS,
) as VersionTargetId[];

export function targetsInGroup(group: VersionGroup): VersionTarget[] {
	return VERSION_TARGET_IDS.map((id) => VERSION_TARGETS[id]).filter(
		(t) => t.group === group,
	);
}
