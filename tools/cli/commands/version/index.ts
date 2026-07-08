import { defineCommand } from "citty";

export default defineCommand({
	meta: {
		name: "version",
		description: "Application version commands for web sites",
	},
	subCommands: {
		bump: () => import("./bump.ts").then((m) => m.default),
		show: () => import("./show.ts").then((m) => m.default),
	},
});
