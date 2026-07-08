import type { getDB } from "@repo/core/src/database/client";
import type { Context } from "hono";
import type { R2Storage } from "../core/storage/r2";
import type { AppEnv } from "../types";

export interface SharedDeps {
	db: ReturnType<typeof getDB>;
	kv: KVNamespace | undefined;
	env: CloudflareBindings;
	storage: R2Storage;
}

export type ServiceInstaller = (c: Context<AppEnv>, deps: SharedDeps) => void;
