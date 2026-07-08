// Canonical re-export — modules import AppEnv and AuthUser from here.
// The underlying definitions live in src/types/index.ts which is
// also the source for the Hono app factory.
export type { AppContext, AppEnv, AuthUser } from "../types";
