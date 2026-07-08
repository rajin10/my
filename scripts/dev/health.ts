export async function waitForHealth(
	url: string,
	opts: { timeoutMs: number; pollMs: number },
): Promise<void> {
	const deadline = Date.now() + opts.timeoutMs;
	let lastError = "unknown";

	while (Date.now() < deadline) {
		try {
			const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
			if (res.ok) return;
			lastError = `HTTP ${res.status}`;
		} catch (e) {
			lastError = e instanceof Error ? e.message : String(e);
		}
		await Bun.sleep(opts.pollMs);
	}

	throw new Error(`Health check timeout for ${url}: ${lastError}`);
}
