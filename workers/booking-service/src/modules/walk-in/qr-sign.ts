export type BranchQrPayload = {
	branchId: string;
	businessId: string;
	vertical: "booking" | "commerce";
	version: number;
};

function canonicalPayload(payload: BranchQrPayload): string {
	return [
		payload.branchId,
		payload.businessId,
		payload.vertical,
		String(payload.version),
	].join("|");
}

function toHex(buffer: ArrayBuffer): string {
	return [...new Uint8Array(buffer)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

async function hmacSha256(
	message: string,
	secret: string,
): Promise<ArrayBuffer> {
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		enc.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);
	return crypto.subtle.sign("HMAC", key, enc.encode(message));
}

export async function signBranchQr(
	payload: BranchQrPayload,
	secret: string,
): Promise<string> {
	const sig = await hmacSha256(canonicalPayload(payload), secret);
	return toHex(sig);
}

export async function verifyBranchQr(
	payload: BranchQrPayload,
	signature: string,
	secret: string,
): Promise<boolean> {
	const expected = await signBranchQr(payload, secret);
	if (expected.length !== signature.length) return false;
	let mismatch = 0;
	for (let i = 0; i < expected.length; i++) {
		mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
	}
	return mismatch === 0;
}
