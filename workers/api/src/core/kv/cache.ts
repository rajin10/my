export const KV_KEYS = {
	userSession: (userId: string) => `session:${userId}`,
	businessSlots: (branchId: string, date: string) =>
		`slots:${branchId}:${date}`,
	oauthState: (state: string) => `oauth:state:${state}`,
	resetToken: (token: string) => `reset:token:${token}`,
	businessProfile: (businessId: string) => `business:${businessId}`,
	serviceList: (branchId: string) => `services:${branchId}`,
} as const;

export const KV_TTL = {
	userSession: 900, // 15 min sliding
	businessSlots: 120, // 2 min — availability changes fast
	oauthState: 600, // 10 min — OAuth flow window
	resetToken: 3600, // 1 hour — password reset window
	businessProfile: 300, // 5 min — business profile changes rarely
	serviceList: 120, // 2 min — services can change
} as const;

export async function kvGet<T>(
	kv: KVNamespace,
	key: string,
): Promise<T | null> {
	return kv.get<T>(key, "json");
}

export async function kvSet<T>(
	kv: KVNamespace,
	key: string,
	value: T,
	ttl?: number,
): Promise<void> {
	return kv.put(
		key,
		JSON.stringify(value),
		ttl ? { expirationTtl: ttl } : undefined,
	);
}

export async function kvDel(kv: KVNamespace, key: string): Promise<void> {
	return kv.delete(key);
}

export async function kvIncr(
	kv: KVNamespace,
	key: string,
	ttl?: number,
): Promise<number> {
	const current = Number((await kv.get(key)) ?? "0");
	const next = current + 1;
	// Only set the TTL on first write to enforce a fixed window, not a sliding one
	await kv.put(
		String(key),
		String(next),
		current === 0 && ttl ? { expirationTtl: ttl } : undefined,
	);
	return next;
}
