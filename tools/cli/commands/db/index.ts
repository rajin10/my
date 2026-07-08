import { defineCommand } from "citty";

export default defineCommand({
	meta: {
		name: "db",
		description: "Database management commands",
	},
	subCommands: {
		seed: () => import("./seed.ts").then((m) => m.default),
		fresh: () => import("./fresh.ts").then((m) => m.default),
		status: () => import("./status.ts").then((m) => m.default),
		migrate: () => import("./migrate.ts").then((m) => m.default),
		generate: () => import("./generate.ts").then((m) => m.default),
		studio: () => import("./studio.ts").then((m) => m.default),
		list: () => import("./list.ts").then((m) => m.default),
	},
});
