export class R2Storage {
	private readonly publicUrl: string;

	constructor(
		private readonly bucket: R2Bucket,
		publicUrl: string,
	) {
		// Defend against a scheme-less PUBLIC_R2_URL (e.g. "storage.mahannankhan.info").
		// A bare host renders as a relative path in `<img src>` and 404s in the
		// browser, so normalize to an absolute https URL and drop any trailing slash.
		const trimmed = publicUrl.replace(/\/+$/, "");
		this.publicUrl = /^https?:\/\//.test(trimmed)
			? trimmed
			: `https://${trimmed}`;
	}

	async upload(
		key: string,
		body: ReadableStream | ArrayBuffer,
		contentType: string,
	): Promise<string> {
		await this.bucket.put(key, body, { httpMetadata: { contentType } });
		return `${this.publicUrl}/${key}`;
	}

	async delete(key: string): Promise<void> {
		await this.bucket.delete(key);
	}

	url(key: string): string {
		return `${this.publicUrl}/${key}`;
	}
}
