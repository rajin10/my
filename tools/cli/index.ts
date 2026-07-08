#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";

const main = defineCommand({
	meta: {
		name: "base",
		version: "0.0.1",
		description: "Native Base project CLI",
	},
	subCommands: {
		db: () => import("./commands/db/index.ts").then((m) => m.default),
		version: () => import("./commands/version/index.ts").then((m) => m.default),
	},
});

runMain(main);
