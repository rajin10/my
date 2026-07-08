import type { RequestIdVariables } from "hono/request-id";
import type { AuthService } from "./modules/auth/auth.service";
import type { UsersService } from "./modules/users/users.service";

export type AppContext = {
	Bindings: CloudflareBindings;
	Variables: RequestIdVariables & {
		parsedQuery: Record<string, unknown>;
		db: ReturnType<typeof import("@repo/core/src/database/client").getDB>;
		user?: AuthUser;
		authService: AuthService;
		usersService: UsersService;
	};
};

export type AppEnv = AppContext;

export interface AuthUser {
	id: string;
	email: string | null;
	name: string;
	role: string;
}
