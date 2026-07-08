import type { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import type { BusinessesRepository } from "@repo/core/src/database/repositories/businesses.repository";
import { NotFoundError } from "../../core/errors";

const VERTICAL_CACHE_TTL_SECS = 300;

export type BranchVertical = "booking" | "commerce";

export async function resolveBranchVertical(
	branchId: string,
	branchesRepo: BranchesRepository,
	businessesRepo: BusinessesRepository,
	kv: KVNamespace | undefined,
): Promise<BranchVertical> {
	const cacheKey = `branch:${branchId}:vertical`;

	if (kv) {
		const cached = await kv.get(cacheKey);
		if (cached === "booking" || cached === "commerce") {
			return cached;
		}
	}

	const branch = await branchesRepo.findOne(branchId);
	if (!branch.data) throw new NotFoundError("Branch not found");

	const business = await businessesRepo.findOne(branch.data.businessId);
	if (!business.data) throw new NotFoundError("Business not found");

	const vertical = business.data.vertical as BranchVertical;
	if (vertical !== "booking" && vertical !== "commerce") {
		throw new NotFoundError("Unsupported branch vertical");
	}

	if (kv) {
		await kv.put(cacheKey, vertical, {
			expirationTtl: VERTICAL_CACHE_TTL_SECS,
		});
	}

	return vertical;
}

export function workerForVertical(
	vertical: BranchVertical,
	env: CloudflareBindings,
): Fetcher {
	return vertical === "commerce" ? env.LPG_SERVICE : env.BOOKING_SERVICE;
}
