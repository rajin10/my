export type SeedEnv = "local" | "staging" | "production";

export interface SeedOptions {
	count: number;
	fakerSeed?: number;
	env: SeedEnv;
}

export interface SeedResult {
	module: string;
	inserted: number;
}

export interface BookingRef {
	bookingId: string;
	userId: string;
	businessId: string;
	serviceId: string;
	branchId: string;
	status: string;
	price: number;
}

export interface SeedContext {
	userIds: string[];
	ownerIds: string[];
	staffIds: string[];
	businessIds: string[];
	businessBranches: Record<string, string[]>; // businessId -> branchId[]
	branchServices: Record<string, string[]>; // branchId -> serviceId[]
	bookingRefs: BookingRef[];
}
