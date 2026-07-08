import { getDB } from "@repo/core/src/database/client";
import { createMiddleware } from "hono/factory";
import { R2Storage } from "../core/storage/r2";
import type { AppEnv } from "../types";
import type { ServiceInstaller, SharedDeps } from "./shared-deps";

export type { ServiceInstaller, SharedDeps };

export function injectServices(installers: readonly ServiceInstaller[]) {
	return createMiddleware<AppEnv>(async (c, next) => {
		const db = getDB();
		const deps: SharedDeps = {
			db,
			kv: c.env.TALASH_KV,
			env: c.env,
			storage: new R2Storage(
				c.env.TALASH_STORAGE,
				c.env.PUBLIC_R2_URL ?? "storage.mahannankhan.info",
			),
		};

		c.set("db", db);

		for (const install of installers) {
			install(c, deps);
		}

		await next();
	});
}
