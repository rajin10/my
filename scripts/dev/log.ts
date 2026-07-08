export function step(n: number, total: number, label: string): void {
	console.log(`[${n}/${total}] ${label}`);
}

export function ok(msg: string): void {
	console.log(`  ✓ ${msg}`);
}

export function fail(msg: string): never {
	console.error(`  ✗ ${msg}`);
	process.exit(1);
}

export function prefixLines(
	prefix: string,
	chunk: Uint8Array | string,
): string {
	const text =
		typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
	return text
		.split("\n")
		.filter((line) => line.length > 0)
		.map((line) => `[${prefix}] ${line}`)
		.join("\n");
}
